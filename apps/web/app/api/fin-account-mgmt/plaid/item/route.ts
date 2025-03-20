import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { Configuration, PlaidApi, PlaidEnvironments, CountryCode } from 'plaid';
import { NextResponse } from 'next/server';
import { createTransactionService } from '~/lib/server/transaction.service';


export async function POST(request: Request) {
  const supabaseClient = getSupabaseServerClient();
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { plaidPublicToken } = await request.json();

  if (!plaidPublicToken) {
    return NextResponse.json({ error: 'Missing public token' }, { status: 400 });
  }

  const plaidConfiguration = new Configuration({
    basePath: PlaidEnvironments[process.env.PLAID_ENV ?? 'sandbox'],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
        'PLAID-SECRET': process.env.PLAID_SECRET,
      },
    },
  });

  const plaidClient = new PlaidApi(plaidConfiguration);
  const supabaseAdminClient = getSupabaseServerAdminClient();

  try {
    // Exchange tokena
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token: plaidPublicToken
    });

    const accessToken = exchangeResponse.data.access_token;
    const plaidItemId = exchangeResponse.data.item_id;

    // Get institution details
    const itemResponse = await plaidClient.itemGet({
      access_token: accessToken,
    });

    const institutionId = itemResponse.data.item.institution_id as string;
    const institutionResponse = await plaidClient.institutionsGetById({
      institution_id: institutionId,
      country_codes: [CountryCode.Us],
      options: {
        include_optional_metadata: true
      }
    });

    const institutionName = institutionResponse.data.institution.name;
    const institutionLogoBase64 = institutionResponse.data.institution.logo;

    // Manejar el logo
    let institutionLogoStorageName = null;
    if (institutionLogoBase64) {
      institutionLogoStorageName = `${institutionId}.png`;
      await supabaseAdminClient.storage
        .from(process.env.SUPABASE_STORAGE_BUCKET_PLAID_ITEM_INSTITUTION_LOGOS as string)
        .upload(institutionLogoStorageName, Buffer.from(institutionLogoBase64, 'base64'), {
          contentType: 'image/png',
          upsert: true
        });
    }

    // Insertar el item de conexión
    const { data: insertedItem, error: itemError } = await supabaseAdminClient
      .from('plaid_connection_items')
      .insert({
        owner_account_id: user.id,
        access_token: accessToken,
        plaid_item_id: plaidItemId,
        institution_id: institutionId,
        institution_name: institutionName,
        institution_logo_storage_name: institutionLogoStorageName,
      })
      .select('id')
      .single();

    if (itemError) throw itemError;

    // Obtener cuentas asociadas
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    // Insertar las cuentas (sin vincularlas a ningún budget)
    const accountPromises = accountsResponse.data.accounts.map(async (account) => {
      const { data: plaidAccount, error: accountError } = await supabaseAdminClient
        .from('plaid_accounts')
        .insert({
          plaid_conn_item_id: insertedItem.id,
          plaid_account_id: account.account_id,
          owner_account_id: user.id,
          name: account.name,
          official_name: account.official_name,
          type: account.type.toLowerCase() as 'depository' | 'credit' | 'loan' | 'investment' | 'other',
          subtype: account.subtype,
          mask: account.mask,
          balance_available: account.balances.available,
          balance_current: account.balances.current,
          balance_limit: account.balances.limit,
          iso_currency_code: account.balances.iso_currency_code,
        })
        .select(`
          *,
          budget_connections:budget_fin_accounts(budget_id)
        `)
        .single();

      if (accountError) throw accountError;
      return plaidAccount;
    });

    const plaidAccounts = await Promise.all(accountPromises);

    // Generar URL firmada para el logo
    const { data: signedUrlData } = await supabaseAdminClient.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET_PLAID_ITEM_INSTITUTION_LOGOS as string)
      .createSignedUrl(institutionLogoStorageName as string, 3600);

    // Construir el objeto de respuesta
    const plaidConnectionItem = {
      svendItemId: insertedItem.id,
      plaidItemId,
      accessToken,
      institutionName,
      institutionLogoSignedUrl: signedUrlData?.signedUrl ?? '',
      itemAccounts: plaidAccounts.map(account => ({
        svendAccountId: account.id,
        svendItemId: insertedItem.id,
        plaidAccountId: account.plaid_account_id,
        ownerAccountId: user.id,
        accountName: account.name,
        accountType: account.type,
        accountSubType: account.subtype,
        mask: account.mask,
        budgetFinAccountIds: account.budget_connections?.map(conn => conn.budget_id) || [],
        officialName: account.official_name,
        balanceAvailable: account.balance_available,
        balanceCurrent: account.balance_current,
        balanceLimit: account.balance_limit,
        isoCurrencyCode: account.iso_currency_code,
        createdAt: account.created_at,
        updatedAt: account.updated_at
      }))
    };

    // Sync initial transactions
    try {
      const transactionService = createTransactionService(supabaseAdminClient);

      const syncResult = await transactionService.syncPlaidTransactionsFinAccountMgmt([{
        svendItemId: insertedItem.id,
        accessToken,
        nextCursor: '', // Use empty cursor for initial sync
        plaidAccounts: plaidAccounts.map(account => ({
          svendAccountId: account.id,
          plaidAccountId: account.plaid_account_id,
          budgetFinAccountIds: []  // will never have any linked budgets on item creation from fin acct mgmt
        }))
      }], plaidClient);

      if (syncResult.error) {
        console.error('[Debug] Sync error details:', syncResult.error);
      }
    } catch (syncError: any) {
      console.error('[Debug] Sync error:', {
        error: syncError,
        stack: syncError.stack,
        response: syncError.response?.data
      });
      
      return NextResponse.json({ 
        error: 'Failed to sync transactions',
        details: syncError.response?.data?.error_message || syncError.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      plaidConnectionItem
    });

  } catch (error) {
    console.error('Error in POST /api/fin-account-mgmt/plaid/item:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const supabaseClient = getSupabaseServerClient();
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { svendItemId } = await request.json();

  const supabaseAdminClient = getSupabaseServerAdminClient();

  try {
    // Primero obtener el access_token
    const { data: plaidItem, error: fetchError } = await supabaseAdminClient
      .from('plaid_connection_items')
      .select('access_token')
      .eq('id', svendItemId)
      .single();

    if (fetchError || !plaidItem) throw fetchError;

    // Configurar Plaid client
    const plaidClient = new PlaidApi(new Configuration({
      basePath: PlaidEnvironments[process.env.PLAID_ENV ?? 'sandbox'],
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
          'PLAID-SECRET': process.env.PLAID_SECRET,
        },
      },
    }));

    // Remover el item de Plaid
    await plaidClient.itemRemove({
      access_token: plaidItem.access_token
    });

    // Eliminar el item de la base de datos (las cuentas y transacciones se eliminarán por cascade)
    const { error: deleteError } = await supabaseAdminClient
      .from('plaid_connection_items')
      .delete()
      .eq('id', svendItemId);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error disconnecting institution:', error);
    return NextResponse.json({ error: 'Failed to disconnect institution' }, { status: 500 });
  }
}


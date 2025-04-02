import { SupabaseClient, User } from '@supabase/supabase-js';
import { Database } from '~/lib/database.types';
import { AccountOnboardingManualInstitution } from '~/lib/model/onboarding.types';
import { createTransactionService } from '~/lib/server/transaction.service';

type Props = {
  supabaseAdminClient: SupabaseClient;
  user: User;
  budgetFinAccounts: Pick<
    Database['public']['Tables']['budget_fin_accounts']['Row'],
    'id' | 'manual_account_id' | 'plaid_account_id'
  >[];
  budgetId: string;
};

export default async function manualInstitutionsStateGetter({
  supabaseAdminClient,
  user,
  budgetFinAccounts,
  budgetId,
}: Props) {
  const transactionService = createTransactionService(supabaseAdminClient);

  // Fetch the manual institutions associated with the user
  const { data: manualInstitutions, error: manualInstitutionsError } =
    await supabaseAdminClient
      .from('manual_fin_institutions')
      .select(
        `
        id,
        name,
        symbol,
        meta_data,
        accounts:manual_fin_accounts(
          id,
          name,
          type,
          institution_id,
          balance_current,
          iso_currency_code,
          mask,
          meta_data,
          fin_account_transactions (*)
        )`,
      )
      .eq('owner_account_id', user.id);

  if (manualInstitutionsError) {
    console.error(
      'Error fetching institutions manual accounts',
      manualInstitutionsError,
    );

    return { error: 'Failed to fetch manual institutions' };
  }

  //Adds the budgetFinAccountId to each account if it exists
  const parsedManualInstitutions: AccountOnboardingManualInstitution[] =
    manualInstitutions.map((inst) => ({
      id: inst.id,
      name: inst.name,
      symbol: inst.symbol,
      meta_data: inst.meta_data,
      accounts: inst.accounts.map((acc) => ({
        id: acc.id,
        name: acc.name,
        type: acc.type,
        institutionId: acc.institution_id,
        balanceCurrent: acc.balance_current,
        isoCurrencyCode: acc.iso_currency_code,
        mask: acc.mask,
        meta_data: acc.meta_data,
        budgetFinAccountId: budgetFinAccounts.find(
          (account) => account.manual_account_id === acc.id,
        )?.id,
        transactions: transactionService.parseTransactions(
          acc.fin_account_transactions || [],
        ),
      })),
    }));

  return { manualInstitutions: parsedManualInstitutions };
}

import { SupabaseClient, User } from '@supabase/supabase-js';
import { Database } from '~/lib/database.types';
import { AccountOnboardingInstitution } from '~/lib/model/onboarding.types';

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
}: Props) {
  // Fetch the manual institutions associated with the user
  const { data: manualInstitutions, error: manualInstitutionsError } =
    await supabaseAdminClient
      .from('manual_fin_institutions')
      .select(
        `
      id,
      name,
      symbol,
      accounts:manual_fin_accounts(
        id,
        name,
        type,
        institution_id,
        balance_current,
        iso_currency_code,
        mask
      )
    `,
      )
      .eq('owner_account_id', user.id);

  if (manualInstitutionsError) {
    console.error(
      'Error fetching institutions manual accounts',
      manualInstitutionsError,
    );

    return { error: 'Failed to fetch manual institutions' };
  }

  const { data: finAccountTransactions, error: finAccountTransactionsError } =
    await supabaseAdminClient.from('fin_account_transactions').select('*');

  if (finAccountTransactionsError) throw finAccountTransactionsError;
  if (!finAccountTransactions)
    throw new Error(
      '[State Endpoint] No fin_account_transactions were returned from database',
    );

  //Adds the budgetFinAccountId to each account if it exists
  const parsedManualInstitutions: AccountOnboardingInstitution[] =
    manualInstitutions.map((inst) => ({
      id: inst.id,
      name: inst.name,
      symbol: inst.symbol,
      accounts: inst.accounts.map((acc) => ({
        ...acc,
        budgetFinAccountId: budgetFinAccounts.find(
          (account) => account.manual_account_id === acc.id,
        )?.id,
        transactions: finAccountTransactions.filter(
          (trans) => trans.manual_account_id === acc.id,
        ),
        institutionId: acc.institution_id,
        balanceCurrent: acc.balance_current,
        isoCurrencyCode: acc.iso_currency_code,
        mask: acc.mask,
      })),
    }));

  return { manualInstitutions: parsedManualInstitutions };
}

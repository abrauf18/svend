import { Database } from '~/lib/database.types';

type Props = {
  insertedInstitutions: Database['public']['Tables']['manual_fin_institutions']['Row'][];
  insertedAccounts: Database['public']['Tables']['manual_fin_accounts']['Row'][];
  insertedBudgetAccounts: Database['public']['Tables']['budget_fin_accounts']['Row'][];
  insertedFinAccountTransactions: Database['public']['Tables']['fin_account_transactions']['Row'][];
};

export default function parseCSVResponse({
  insertedInstitutions,
  insertedAccounts,
  insertedBudgetAccounts,
  insertedFinAccountTransactions,
}: Props) {
  try {
    const institutions = insertedInstitutions.map((inst) => {
      const accounts = insertedAccounts.filter(
        (acc) => acc.institution_id === inst.id,
      );

      return {
        id: inst.id,
        name: inst.name,
        symbol: inst.symbol,
        accounts: accounts.map((acc) => ({
          id: acc.id,
          name: acc.name,
          type: acc.type,
          balanceCurrent: acc.balance_current ?? 0,
          isoCurrencyCode: acc.iso_currency_code,
          mask: acc.mask!,
          transactions: insertedFinAccountTransactions.filter(
            (trans) => trans.manual_account_id === acc.id,
          ),
          budgetFinAccountId: insertedBudgetAccounts.find(
            (bfa) => bfa.manual_account_id === acc.id,
          )?.id,
          institutionId: acc.institution_id,
        })),
      };
    });

    return institutions;
  } catch (err: any) {
    console.error(err);

    throw err;
  }
}

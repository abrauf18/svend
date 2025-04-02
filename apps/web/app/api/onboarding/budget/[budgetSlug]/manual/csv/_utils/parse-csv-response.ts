import { Database } from '~/lib/database.types';
import { createTransactionService } from '~/lib/server/transaction.service';
import { SupabaseClient } from '@supabase/supabase-js';

type Props = {
  insertedInstitutions: Database['public']['Tables']['manual_fin_institutions']['Row'][];
  insertedAccounts: Database['public']['Tables']['manual_fin_accounts']['Row'][];
  insertedBudgetAccounts: Database['public']['Tables']['budget_fin_accounts']['Row'][];
  insertedFinAccountTransactions: Database['public']['Tables']['fin_account_transactions']['Row'][];
  supabase: SupabaseClient;
};

export function parseCSVResponse({
  insertedInstitutions,
  insertedAccounts,
  insertedBudgetAccounts,
  insertedFinAccountTransactions,
  supabase
}: Props) {
  const transactionService = createTransactionService(supabase);

  return insertedInstitutions.map(inst => ({
    id: inst.id,
    name: inst.name,
    symbol: inst.symbol,
    meta_data: inst.meta_data,
    accounts: insertedAccounts
      .filter(acc => acc.institution_id === inst.id)
      .map(acc => ({
        id: acc.id,
        name: acc.name,
        type: acc.type,
        balanceCurrent: acc.balance_current,
        isoCurrencyCode: acc.iso_currency_code,
        mask: acc.mask,
        meta_data: acc.meta_data,
        budgetFinAccountId: insertedBudgetAccounts.find(
          ba => ba.manual_account_id === acc.id
        )?.id,
        transactions: transactionService.parseTransactions(
          insertedFinAccountTransactions.filter(trans => trans.manual_account_id === acc.id)
        ),
        institutionId: acc.institution_id
      }))
  }));
}

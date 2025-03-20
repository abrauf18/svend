import { SupabaseClient } from '@supabase/supabase-js';
import { CSVRow } from '~/lib/model/onboarding.types';
import { Database } from '~/lib/database.types';

// Add enum type for account types
const VALID_ACCOUNT_TYPES = [
  'depository',
  'credit',
  'loan',
  'investment',
  'other'
] as const;

type AccountType = typeof VALID_ACCOUNT_TYPES[number];

type Props = {
  supabaseAdmin: SupabaseClient;
  parsedText: CSVRow[];
  userId: string;
  insertedInstitutions: any[];
};

type Account = Database['public']['Tables']['manual_fin_accounts']['Insert'];
type BudgetAccount = Database['public']['Tables']['budget_fin_accounts']['Insert'];

type Result = {
  data?: {
    accounts: Account[];
    budgetAccounts: BudgetAccount[];
  };
  error?: any;
  repeatedAccounts?: Map<string, Account>;
};

function validateAccountType(type: string): AccountType {
  const normalizedType = type.toLowerCase();
  if (VALID_ACCOUNT_TYPES.includes(normalizedType as AccountType)) {
    return normalizedType as AccountType;
  }
  // Default to 'other' if invalid type provided
  console.warn(`Invalid account type "${type}" provided, defaulting to "other"`);
  return 'other';
}

export default async function insertAccounts({
  supabaseAdmin,
  parsedText,
  userId,
  insertedInstitutions,
}: Props): Promise<Result> {
  try {
    const { data: currentAccounts, error: currentAccountsError } =
      await supabaseAdmin
        .from('manual_fin_accounts')
        .select()
        .eq('owner_account_id', userId);

    if (currentAccountsError) throw currentAccountsError;

    // const { data: currentBudgetAccounts, error: currentBudgetAccountsError } =
    //   await supabaseAdmin
    //     .from('budget_fin_accounts')
    //     .select()
    //     .in('manual_account_id', [...currentAccounts.map((cAcc) => cAcc.id)]);

    // if (currentBudgetAccountsError) throw currentBudgetAccountsError;

    const repeatedAccounts = new Map<string, Account>();
    const nonRepeatedAccounts = new Map<string, CSVRow>();

    const validRows = parsedText.filter(row => 
      row.AccountName && row.BankName && row.AccountName.trim() !== '' && row.BankName.trim() !== ''
    );

    for (const trans of validRows) {
      const parsedAccountName = trans.AccountName.trim().toLowerCase();
      const parsedInstitutionName = trans.BankName.trim().toLowerCase();

      // First check if we have a valid institution for this account
      const matchingInstitution = insertedInstitutions.find(
        (inst) => 
          (inst.name ?? '').trim().toLowerCase() === parsedInstitutionName &&
          (inst.symbol ?? '').trim().toUpperCase() === trans.BankSymbol.trim().toUpperCase()
      );

      if (!matchingInstitution) {
        console.warn(`Skipping account "${parsedAccountName}" - Institution mismatch:`, {
          requested: {
            name: parsedInstitutionName,
            symbol: trans.BankSymbol.trim().toUpperCase()
          },
          availableInstitutions: insertedInstitutions.map(inst => ({
            id: inst.id,
            name: inst.name,
            symbol: inst.symbol
          }))
        });
        continue;
      }

      const existsInDB = currentAccounts.find(
        (acc) => 
          acc.name.trim().toLowerCase() === parsedAccountName &&
          acc.institution_id === matchingInstitution.id
      );

      if (existsInDB) {
        repeatedAccounts.set(parsedAccountName, existsInDB);
      } else {
        nonRepeatedAccounts.set(parsedAccountName, trans);
      }
    }

    const { data: insertedAccounts, error: insertedAccountsError } =
      await supabaseAdmin
        .from('manual_fin_accounts')
        .insert([
          ...Array.from(nonRepeatedAccounts.values()).map((acc) => ({
            owner_account_id: userId,
            institution_id: insertedInstitutions.find(
              (inst) =>
                inst.name.trim().toLowerCase() === acc.BankName.trim().toLowerCase() &&
                inst.symbol.trim().toUpperCase() === acc.BankSymbol.trim().toUpperCase()
            )?.id,
            name: acc.AccountName,
            type: validateAccountType(acc.AccountType),
            mask: acc.AccountMask,
          })),
        ])
        .select();

    if (insertedAccountsError) throw insertedAccountsError;

    // const { data: insertedBudgetAccounts, error: budgetAccountsError } =
    //   await supabaseAdmin
    //     .from('budget_fin_accounts')
    //     .insert(
    //       Array.from(nonRepeatedAccounts.values()).map(csvRow => ({
    //         budget_id: budgetId,
    //         manual_account_id: insertedAccounts.find(
    //           acc => acc.name === csvRow.AccountName
    //         )?.id
    //       }))
    //     )
    //     .select();

    // if (budgetAccountsError) throw budgetAccountsError;

    return {
      data: {
        accounts: [...Array.from(repeatedAccounts.values()), ...insertedAccounts],
        budgetAccounts: []
      },
      repeatedAccounts
    };
  } catch (err: any) {
    console.error(err);

    return { error: err };
  }
}

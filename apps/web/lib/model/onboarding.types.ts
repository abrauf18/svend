import { Budget, BudgetCategoryGroups } from './budget.types';
import { FinAccountTransaction, ProfileData } from './fin.types';

// Define the enum for onboarding steps
export type AccountOnboardingStepContextKey =
  | 'start'
  | 'plaid'
  | 'manual'
  | 'profile_goals'
  | 'analyze_spending'
  | 'analyze_spending_in_progress'
  | 'budget_setup'
  | 'end';

export const accountOnboardingStepContextKeys: Readonly<
  Array<AccountOnboardingStepContextKey>
> = [
  'start',
  'plaid',
  'profile_goals',
  'analyze_spending',
  'analyze_spending_in_progress',
  'budget_setup',
  'end',
];

export const accountOnboardingSteps: Array<{
  contextKeys: Array<AccountOnboardingStepContextKey>;
}> = [
  {
    contextKeys: ['start', 'plaid', 'manual'],
  },
  {
    contextKeys: ['profile_goals'],
  },
  {
    contextKeys: ['analyze_spending', 'analyze_spending_in_progress'],
  },
  {
    contextKeys: ['budget_setup', 'end'],
  },
];

export type AccountOnboardingPlaidConnectionItem = {
  svendItemId: string;
  plaidItemId: string;
  institutionName: string;
  institutionLogoSignedUrl: string;
  accessToken?: string;
  nextCursor?: string;
  itemAccounts: AccountOnboardingPlaidItemAccount[];
};

export type AccountOnboardingPlaidItemAccount = {
  svendAccountId: string;
  svendItemId: string;
  ownerAccountId: string;
  plaidAccountId: string;
  plaidPersistentAccountId: string;
  accountName: string;
  officialName: string;
  accountType: string;
  accountSubType: string;
  balanceAvailable: number;
  balanceCurrent: number;
  isoCurrencyCode: string;
  balanceLimit: number;
  mask: string;
  budgetFinAccountId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AccountOnboardingManualInstitutionAccount = {
  id: string;
  name: string;
  type: string;
  institutionId: string;
  balanceCurrent: number;
  budgetFinAccountId?: string;
  transactions: FinAccountTransaction[];
  mask: string;
};

export type AccountOnboardingManualInstitution = {
  id: string;
  name: string;
  symbol: string;
  accounts: AccountOnboardingManualInstitutionAccount[];
};

export type AccountOnboardingState = {
  budget: Budget;
  profileData?: ProfileData;
  contextKey?: AccountOnboardingStepContextKey;
  userId?: string;
  plaidConnectionItems?: AccountOnboardingPlaidConnectionItem[];
  manualInstitutions?: AccountOnboardingManualInstitution[];
  svendCategoryGroups?: BudgetCategoryGroups;
  transactions?: {
    transactionsPanel?: {
      selectedAccount?: string;
    };
    sideMenu?: {
      selectedTransaction?: string;
    };
  };
};

export type OnboardingState = {
  account: AccountOnboardingState;
};

import checkCSVRowValidity from '../utils/check-csv-row-validity'

// Type for a single row of CSV data
export type CSVRow = Record<keyof CSVColumns, string>;

export type CSVColumnState = {
  originalName: string | null;
  isValid: boolean;
  canAutoGenerate: boolean;
  validationError?: string;
};

export const CSV_VALID_COLUMNS = [
  'TransactionId',
  'TransactionStatus',
  'TransactionDate',
  'TransactionAmount',
  'TransactionMerchant',
  'TransactionCategory',
  'BankName',
  'BankSymbol',
  'AccountName',
  'AccountType',
  'AccountMask',
] as const;

// Then use it to define CSVColumns type
export type CSVColumns = Record<
  typeof CSV_VALID_COLUMNS[number],
  CSVColumnState
>;

export type CSVState = {
  isModalOpen: boolean;
  isRowsModalOpen: boolean;
  filename: string;
  columns: CSVColumns;
  extraColumns: string[];
  rawData: Record<string, any>[];
  processedData: Record<string, any>[] | null;
  invalidRows?: ReturnType<typeof checkCSVRowValidity>[];
  csvResult?: Record<string, any> | null;
  error?: Error;
};

export type CSVColumnMapping = {
  // The internal column name we expect
  internalColumn: keyof CSVRow;
  // The CSV column name to map from, or 'auto-generate' for special cases
  csvColumn: string;
}

export type CSVMappingRequest = {
  // The original file path in Supabase storage
  filename: string;
  // The column mappings specified by the user
  columnMappings: CSVColumnMapping[];
}

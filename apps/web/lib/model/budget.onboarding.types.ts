import {
  Budget,
  BudgetCategoryGroups,
  BudgetFinAccountTransaction,
  BudgetGoal,
} from './budget.types';
import { FinAccountTransaction, ProfileData } from './fin.types';

// Define the enum for onboarding steps
export type BudgetOnboardingStepContextKey =
  | 'start'
  | 'plaid'
  | 'manual'
  | 'profile_goals'
  | 'analyze_spending'
  | 'analyze_spending_in_progress'
  | 'budget_setup'
  | 'invite_members'
  | 'end';

export const budgetOnboardingStepContextKeys: Readonly<
  Array<BudgetOnboardingStepContextKey>
> = [
  'start',
  'plaid',
  'profile_goals',
  'analyze_spending',
  'analyze_spending_in_progress',
  'budget_setup',
  'invite_members',
  'end',
];

export const budgetOnboardingSteps: Array<{
  contextKeys: Array<BudgetOnboardingStepContextKey>;
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

export type BudgetOnboardingPlaidConnectionItem = {
  svendItemId: string;
  plaidItemId: string;
  institutionName: string;
  institutionLogoSignedUrl: string;
  accessToken?: string;
  nextCursor?: string;
  itemAccounts: BudgetOnboardingPlaidItemAccount[];
  meta_data: {
    created_for: string;
  };
};

export type BudgetOnboardingPlaidItemAccount = {
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
  meta_data: {
    created_for: string;
  };
  budgetFinAccountId: string | null;
  transactions: BudgetFinAccountTransaction[];
  createdAt: string;
  updatedAt: string;
};

export type BudgetOnboardingManualInstitutionAccount = {
  id: string;
  name: string;
  type: string;
  institutionId: string;
  balanceCurrent: number;
  budgetFinAccountId?: string;
  transactions: FinAccountTransaction[];
  mask: string;
  meta_data?:{
    created_for: string;
  }
};

export type BudgetOnboardingManualInstitution = {
  id: string;
  name: string;
  symbol: string;
  accounts: BudgetOnboardingManualInstitutionAccount[];
  meta_data?:{
    created_for: string
  }
};

export type BudgetOnboardingState = {
  budget: Omit<Budget, 'goals'> & {
    goals?: (BudgetGoal & {
      subType?: string;
    })[];
  };
  profileData?: ProfileData;
  contextKey?: BudgetOnboardingStepContextKey;
  userId?: string;
  manualInstitutions?: BudgetOnboardingManualInstitution[];
  plaidConnectionItems?: BudgetOnboardingPlaidConnectionItem[];
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
  budget: BudgetOnboardingState;
};

import checkCSVRowValidity from '../utils/check-csv-row-validity';

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
  (typeof CSV_VALID_COLUMNS)[number],
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
};

export type CSVMappingRequest = {
  // The original file path in Supabase storage
  filename: string;
  // The column mappings specified by the user
  columnMappings: CSVColumnMapping[];
};

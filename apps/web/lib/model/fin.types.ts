import { Transaction, TransactionStream } from "plaid";

export type FinAccount = {
  id: string;
  source: 'plaid' | 'svend';
  type: 'depository' | 'credit' | 'loan' | 'investment' | 'other';
  institutionName: string;
  budgetFinAccountId?: string;
  name: string;
  mask: string;
  officialName: string;
  balance: number;
  balanceCurrent?: number;
}

// Interface representing a financial account transaction
export interface FinAccountTransaction {
  id: string; // Unique identifier for the transaction
  userTxId: string; // Unique identifier for the transaction presented to the user
  plaidTxId?: string; // Unique identifier for the transaction presented to the user
  date: string; // Date of the transaction
  amount: number; // Amount of the transaction
  plaidAccountId?: string; // UUID referencing the Plaid account associated with the transaction
  manualAccountId?: string; // UUID referencing the manual account associated with the transaction
  svendCategoryId?: string; // UUID referencing the SVEND category associated with the transaction
  plaidDetailedCategory?: string; // Detailed category from Plaid
  plaidCategoryConfidence?: string; // Confidence level for the category from Plaid
  merchantName: string; // Name of the merchant involved in the transaction
  payee?: string; // Name of the payee for the transaction
  status: 'pending' | 'posted';
  isoCurrencyCode?: string; // ISO currency code for the transaction
  recurrenceDetails?: any;
  isRecurring?: boolean;
  plaidRawData?: Transaction; // Raw data from Plaid
  meta_data?: any;
  createdAt?: string; // Timestamp
  updatedAt?: string; // Timestamp
}

// Interface representing a financial account recurring transaction
export interface FinAccountRecurringTransaction {
  id: string; // Unique identifier for the transaction
  plaidAccountId?: string; // UUID referencing the Plaid account associated with the transaction
  manualAccountId?: string; // UUID referencing the manual account associated with the transaction
  svendCategoryId?: string; // UUID referencing the SVEND category associated with the transaction
  userTxId: string; // Unique identifier for the transaction presented to the user
  plaidTxId?: string; // Unique identifier for the transaction presented to the user
  plaidDetailedCategory?: string; // Detailed category from Plaid
  plaidCategoryConfidence?: string; // Confidence level for the category from Plaid
  finAccountTransactionIds: string[]; // Array of UUIDs referencing the fin account transactions associated with the recurring transaction
  plaidRawData?: TransactionStream; // Raw data from Plaid
  createdAt?: string; // Timestamp
  updatedAt?: string; // Timestamp
}

export interface CategoryGroup {
  id: string; // UUID
  budgetId?: string; // Optional UUID referencing budgets
  name: string; // Group name
  description?: string; // Optional description
  isEnabled: boolean; // Indicates if the group is enabled
  createdAt: string; // Timestamp
  updatedAt: string; // Timestamp
  categories: Category[];
}

export interface CategoryCompositionData {
  categoryId: string;
  weight: number;
  categoryName: string;
}

export interface Category {
  id: string; // UUID
  budgetId?: string; // Optional UUID referencing budgets
  name: string; // Category name
  description?: string; // Optional description
  isDiscretionary: boolean; // Indicates if the group is discretionary
  isComposite?: boolean;
  compositeData?: CategoryCompositionData[] | null;
  createdAt: string; // Timestamp
  updatedAt: string; // Timestamp
}

export type ProfileData = {
  fullName: string | null;
  age: string | null;
  annualIncome: string | null;
  savingsLevel: string | null;
  debtTypes: string[] | null;
  primaryFinancialGoal: string[] | null;
  goalTimeline: string | null;
  monthlyContribution: string | null;
  state: string | null;
  maritalStatus?: string;
  dependents?: string;
}

export type FinAccount = {
    id: string;
    source: 'plaid' | 'svend';
    budgetFinAccountId?: string;
    name: string;
    mask: string;
    officialName: string;
    balance: number;
}

// Interface representing a financial account transaction
export interface FinAccountTransaction {
    id: string; // Unique identifier for the transaction
    date: string; // Date of the transaction
    amount: number; // Amount of the transaction
    plaidAccountId?: string; // UUID referencing the Plaid account associated with the transaction
    manualAccountId?: string; // UUID referencing the manual account associated with the transaction
    plaidDetailedCategory?: string; // Detailed category from Plaid
    plaidCategoryConfidence?: string; // Confidence level for the category from Plaid
    svendCategoryGroupId?: string; // UUID referencing the group of the category associated with the transaction
    svendCategoryGroup?: string; // Group of the category associated with the transaction
    svendCategoryId?: string; // UUID referencing the category associated with the transaction
    svendCategory?: string; // Name of the category associated with the transaction
    merchantName: string; // Name of the merchant involved in the transaction
    payee?: string; // Name of the payee for the transaction
    isoCurrencyCode?: string; // ISO currency code for the transaction
    notes?: string; // Notes for the transaction
    rawData?: any; // Raw data from Plaid
    budgetFinAccountId?: string; // UUID referencing the financial account link to the budget
    budgetTags?: FinAccountTransactionBudgetTag[]; // Tags associated with the transaction
    budgetAttachmentsStorageNames?: string[]; // Storage names for attachments
}

export interface FinAccountTransactionBudgetTag {
    id: string;
    name: string;
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

export interface Category {
    id: string; // UUID
    name: string; // Category name
    description?: string; // Optional description
    createdAt: string; // Timestamp
    updatedAt: string; // Timestamp
}

export type ProfileData = {
    fullName: string | null;
    age: string | null;
    maritalStatus: string | null;
    dependents: string | null;
    incomeLevel: string | null;
    savings: string | null;
    currentDebt: string[] | null;
    primaryFinancialGoal: string[] | null;
    goalTimeline: string | null;
    monthlyContribution: string | null;
    state: string | null;
}

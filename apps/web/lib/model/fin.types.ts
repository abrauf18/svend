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

// Interface representing a financial account transaction
export interface FinAccountTransaction {
    id: string; // Unique identifier for the transaction
    date: string; // Date of the transaction
    amount: number; // Amount of the transaction
    plaidDetailedCategoryName?: string; // Detailed category from Plaid
    svendCategoryName?: string; // Name of the category associated with the transaction
    svendCategoryId?: string; // UUID referencing the category associated with the transaction
    merchantName: string; // Name of the merchant involved in the transaction
    payee?: string; // Name of the payee for the transaction
    plaidAccountId?: string; // UUID referencing the Plaid account where the transaction occurred
    plaidItemId?: string; // UUID referencing the Plaid connection item where the transaction occurred
    accountName?: string; // Name of the account where the transaction occurred
    accountMask?: string; // Masked account number for privacy
    isoCurrencyCode?: string; // ISO currency code for the transaction
    rawData?: any; // Raw data from Plaid
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

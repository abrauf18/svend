import { Budget } from "./budget.types";
import { ProfileData } from "./fin.types";

// Define the enum for onboarding steps
export type AccountOnboardingStepContextKey =
  | 'start'
  | 'plaid'
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
    contextKeys: ['start', 'plaid'],
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

export type AccountOnboardingState = {
  budget: Budget;
  profileData?: ProfileData;
  contextKey?: AccountOnboardingStepContextKey;
  userId?: string;
  plaidConnectionItems?: AccountOnboardingPlaidConnectionItem[];
};

export type OnboardingState = {
  account: AccountOnboardingState;
};

import { Budget, BudgetCategoryGroups, BudgetFinAccountTransaction } from './budget.types';
import { FinAccount, FinAccountTransaction } from './fin.types';

export type FinAccountsMgmtPlaidConnectionItem = {
  svendItemId: string;
  plaidItemId: string;
  institutionName: string;
  institutionLogoSignedUrl: string;
  nextCursor?: string;
  itemAccounts: FinAccountsMgmtPlaidItemAccount[];
};

export type FinAccountsMgmtPlaidItemAccount = {
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
  budgetFinAccountIds: string[];
  transactions: BudgetFinAccountTransaction[];
  createdAt: string;
  updatedAt: string;
};

export type FinAccountsMgmtManualInstitutionAccount = {
  id: string;
  name: string;
  type: string;
  institutionId: string;
  balanceCurrent: number;
  budgetFinAccountIds: string[];
  transactions: FinAccountTransaction[];
  mask: string;
};

export type FinAccountsMgmtManualInstitution = {
  id: string;
  name: string;
  symbol: string;
  accounts: FinAccountsMgmtManualInstitutionAccount[];
};

export type FinAccountsMgmtState = {
  account: {
    budgets?: Budget[];
    userId?: string;
    plaidConnectionItems?: FinAccountsMgmtPlaidConnectionItem[];
    manualInstitutions?: FinAccountsMgmtManualInstitution[];
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
}; 

import { FinAccountTransaction } from '~/lib/model/fin.types';
import { BudgetFinAccountRecurringTransaction, BudgetFinAccountTransaction, BudgetFinAccountTransactionTag } from '../model/budget.types';

interface LinkedAccountInfo {
  name?: string;
  mask?: string;
}

/**
 * @name TransactionSearchService
 * @description Service for transaction search-related operations
 */
export class TransactionSearchService {

  /**
   * Formats a date string into a localized date string
   * @param dateString - The date string to format (YYYY-MM-DD)
   * @returns Formatted date string
   */
  private formatDate(dateString: string): string {
    const date = new Date();
    date.setFullYear(Number(dateString.split('-')[0]));
    date.setMonth(Number(dateString.split('-')[1]) - 1);
    date.setDate(Number(dateString.split('-')[2]));
    return date.toLocaleDateString(navigator.language, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  /**
   * Calculates a search relevance score for a transaction based on search terms
   * @param transaction - The transaction to score
   * @param searchTerms - Array of search terms to match against
   * @param linkedAccount - Optional linked account info for additional matching
   * @returns Numeric score indicating search relevance
   */
  getSearchScore(
    transaction: BudgetFinAccountTransaction,
    searchTerms: string[],
    linkedAccount?: LinkedAccountInfo
  ): number {
    if (!searchTerms.length) return 0;

    const searchableTexts = this.getSearchableTexts(transaction, linkedAccount);
    let score = 0;

    searchTerms.filter(Boolean).forEach((term, index) => {
      score += this.calculateTermScore(term, searchableTexts, transaction);
    });

    return score;
  }

  /**
   * Calculates a search relevance score for a transaction based on search terms
   * @param transaction - The transaction to score
   * @param searchTerms - Array of search terms to match against
   * @param linkedAccount - Optional linked account info for additional matching
   * @returns Numeric score indicating search relevance
   */
  getSearchScoreRecurring(
    recurringTransaction: BudgetFinAccountRecurringTransaction,
    searchTerms: string[],
    tags: BudgetFinAccountTransactionTag[],
    linkedAccount?: LinkedAccountInfo
  ): number {
    if (!searchTerms.length) return 0;

    const searchableTexts = this.getSearchableTextsRecurring(recurringTransaction, linkedAccount);
    let score = 0;
    const matchedTerms = new Set<string>();

    // Calculate proportional tag column boost
    if (recurringTransaction.budgetTags?.length) {
      const tagNames = recurringTransaction.budgetTags.map(t => t.name.toLowerCase());
      const searchTermsLower = searchTerms.map(t => t.toLowerCase());
      const tagsLower = tags.map(t => t.name.toLowerCase());
      
      // First identify which search terms are actually tags
      const tagSearchTerms = searchTermsLower.filter(term => 
        tagsLower.includes(term)
      );
      
      // Count matching tags
      const matchingTagCount = tagNames.filter(tag => tagSearchTerms.includes(tag)).length;

      if (matchingTagCount > 0) {
        // Use the larger of: number of tags in row OR number of tag terms in search
        const maxPossibleMatches = Math.max(tagNames.length, tagSearchTerms.length);
        const boost = Math.round((matchingTagCount / maxPossibleMatches) * 200);
        
        score += boost;
        
        // Add matched tags to prevent double counting
        tagNames.filter(tag => searchTermsLower.includes(tag))
          .forEach(tag => matchedTerms.add(tag));
      }
    }

    // Check for exact column matches
    const columnsToCheck = {
      notes: recurringTransaction.notes?.toLowerCase() || '',
      category: recurringTransaction.category?.toLowerCase() || '',
      categoryGroup: recurringTransaction.categoryGroup?.toLowerCase() || ''
    };

    searchTerms.forEach(term => {
      const termLower = term.toLowerCase();
      if (matchedTerms.has(termLower)) return; // Skip if already matched

      Object.entries(columnsToCheck).forEach(([column, value]) => {
        if (value === termLower) {
          // Non-tag full column matches get 500/numSearchTerms
          const columnBoost = Math.round(75 + 75 / searchTerms.length);
          score += columnBoost;
          matchedTerms.add(termLower);
        }
      });
    });

    // Then handle individual tag matches
    const matchingTags = searchTerms.filter(term => {
      const termLower = term.toLowerCase();
      if (matchedTerms.has(termLower)) return false; // Skip if already matched

      const matches = recurringTransaction.budgetTags?.filter(
        tag => tag.name.toLowerCase() === termLower
      );
      if (matches?.length) {
        matchedTerms.add(termLower);
        return true;
      }
      return false;
    });
    
    const tagScore = matchingTags.length * 200;
    
    score += tagScore;

    // Add additional scores from other matches (excluding already matched terms)
    searchTerms.forEach(term => {
      const termLower = term.toLowerCase();
      if (matchedTerms.has(termLower)) return; // Skip if already matched

      if (searchableTexts.some(text => {
        const words = text.split(/\s+/);
        return words.some(word => word === termLower);
      })) {
        score += 25;
        matchedTerms.add(termLower);
      } else if (searchableTexts.some(text => text.startsWith(termLower))) {
        score += 15 + Math.min(term.length, 20);
        matchedTerms.add(termLower);
      } else if (searchableTexts.some(text => text.includes(termLower))) {
        score += 5 + Math.min(term.length, 10);
        matchedTerms.add(termLower);
      }
    });

    return score;
  }

  /**
   * Gets all searchable text fields from a transaction
   * @param budgetTransaction - The transaction to extract searchable text from
   * @param linkedAccount - Optional linked account info
   * @returns Array of searchable text strings
   */
  private getSearchableTexts(
    budgetTransaction: BudgetFinAccountTransaction,
    linkedAccount?: LinkedAccountInfo
  ): string[] {
    const amount = budgetTransaction.transaction.amount;
    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount).toLowerCase();
    const simplifiedAmount = Math.abs(amount).toString().toLowerCase();

    const date = new Date(budgetTransaction.transaction.date);
    const dateFormats = [
      this.formatDate(budgetTransaction.transaction.date).toLowerCase(),
      date.toLocaleDateString(navigator.language).toLowerCase(),
      budgetTransaction.transaction.date.toLowerCase(),
    ];

    return [
      ...dateFormats,
      formattedAmount,
      simplifiedAmount,
      ...(budgetTransaction.budgetTags?.map(t => t.name.toLowerCase()) || []),
      (budgetTransaction.category?.name || '').toLowerCase(),
      (budgetTransaction.categoryGroup || '').toLowerCase(),
      (budgetTransaction.merchantName || '').toLowerCase(),
      (budgetTransaction.payee || '').toLowerCase(),
      (budgetTransaction.notes || '').toLowerCase(),
      (linkedAccount?.name || '').toLowerCase(),
      (linkedAccount?.mask || '').toLowerCase(),
    ];
  }

  /**
   * Gets all searchable text fields from a transaction
   * @param budgetTransaction - The transaction to extract searchable text from
   * @param linkedAccount - Optional linked account info
   * @returns Array of searchable text strings
   */
  private getSearchableTextsRecurring(
    budgetTransaction: BudgetFinAccountRecurringTransaction,
    linkedAccount?: LinkedAccountInfo
  ): string[] {
    return [
      ...(budgetTransaction.budgetTags?.map(t => t.name.toLowerCase()) || []),
      (budgetTransaction.category || '').toLowerCase(),
      (budgetTransaction.categoryGroup || '').toLowerCase(),
      (budgetTransaction.notes || '').toLowerCase(),
      (linkedAccount?.name || '').toLowerCase(),
      (linkedAccount?.mask || '').toLowerCase(),
    ];
  }

  /**
   * Calculates the score contribution for a single search term
   * @param term - The search term to score
   * @param searchableTexts - Array of text fields to search against
   * @param transaction - The full transaction for tag matching
   * @returns Score for this term
   */
  private calculateTermScore(
    term: string,
    searchableTexts: string[],
    transaction: BudgetFinAccountTransaction
  ): number {
    const weight = 1; // Base weight, could be parameterized if needed

    if (transaction.budgetTags?.some(tag => tag.name.toLowerCase() === term)) {
      return weight * 50;
    }

    if (searchableTexts.some(text => {
      const words = text.split(/\s+/);
      return words.some(word => word === term);
    })) {
      return weight * 30;
    }

    if (searchableTexts.some(text => text.startsWith(term))) {
      return weight * (20 + Math.min(term.length, 10));
    }

    if (searchableTexts.some(text => text.includes(term))) {
      return weight * (10 + Math.min(term.length, 10));
    }

    if (searchableTexts.some(text => text?.startsWith(term[0]!))) {
      return weight * 5;
    }

    if (searchableTexts.some(text => text?.includes(term[0]!))) {
      return weight * 2;
    }

    return 0;
  }

  /**
   * Calculates a search relevance score for a recurring transaction and its associated transactions
   * @param recurringTransaction - The recurring transaction to score
   * @param searchTerms - Array of search terms to match against
   * @param associatedTransactions - Array of associated regular transactions
   * @param linkedAccount - Optional linked account info for additional matching
   * @returns Combined score from recurring and associated transactions
   */
  getRecurringWithAssociatedScore(
    recurringTransaction: BudgetFinAccountRecurringTransaction,
    searchTerms: string[],
    tags: BudgetFinAccountTransactionTag[],
    associatedTransactions: BudgetFinAccountTransaction[],
    linkedAccount?: LinkedAccountInfo
  ): number {
    // Get the base score for the recurring transaction itself
    const recurringScore = this.getSearchScoreRecurring(recurringTransaction, searchTerms, tags, linkedAccount);

    // If no associated transactions, return just the recurring score
    if (associatedTransactions.length === 0) {
      return recurringScore;
    }

    // Calculate average score of associated transactions
    const associatedScores = associatedTransactions.map(t => 
      this.getSearchScore(t, searchTerms, linkedAccount)
    );
    const averageAssociatedScore = associatedScores.reduce((sum, score) => sum + score, 0) / associatedTransactions.length;

    // Return recurring score plus average of associated transactions
    return recurringScore + averageAssociatedScore;
  }
}

/**
 * Creates an instance of the TransactionSearchService.
 * @param supabaseClient - The Supabase client instance
 * @returns An instance of TransactionSearchService
 */
export function createTransactionSearchService() {
  return new TransactionSearchService();
}

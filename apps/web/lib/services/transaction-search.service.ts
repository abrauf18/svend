import { FinAccountTransaction } from '~/lib/model/fin.types';

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
    transaction: FinAccountTransaction,
    searchTerms: string[],
    linkedAccount?: LinkedAccountInfo
  ): number {
    if (!searchTerms.length) return 0;

    const searchableTexts = this.getSearchableTexts(transaction, linkedAccount);
    let score = 0;

    searchTerms.filter(Boolean).forEach((term, index) => {
      const weight = searchTerms.length - index;
      score += this.calculateTermScore(term, searchableTexts, transaction);
    });

    return score;
  }

  /**
   * Gets all searchable text fields from a transaction
   * @param transaction - The transaction to extract searchable text from
   * @param linkedAccount - Optional linked account info
   * @returns Array of searchable text strings
   */
  private getSearchableTexts(
    transaction: FinAccountTransaction,
    linkedAccount?: LinkedAccountInfo
  ): string[] {
    const amount = transaction.amount;
    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount).toLowerCase();
    const simplifiedAmount = Math.abs(amount).toString().toLowerCase();

    const date = new Date(transaction.date);
    const dateFormats = [
      this.formatDate(transaction.date).toLowerCase(),
      date.toLocaleDateString(navigator.language).toLowerCase(),
      transaction.date.toLowerCase(),
    ];

    return [
      ...dateFormats,
      formattedAmount,
      simplifiedAmount,
      ...(transaction.budgetTags?.map(t => t.name.toLowerCase()) || []),
      (transaction.svendCategory || '').toLowerCase(),
      (transaction.svendCategoryGroup || '').toLowerCase(),
      (transaction.merchantName || '').toLowerCase(),
      (transaction.payee || '').toLowerCase(),
      (transaction.notes || '').toLowerCase(),
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
    transaction: FinAccountTransaction
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
}

/**
 * Creates an instance of the TransactionSearchService.
 * @param supabaseClient - The Supabase client instance
 * @returns An instance of TransactionSearchService
 */
export function createTransactionSearchService() {
  return new TransactionSearchService();
}

import { expect, test } from '@playwright/test';
import { BudgetFinAccountRecurringTransaction, BudgetFinAccountTransactionTag } from '../../../web/lib/model/budget.types';
import { TransactionSearchService } from '../../../web/lib/services/transaction-search.service';

test.describe('TransactionSearchService', () => {
  const createTestTransaction = (tags: string[]): BudgetFinAccountRecurringTransaction => ({
    notes: 'Test Transaction',
    budgetTags: tags.map(name => ({ name }))
  } as BudgetFinAccountRecurringTransaction);

  const allTags: BudgetFinAccountTransactionTag[] = [
    { name: 'tag1', id: 'tag1' },
    { name: 'tag2', id: 'tag2' },
    { name: 'fizzbuzz', id: 'fizzbuzz' },
    { name: 'barfoo', id: 'barfoo' }
  ];

  test('should correctly calculate tag match boost scores', async () => {
    const searchService = new TransactionSearchService();

    // Case 1: Search has 1 tag, row has 1 matching tag -> full boost
    const case1 = createTestTransaction(['tag1']);
    const case1Score = searchService.getSearchScoreRecurring(case1, ['tag1'], allTags);
    expect(case1Score).toBe(1000); // Full boost

    // Case 2: Search has 2 tags, row has 2 matching tags -> full boost
    const case2 = createTestTransaction(['tag1', 'tag2']);
    const case2Score = searchService.getSearchScoreRecurring(case2, ['tag1', 'tag2'], allTags);
    expect(case2Score).toBe(1000); // Full boost

    // Case 3: Search has 2 tags, row has 1 matching tag -> half boost
    const case3 = createTestTransaction(['fizzbuzz']);
    const case3Score = searchService.getSearchScoreRecurring(case3, ['barfoo', 'fizzbuzz'], allTags);
    expect(case3Score).toBe(500); // Half boost

    // Case 4: Search has 1 tag, row has 2 tags (1 matches) -> half boost
    const case4 = createTestTransaction(['tag1', 'tag2']);
    const case4Score = searchService.getSearchScoreRecurring(case4, ['tag1'], allTags);
    expect(case4Score).toBe(500); // Half boost

    // Case 5a: Search has 2 tags + 1 non-tag, row has 2 matching tags -> full boost
    const case5a = createTestTransaction(['tag1', 'tag2']);
    const case5aScore = searchService.getSearchScoreRecurring(case5a, ['tag1', 'tag2', 'nonTag'], allTags);
    expect(case5aScore).toBe(1000); // Full boost

    // Case 5b: Search has 2 tags + 1 non-tag, row has 1 matching tag -> half boost
    const case5b = createTestTransaction(['tag1']);
    const case5bScore = searchService.getSearchScoreRecurring(case5b, ['tag1', 'tag2', 'nonTag'], allTags);
    expect(case5bScore).toBe(500); // Half boost
  });
}); 

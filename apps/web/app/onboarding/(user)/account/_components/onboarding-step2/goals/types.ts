import { z } from 'zod';

export type GoalType = 'save' | 'debt' | 'invest' | 'charity';

export const saveSubTypes: Record<string, string> = {
  'emergency_fund': 'Build an emergency fund',
  'house': 'Save for a house',
  'retirement': 'Save for retirement',
  'education': 'Save for education',
  'vacation': 'Save for vacation',
  'general': 'General Savings'
};

export const debtSubTypes: Record<string, string> = {
  'loans': 'Loans',
  'credit_cards': 'Credit Cards'
};

// Base schema that all goal forms will extend
export const BaseFormSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  amount: z.string(),
  budgetFinAccountId: z
    .string()
    .uuid('Invalid account ID format. Must be a valid UUID.'),
  balance: z.number(),
  targetDate: z
    .string()
    .refine(
      (val) => val === undefined || /^\d{4}-\d{2}-\d{2}$/.test(val),
      'Invalid date format. Use yyyy-MM-dd format.',
    )
    .refine(
      (val) => {
        if (!val) return true;
        
        // Get today's date and strip time components
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0]!;
        
        // Compare the date strings directly
        return val > todayStr;  // This will compare YYYY-MM-DD strings
      },
      'Target date must be in the future.',
    ),
  description: z.string().optional(),
}); 

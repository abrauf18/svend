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
  amount: z.string()
    .min(1, 'Amount is required.')
    .refine((val) => {
      const parsed = parseFloat(val.replace(/[^0-9.-]/g, ''));
      return !isNaN(parsed) && parsed > 0;
    }, 'Amount must be greater than 0'),
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
        
        const inputDate = new Date(val);
        const today = new Date();
        // Set both dates to start of day for comparison
        inputDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        return inputDate > today;
      },
      'Target date must be in the future.',
    ),
  description: z.string().optional(),
}); 

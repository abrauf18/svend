import 'server-only';

import { SupabaseClient } from '@supabase/supabase-js';

import { getLogger } from '@kit/shared/logger';
import { Database } from '@kit/supabase/database';

export function createAccountOnboardingService() {
  return new AccountOnboardingService();
}

/**
 * @name AccountOnboardingService
 * @description Service for common account onboarding operations
 * @param Database - The Supabase database type to use
 * @example
 * const client = getSupabaseClient();
 * const accountsService = new DeletePersonalAccountService();
 */
class AccountOnboardingService {
  private namespace = 'accounts.onboarding';

  /**
   * @name updateContextKey
   * Update the context key for a user during onboarding.
   * This method validates the context key and updates it in the database.
   */
  async updateContextKey(params: {
    supabase: SupabaseClient<Database>;
    userId: string;
    contextKey: string;
    validContextKeys: string[];
  }): Promise<string | null> {
    const logger = await getLogger();

    const { supabase, userId, contextKey, validContextKeys } = params;

    // Fetch the current onboardingstate
    const { data: dbOnboardingData, error: fetchOnboardingError } = await supabase
      .from('onboarding')
      .select('state')
      .eq('account_id', userId)
      .single();

    if (fetchOnboardingError) {
      console.error('Error fetching onboarding state:', fetchOnboardingError);
      throw fetchOnboardingError;
    }

    let dbUpdatedOnboardingState = dbOnboardingData.state as any;

    // validate contextKey
    const currentIndex = validContextKeys.indexOf(dbUpdatedOnboardingState.account.contextKey);
    if (currentIndex === -1) {
      if (!['start', 'plaid'].includes(dbUpdatedOnboardingState.account.contextKey)) {
        throw new Error('Invalid contextKey value found in onboarding state');
      } else if (dbUpdatedOnboardingState.account.contextKey === 'start' || contextKey !== 'profile_goals') {
        return `Invalid contextKey transition: ${dbUpdatedOnboardingState.account.contextKey} -> ${contextKey}`;
      }
    } else {
      if (contextKey !== validContextKeys[currentIndex - 1] && contextKey !== validContextKeys[currentIndex + 1]) {
        return `Invalid contextKey transition: ${dbUpdatedOnboardingState.account.contextKey} -> ${contextKey}`;
      }
    }

    // validate data state for contextKey transition
    const budgetId = dbUpdatedOnboardingState.account.budgetId;

    // 'plaid' -> 'profile_goals'
    // validate plaid - at least one budget_plaid_accounts row is present
    if (contextKey === 'profile_goals') {
      if (!budgetId) {
        console.error('BudgetId not found in onboarding state');
        throw new Error('BudgetId not found in onboarding state');
      }

      const { data: plaidAccounts, error: plaidAccountsError } = await supabase
        .from('budget_plaid_accounts')
        .select('*')
        .eq('budget_id', budgetId)
        .limit(1);

      if (plaidAccountsError) {
        console.error('Error fetching plaid accounts:', plaidAccountsError);
        throw plaidAccountsError;
      }

      if (!plaidAccounts || plaidAccounts.length === 0) {
        return 'No Plaid accounts found for budget';
      }
    }

    // 'profile_goals' -> 'analyze_spending'
    // validate profile and goals - acct_fin_profile must be filled out with required fields
    if (contextKey === 'analyze_spending') {
      const { data: acctFinProfile, error: acctFinProfileError } = await supabase
        .from('acct_fin_profile')
        .select('*')
        .eq('account_id', userId)
        .single();

      if (acctFinProfileError) {
        console.error('Error fetching account financial profile:', acctFinProfileError);
        throw acctFinProfileError;
      }

      if (!acctFinProfile || !acctFinProfile.full_name || !acctFinProfile.age || !acctFinProfile.marital_status || acctFinProfile.dependents === null || !acctFinProfile.income_level || !acctFinProfile.savings) {
        return 'Incomplete account financial profile';
      }

      // const { data: budgetGoals, error: budgetGoalsError } = await supabase
      //   .from('budget_goals')
      //   .select('*')
      //   .eq('budget_id', budgetId)
      //   .single();

      // if (budgetGoalsError) {
      //   console.error('Error fetching budget goals:', budgetGoalsError);
      //   throw budgetGoalsError;
      // }

      // if (!budgetGoals || !budgetGoals.primary_goal || !budgetGoals.goal_timeline || !budgetGoals.monthly_contribution) {
      //   console.error('Incomplete budget goals');
      //   return false;
      // }
    }

    // 'analyze_spending' -> 'analyze_spending_in_progress'
    // No additional validation needed

    // 'analyze_spending_in_progress' -> 'budget_setup'
    // validate category spending - budgets.category_spending must be present and valid
    if (contextKey === 'budget_setup') {
      const { data: budget, error: budgetError } = await supabase
        .from('budgets')
        .select('category_spending')
        .eq('id', budgetId)
        .single();

      if (budgetError) {
        console.error('Error fetching budget:', budgetError);
        throw budgetError;
      }

      // TODO: improve JSON validation
      if (!budget || !budget.category_spending || Object.keys(budget.category_spending).length === 0) {
        return 'Category spending not set for budget';
      }
    }

    // 'budget_setup' -> 'end'
    // No additional validation needed

    dbUpdatedOnboardingState.account.contextKey = contextKey;

    // Update the state in the database
    const { error: onboardingUpdateError } = await supabase
      .from('onboarding')
      .update({ state: dbUpdatedOnboardingState })
      .eq('account_id', userId);

    if (onboardingUpdateError) {
      console.error('Error updating onboarding state:', onboardingUpdateError);
      throw onboardingUpdateError;
    }

    return null; // Success case
  }
}

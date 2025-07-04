import 'server-only';

import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@kit/supabase/database';
import { createBudgetService, IBudgetService, BudgetAnalysisResult, OnboardingRecommendSpendingAndGoalsResult } from './budget.service';
import { Configuration } from 'plaid';

/**
 * @name OnboardingService
 * @description Service for common account onboarding operations
 * @param supabase - The Supabase client instance
 */
class OnboardingService {
  private supabase: SupabaseClient<Database>;
  private plaidConfiguration?: Configuration;

  private budgetService: IBudgetService;
  private namespace = 'accounts.onboarding';

  constructor(supabase: SupabaseClient<Database>, plaidConfiguration?: Configuration) {
    this.supabase = supabase;
    this.budgetService = createBudgetService(supabase);
    this.plaidConfiguration = plaidConfiguration;
  }

  /**
   * @name getAccountState
   * Fetch the onboarding state for a user account.
   */
  async getAccountState(userId: string): Promise<ServiceResult<AccountState>> {
    const { data: dbOnboardingData, error: fetchOnboardingError } = await this.supabase
      .from('user_onboarding')
      .select('state->account')
      .eq('user_id', userId)
      .single();

    if (fetchOnboardingError) {
      return {
        data: null,
        error: `Error fetching onboarding state: ${fetchOnboardingError.message}`
      };
    }

    return {
      data: {
        budgetId: (dbOnboardingData.account as any).budgetId,
        contextKey: (dbOnboardingData.account as any).contextKey
      },
      error: null
    };
  }

  /**
   * @name getBudgetState
   * Fetch the onboarding state for a specific budget.
   */
  async getBudgetState(budgetId: string): Promise<ServiceResult<BudgetState>> {
    const { data: budget, error: fetchBudgetError } = await this.supabase
      .from('budgets')
      .select('id, current_onboarding_step')
      .eq('id', budgetId)
      .single();

    if (fetchBudgetError) {
      return {
        data: null,
        error: `Error fetching budget state: ${fetchBudgetError.message}`
      };
    }

    return {
      data: {
        budgetId: budget.id,
        contextKey: budget.current_onboarding_step
      },
      error: null
    };
  }

  /**
 * @name updateContextKey
 * Update the context key for a user during onboarding.
 * This method validates the context key and updates it in the database.
 */
  async updateContextKey(params: {
    userId: string;
    contextKey: string;
    validContextKeys: string[];
  }): Promise<ServiceResult<null>> {
    const { userId, contextKey, validContextKeys } = params;

    // Fetch the current onboarding state
    const { data: dbOnboardingData, error: fetchOnboardingError } = await this.supabase
      .from('user_onboarding')
      .select('state')
      .eq('user_id', userId)
      .single();

    if (fetchOnboardingError) {
      return {
        data: null,
        error: `Error fetching onboarding state: ${fetchOnboardingError.message}`
      };
    }

    let dbUpdatedOnboardingState = dbOnboardingData.state as any;

    // validate contextKey
    const currentIndex = validContextKeys.indexOf(dbUpdatedOnboardingState.account.contextKey);
    if (currentIndex === -1) {
      if (!['start', 'plaid', 'manual'].includes(dbUpdatedOnboardingState.account.contextKey)) {
        return {
          data: null,
          error: 'Invalid contextKey value found in onboarding state'
        };
      } else if (dbUpdatedOnboardingState.account.contextKey === 'start' || contextKey !== 'profile_goals') {
        return {
          data: null,
          error: `Invalid contextKey transition: ${dbUpdatedOnboardingState.account.contextKey} -> ${contextKey}`
        };
      }
    } else {
      if (contextKey !== validContextKeys[currentIndex - 1] && contextKey !== validContextKeys[currentIndex + 1]) {
        return {
          data: null,
          error: `Invalid contextKey transition: ${dbUpdatedOnboardingState.account.contextKey} -> ${contextKey}`
        };
      }
    }

    // validate data state for contextKey transition

    // Validate transitions based on contextKey
    if (contextKey === 'profile_goals') {
      if (!dbUpdatedOnboardingState.account.budgetId) {
        return { data: null, error: 'BudgetId not found in onboarding state' };
      }

      const { error: plaidAccountsError } = await this.budgetService.hasLinkedFinAccounts(dbUpdatedOnboardingState.account.budgetId);
      if (plaidAccountsError) {
        return { data: null, error: plaidAccountsError };
      }
    }

    // 'profile_goals' -> 'analyze_spending'
    // validate profile and goals - acct_fin_profile must be filled out with required fields
    if (contextKey === 'analyze_spending') {
      const { data: acctFinProfile, error: acctFinProfileError } = await this.supabase
        .from('acct_fin_profile')
        .select('*')
        .eq('account_id', userId)
        .single();

      if (acctFinProfileError) {
        console.error('Error fetching account financial profile:', acctFinProfileError);
        throw acctFinProfileError;
      }

      if (!acctFinProfile || !acctFinProfile.full_name || !acctFinProfile.age || !acctFinProfile.annual_income || !acctFinProfile.savings) {
        return { data: null, error: 'Incomplete account financial profile' };
      }
    }

    // 'analyze_spending' -> 'analyze_spending_in_progress'
    // No additional validation needed

    // 'analyze_spending_in_progress' -> 'budget_setup'
    if (contextKey === 'budget_setup') {
      const { error: budgetError } = await this.budgetService.validateBudgetReadyForOnboardingUserSetup(dbUpdatedOnboardingState.account.budgetId);
      if (budgetError) {
        return { data: null, error: budgetError };
      }
    }

    // 'budget_setup' -> 'end'
    // No additional validation needed

    dbUpdatedOnboardingState.account.contextKey = contextKey;

    // Update the state in the database
    const { error: onboardingUpdateError } = await this.supabase
      .from('user_onboarding')
      .update({ state: dbUpdatedOnboardingState })
      .eq('user_id', userId);

    if (onboardingUpdateError) {
      return {
        data: null,
        error: `Error updating onboarding state: ${onboardingUpdateError.message}`
      };
    }

    return { data: null, error: null };
  }

  /**
 * @name updateBudgetContextKey
 * Update the context key for a budget during onboarding.
 * This method validates the context key and updates it in the database.
 */
  async updateBudgetContextKey(params: {
    budgetId: string;
    contextKey: 'start' | 'plaid' | 'manual' | 'profile_goals' | 'analyze_spending' | 'analyze_spending_in_progress' | 'budget_setup' | 'invite_members' | 'end';
    validContextKeys: string[];
  }): Promise<ServiceResult<null>> {
    const { budgetId, contextKey, validContextKeys } = params;

    // Fetch the current budget state
    const { data: budget, error: fetchBudgetError } = await this.supabase
      .from('budgets')
      .select('id, current_onboarding_step')
      .eq('id', budgetId)
      .single();

    if (fetchBudgetError) {
      return {
        data: null,
        error: `Error fetching budget: ${fetchBudgetError.message}`
      };
    }

    // validate contextKey transition
    const currentStep = budget.current_onboarding_step;
    const currentIndex = validContextKeys.indexOf(currentStep);

    console.log(currentStep,validContextKeys,currentIndex)
    
    if (currentIndex === -1) {
      return {
        data: null,
        error: `Invalid current step: ${currentStep}`
      };
    }

    // Only allow moving to next or previous step
    if (contextKey !== validContextKeys[currentIndex - 1] && contextKey !== validContextKeys[currentIndex + 1]) {
      return {
        data: null,
        error: `Invalid step transition: ${currentStep} -> ${contextKey}`
      };
    }

    // Validate transitions based on contextKey
    if (contextKey === 'profile_goals') {
      const { error: plaidAccountsError } = await this.budgetService.hasLinkedFinAccounts(budgetId);
      if (plaidAccountsError) {
        return { data: null, error: plaidAccountsError };
      }
    }

    // Update the budget's onboarding step
    const { error: updateError } = await this.supabase
      .from('budgets')
      .update({ current_onboarding_step: contextKey })
      .eq('id', budgetId);

    if (updateError) {
      return {
        data: null,
        error: `Error updating budget onboarding step: ${updateError.message}`
      };
    }

    return { data: null, error: null };
  }

  async budgetAnalysis(userId: string): Promise<ServiceResult<OnboardingRecommendSpendingAndGoalsResult>> {
    try {
      // Validate onboarding state - pass through the exact error
      const { data: state, error: stateError } = await this.budgetAnalysisGetValidState(userId);
      if (stateError || !state) {
        return {
          data: null,
          error: stateError || 'SERVER_ERROR:[budgetAnalysis] Failed to validate budget analysis state'
        };
      }

      // Start analysis by updating context
      const startResult = await this.updateContextKey({
        userId,
        contextKey: 'analyze_spending_in_progress',
        validContextKeys: ['profile_goals', 'analyze_spending', 'analyze_spending_in_progress', 'budget_setup', 'end']
      });

      if (startResult.error) {
        await this.budgetAnalysisRollbackState(userId);
        return {
          data: null,
          error: `SERVER_ERROR:[budgetAnalysis.updateContextKey] ${startResult.error}`
        };
      }

      const budgetService = createBudgetService(this.supabase);

      try {
        // Fetch Plaid items and manual institution IDs in parallel
        const [itemSummariesResult, manualInstitutionIdsResult] = await Promise.all([
          budgetService.getPlaidConnectionItemSummaries(state.budgetId),
          budgetService.getManualInstitutionIds(state.budgetId)
        ]);

        const { data: itemSummaries, error: itemsError } = itemSummariesResult;
        if (itemsError || !itemSummaries) {
          throw new Error(itemsError || 'Failed to fetch Plaid connection items');
        }

        const { data: manualInstitutionIds, error: manualInstitutionIdsError } = manualInstitutionIdsResult;
        if (manualInstitutionIdsError || !manualInstitutionIds) {
          throw new Error(manualInstitutionIdsError || 'Failed to fetch manual institution IDs');
        }

        // remove duplicates from manualInstitutionIds
        const uniqueManualInstitutionIds = [...new Set(manualInstitutionIds)];

        // Perform analysis
        const { data: analysisResult, error: analysisError } =
          await budgetService.onboardingAnalysis(state.budgetId, itemSummaries, this.plaidConfiguration!, uniqueManualInstitutionIds);

        if (analysisError || !analysisResult?.spendingRecommendations || !analysisResult?.spendingTrackings) {
          throw new Error(analysisError || 'No recommendations or tracking data generated');
        }

        if (!Object.keys(analysisResult.spendingRecommendations.balanced).length) {
          throw new Error('No balanced spending recommendations generated');
        } else if (!Object.keys(analysisResult.spendingRecommendations.conservative).length) {
          throw new Error('No conservative spending recommendations generated');
        } else if (!Object.keys(analysisResult.spendingRecommendations.relaxed).length) {
          throw new Error('No relaxed spending recommendations generated');
        }

        // Update recommendations and tracking
        const { error: updateError } = await budgetService.updateSpending(
          state.budgetId,
          analysisResult.spendingRecommendations,
          analysisResult.spendingTrackings
        );

        if (updateError) {
          throw new Error(updateError);
        }

        const { error: updateGoalTrackingsError } = await budgetService.updateGoalSpending(state.budgetId, analysisResult.goalSpendingRecommendations!, analysisResult.goalSpendingTrackings!);
        if (updateGoalTrackingsError) {
          throw new Error(updateGoalTrackingsError);
        }

        // Only advance to budget_setup if everything succeeded
        const completeResult = await this.updateContextKey({
          userId,
          contextKey: 'budget_setup',
          validContextKeys: ['profile_goals', 'analyze_spending', 'analyze_spending_in_progress', 'budget_setup', 'end']
        });

        if (completeResult.error) {
          throw new Error(completeResult.error);
        }

        return { data: analysisResult, error: null };

      } catch (error: any) {
        // Ensure rollback happens for any error in the analysis process
        await this.budgetAnalysisRollbackState(userId);
        return {
          data: null,
          error: `SERVER_ERROR:[budgetAnalysis] ${error.message}`
        };
      }

    } catch (error: any) {
      console.error('[budgetAnalysis] Unexpected error:', error);
      await this.budgetAnalysisRollbackState(userId);
      return {
        data: null,
        error: `SERVER_ERROR:[budgetAnalysis] Unexpected error: ${error.message}`
      };
    }
  }


  /**
   * New method for budget analysis that works with the multi-budget approach
   */
  async budgetAnalysisForBudget(
    userId: string, 
    budgetId: string,
    currentStep: string
  ): Promise<ServiceResult<OnboardingRecommendSpendingAndGoalsResult>> {
    try {
      // Validate onboarding state
      if (currentStep !== 'analyze_spending') {
        if (currentStep === 'analyze_spending_in_progress') {
          return {
            data: null,
            error: 'CLIENT_ERROR:Already analyzing spending'
          };
        } else {
          return {
            data: null,
            error: `CLIENT_ERROR:Invalid budget state: ${currentStep}`
          };
        }
      }

      // Start analysis by updating budget context
      const startResult = await this.updateBudgetContextKey({
        budgetId,
        contextKey: 'analyze_spending_in_progress',
        validContextKeys: ['profile_goals', 'analyze_spending', 'analyze_spending_in_progress', 'budget_setup', 'end']
      });

      if (startResult.error) {
        await this.budgetAnalysisRollbackBudgetState(budgetId);
        return {
          data: null,
          error: `SERVER_ERROR:[budgetAnalysisForBudget.updateBudgetContextKey] ${startResult.error}`
        };
      }

      return await this.performBudgetAnalysis(budgetId);

    } catch (error: any) {
      console.error('[budgetAnalysisForBudget] Unexpected error:', error);
      await this.budgetAnalysisRollbackBudgetState(budgetId);
      return {
        data: null,
        error: `SERVER_ERROR:[budgetAnalysisForBudget] Unexpected error: ${error.message}`
      };
    }
  }

  /**
   * Core budget analysis logic extracted to be used by both legacy and new method
   */
  private async performBudgetAnalysis(budgetId: string): Promise<ServiceResult<OnboardingRecommendSpendingAndGoalsResult>> {
    try {
      const budgetService = createBudgetService(this.supabase);

      // Fetch Plaid items and manual institution IDs in parallel
      const [itemSummariesResult, manualInstitutionIdsResult] = await Promise.all([
        budgetService.getPlaidConnectionItemSummaries(budgetId),
        budgetService.getManualInstitutionIds(budgetId)
      ]);

      const { data: itemSummaries, error: itemsError } = itemSummariesResult;
      if (itemsError || !itemSummaries) {
        throw new Error(itemsError || 'Failed to fetch Plaid connection items');
      }

      const { data: manualInstitutionIds, error: manualInstitutionIdsError } = manualInstitutionIdsResult;
      if (manualInstitutionIdsError || !manualInstitutionIds) {
        throw new Error(manualInstitutionIdsError || 'Failed to fetch manual institution IDs');
      }

      // remove duplicates from manualInstitutionIds
      const uniqueManualInstitutionIds = [...new Set(manualInstitutionIds)];

      // Perform analysis
      const { data: analysisResult, error: analysisError } =
        await budgetService.onboardingAnalysis(budgetId, itemSummaries, this.plaidConfiguration!, uniqueManualInstitutionIds);

      if (analysisError || !analysisResult?.spendingRecommendations || !analysisResult?.spendingTrackings) {
        throw new Error(analysisError || 'No recommendations or tracking data generated');
      }

      if (!Object.keys(analysisResult.spendingRecommendations.balanced).length) {
        throw new Error('No balanced spending recommendations generated');
      } else if (!Object.keys(analysisResult.spendingRecommendations.conservative).length) {
        throw new Error('No conservative spending recommendations generated');
      } else if (!Object.keys(analysisResult.spendingRecommendations.relaxed).length) {
        throw new Error('No relaxed spending recommendations generated');
      }

      // Update recommendations and tracking
      const { error: updateError } = await budgetService.updateSpending(
        budgetId,
        analysisResult.spendingRecommendations,
        analysisResult.spendingTrackings
      );

      if (updateError) {
        throw new Error(updateError);
      }

      const { error: updateGoalTrackingsError } = await budgetService.updateGoalSpending(budgetId, analysisResult.goalSpendingRecommendations!, analysisResult.goalSpendingTrackings!);
      if (updateGoalTrackingsError) {
        throw new Error(updateGoalTrackingsError);
      }

      // Only advance to budget_setup if everything succeeded
      const completeResult = await this.updateBudgetContextKey({
        budgetId,
        contextKey: 'budget_setup',
        validContextKeys: ['profile_goals', 'analyze_spending', 'analyze_spending_in_progress', 'budget_setup', 'end']
      });

      if (completeResult.error) {
        throw new Error(completeResult.error);
      }

      return { data: analysisResult, error: null };
    } catch (error: any) {
      return {
        data: null,
        error: `SERVER_ERROR:[performBudgetAnalysis] ${error.message}`
      };
    }
  }

  async budgetAnalysisGetValidState(userId: string): Promise<ServiceResult<AccountState>> {
    const { data: state, error: stateError } = await this.getAccountState(userId);

    if (stateError || !state?.budgetId) {
      return {
        data: null,
        error: `SERVER_ERROR:${stateError || 'Failed to get account state'}`
      };
    }

    switch (state.contextKey) {
      case 'analyze_spending_in_progress':
        return {
          data: null,
          error: 'Already analyzing spending'
        };
      case 'analyze_spending':
        break; // Valid state, do nothing
      default:
        return {
          data: null,
          error: `CLIENT_ERROR:Invalid state: ${state.contextKey}`
        };
    }

    return { data: state, error: null };
  }

  private async budgetAnalysisRollbackState(userId: string): Promise<void> {
    try {
      const result = await this.updateContextKey({
        userId,
        contextKey: 'analyze_spending',
        validContextKeys: ['profile_goals', 'analyze_spending', 'analyze_spending_in_progress', 'budget_setup', 'end']
      });

      if (result.error) {
        console.error('Failed to rollback context key:', result.error);
      }
    } catch (error) {
      console.error('Unexpected error during rollback:', error);
    }
  }

  private async budgetAnalysisRollbackBudgetState(budgetId: string): Promise<void> {
    try {
      const result = await this.updateBudgetContextKey({
        budgetId,
        contextKey: 'analyze_spending',
        validContextKeys: ['profile_goals', 'analyze_spending', 'analyze_spending_in_progress', 'budget_setup', 'end']
      });

      if (result.error) {
        console.error('Failed to rollback budget context key:', result.error);
      }
    } catch (error) {
      console.error('Unexpected error during budget rollback:', error);
    }
  }
}

/**
 * Creates an instance of the OnboardingService.
 * @param supabaseClient - The Supabase client instance
 * @returns An instance of OnboardingService.
 */
export function createOnboardingService(supabaseClient: SupabaseClient, plaidConfiguration?: Configuration) {
  return new OnboardingService(supabaseClient, plaidConfiguration);
}


export type AccountState = {
  budgetId: string;
  contextKey: string;
};

export type BudgetState = {
  budgetId: string;
  contextKey: string;
};

export type ServiceResult<T> = {
  data: T | null;
  error: string | null;
};
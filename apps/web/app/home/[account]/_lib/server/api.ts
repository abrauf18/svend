import { SupabaseClient } from '@supabase/supabase-js';

import { Database } from '@kit/supabase/database';
import { createCategoryService } from '~/lib/server/category.service';
import { createPlaidClient } from '~/lib/server/plaid.service';
import { createTransactionService, PlaidSyncTransactionsResponse } from '~/lib/server/transaction.service';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { createSpendingService } from '~/lib/server/spending.service';
import { createBudgetService } from '~/lib/server/budget.service';

/**
 * Class representing an API for interacting with team accounts.
 * @constructor
 * @param {SupabaseClient<Database>} client - The Supabase client instance.
 */
export class TeamBudgetsApi {
  constructor(private readonly client: SupabaseClient<Database>) { }

  private categoryService = createCategoryService(this.client);
  private transactionService = createTransactionService(this.client);
  private plaidClient = createPlaidClient();

  /**
   * @name getBudgetWorkspace
   * @description Get the budget workspace data.
   * @param slug
   */
  async getBudgetWorkspace(slug: string) {
    // First sync Plaid transactions and await the result
    const supabaseAdmin = getSupabaseServerAdminClient();
    const adminTransactionService = createTransactionService(supabaseAdmin);

    const [syncResult, budgetResult] = await Promise.all([
      adminTransactionService.syncPlaidTransactionsByTeamAccountSlug(
        slug,
        this.plaidClient
      ),
      this.client.rpc('get_budget_by_team_account_slug', {
        p_team_account_slug: slug,
      }).single()
    ]);

    if (syncResult.error) {
      return { error: syncResult.error, data: null };
    }

    if (budgetResult.error) {
      return { error: budgetResult.error, data: null };
    }

    const { data: syncData } = syncResult;
    const { data: budget } = budgetResult;

    const spendingError = await this.updateSpendingForTransactions(budget.id, syncData, supabaseAdmin);
    if (spendingError) {
      return { error: spendingError, data: null };
    }

    const parsedBudget = createBudgetService(this.client).parseBudget(budget);
    if (!parsedBudget) {
      return { error: 'Budget not found', data: null };
    }

    const accountPromise = this.client.rpc('team_account_workspace', {
      account_slug: slug,
    }).single();

    const accountsPromise = this.client.from('user_accounts').select('*');


    const budgetTransactionsPromise = this.client.rpc('get_budget_transactions_by_team_account_slug', {
      p_team_account_slug: slug,
    });

    const budgetRecurringTransactionsPromise = this.client.rpc('get_budget_recurring_transactions_by_team_account_slug', {
      p_team_account_slug: slug,
    });

    const budgetCategoriesPromise = this.categoryService.getBudgetCategoryGroups(parsedBudget.id);

    const budgetTagsPromise = this.client.rpc('get_budget_tags_by_team_account_slug', {
      p_team_account_slug: slug,
    });

    // Then fetch all other data in parallel
    const [
      accountResult,
      accountsResult,
      budgetTransactionsResult,
      budgetRecurringTransactionsResult,
      budgetCategoriesResult,
      budgetTagsResult
    ] = await Promise.all([
      accountPromise,
      accountsPromise,
      budgetTransactionsPromise,
      budgetRecurringTransactionsPromise,
      budgetCategoriesPromise,
      budgetTagsPromise
    ]);

    if (accountResult.error) {
      return {
        error: accountResult.error,
        data: null,
      };
    }

    const accountData = accountResult.data;

    if (!accountData) {
      return {
        error: new Error('Account data not found'),
        data: null,
      };
    }

    if (accountsResult.error) {
      return {
        error: accountsResult.error,
        data: null,
      };
    }

    if (budgetTransactionsResult.error) {
      return {
        error: budgetTransactionsResult.error,
        data: null,
      };
    }

    if (budgetRecurringTransactionsResult.error) {
      return {
        error: budgetRecurringTransactionsResult.error,
        data: null,
      };
    }

    if (budgetTagsResult.error) {
      return {
        error: budgetTagsResult.error,
        data: null,
      };
    }

    return {
      data: {
        account: accountData,
        accounts: accountsResult.data,
        budget: budget,
        budgetTransactions: budgetTransactionsResult.data,
        budgetRecurringTransactions: budgetRecurringTransactionsResult.data,
        budgetCategories: budgetCategoriesResult,
        budgetTags: budgetTagsResult.data,
      },
      error: null,
    };
  }

  /**
   * @name hasPermission
   * @description Check if the user has permission for the account.
   */
  async hasPermission(params: {
    teamAccountId: string;
    userId: string;
    permission: Database['public']['Enums']['app_permissions'];
  }) {
    const { data, error } = await this.client.rpc('has_team_permission', {
      team_account_id: params.teamAccountId,
      user_id: params.userId,
      permission_name: params.permission,
    });

    if (error) {
      throw error;
    }

    return data;
  }
  
  private async updateSpendingForTransactions(
    budgetId: string,
    syncData: PlaidSyncTransactionsResponse | null,
    supabaseAdmin: SupabaseClient<Database>
  ): Promise<string | null> {
    if (!budgetId || !syncData?.newTransactions.length && !syncData?.modifiedTransactions.length) {
      return null;
    }
  
    const spendingService = createSpendingService(supabaseAdmin);
    const months = [...new Set([
      ...syncData.newTransactions.map(tx => tx.transaction.date.substring(0, 7)),
      ...syncData.modifiedTransactions.map(tx => tx.transaction.date.substring(0, 7))
    ])];
    
    const { error: spendingError } = await spendingService.updateRecalculateSpending(budgetId, months);
  
    if (spendingError) {
      console.error('[TeamBudgetsApi] Failed to update spending:', spendingError);
      return spendingError;
    }
  
    return null;
  }

  /**
   * @name getMembersCount
   * @description Get the number of members in the account.
   * @param accountId
   */
  async getMembersCount(accountId: string) {
    const { count, error } = await this.client
      .from('team_memberships')
      .select('*', {
        head: true,
        count: 'exact',
      })
      .eq('account_id', accountId);

    if (error) {
      throw error;
    }

    return count;
  }

  /**
   * @name getCustomerId
   * @description Get the billing customer ID for the given account.
   * @param accountId
   */
  async getCustomerId(accountId: string) {
    const { data, error } = await this.client
      .from('billing_customers')
      .select('customer_id')
      .eq('account_id', accountId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data?.customer_id;
  }

  /**
   * @name getInvitation
   * @description Get the invitation data from the invite token.
   * @param adminClient - The admin client instance. Since the user is not yet part of the account, we need to use an admin client to read the pending membership
   * @param token - The invitation token.
   */
  async getInvitation(adminClient: SupabaseClient<Database>, token: string) {
    const { data: invitation, error } = await adminClient
      .from('invitations')
      .select<
        string,
        {
          id: string;
          account: {
            id: string;
            name: string;
            slug: string;
            picture_url: string;
          };
        }
      >(
        'id, expires_at, account: account_id !inner (id, name, slug, picture_url)',
      )
      .eq('invite_token', token)
      .gte('expires_at', new Date().toISOString())
      .single();

    if (error ?? !invitation) {
      return null;
    }

    return invitation;
  }
}

export function createTeamBudgetsApi(client: SupabaseClient<Database>) {
  return new TeamBudgetsApi(client);
}

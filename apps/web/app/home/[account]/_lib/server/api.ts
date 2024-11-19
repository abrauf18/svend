import { SupabaseClient } from '@supabase/supabase-js';

import { Database } from '@kit/supabase/database';
import { createCategoryService } from '~/lib/server/category.service';

/**
 * Class representing an API for interacting with team accounts.
 * @constructor
 * @param {SupabaseClient<Database>} client - The Supabase client instance.
 */
export class TeamBudgetsApi {
  constructor(private readonly client: SupabaseClient<Database>) {}

  private categoryService = createCategoryService(this.client);

  /**
   * @name getBudgetWorkspace
   * @description Get the budget workspace data.
   * @param slug
   */
  async getBudgetWorkspace(slug: string) {
    const accountPromise = this.client.rpc('team_account_workspace', {
      account_slug: slug,
    });
    
    const accountsPromise = this.client.from('user_accounts').select('*');

    const budgetPromise = this.client.rpc('get_budget_by_team_account_slug', {
      p_team_account_slug: slug,
    });

    const budgetTransactionsPromise = this.client.rpc('get_budget_transactions_by_team_account_slug', {
      p_team_account_slug: slug,
    });

    const budgetCategoriesPromise = this.categoryService.getBudgetCategoryGroupsByTeamAccountSlug(slug);

    const [accountResult, accountsResult, budgetResult, budgetTransactionsResult, budgetCategoriesResult] = await Promise.all([
      accountPromise,
      accountsPromise,
      budgetPromise,
      budgetTransactionsPromise,
      budgetCategoriesPromise,
    ]);

    if (accountResult.error) {
      return {
        error: accountResult.error,
        data: null,
      };
    }

    const accountData = accountResult.data[0];

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

    if (budgetResult.error) {
      return {
        error: budgetResult.error,
        data: null,
      };
    }

    if (budgetTransactionsResult.error) {
      return {
        error: budgetTransactionsResult.error,
        data: null,
      };
    }

    return {
      data: {
        account: accountData,
        accounts: accountsResult.data,
        budget: budgetResult.data[0]!,
        budgetTransactions: budgetTransactionsResult.data,
        budgetCategories: budgetCategoriesResult,
      },
      error: null,
    };
  }

  /**
   * @name hasPermission
   * @description Check if the user has permission to manage billing for the account.
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

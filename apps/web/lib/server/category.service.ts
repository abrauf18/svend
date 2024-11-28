import { CategoryGroup } from '../model/fin.types';
import plaidSvendCategories from '../config/plaid_svend_categories.json';
import { SupabaseClient } from '@supabase/supabase-js';
import { BudgetCategoryGroups } from '../model/budget.types';
import { Database } from '../database.types';

/**
 * @name CategoryService
 * @description Service for category-related operations
 */
class CategoryService implements ICategoryService {
  private supabase: SupabaseClient<Database>;

  constructor(supabaseClient: SupabaseClient<Database>) {
    this.supabase = supabaseClient;
  }

  /**
   * Fetches the default category groups from the Supabase database.
   * @returns A promise that resolves to a record of category groups.
   */
  async getSvendDefaultCategoryGroups(): Promise<BudgetCategoryGroups> {
    const { data, error } = await this.supabase
      .from('built_in_categories')
      .select('*'); // Assuming group_id is available in the query

    if (error) {
      console.error('Error fetching Svend default categories:', error);
      return {};
    }

    const categoryMap: BudgetCategoryGroups = {};

    data?.forEach((category) => {
      const groupId = category.group_id as string;
      if (!categoryMap[groupId]) {
        categoryMap[groupId] = {
          id: groupId,
          name: category.group_name as string,
          description: category.group_description as string,
          isEnabled: category.group_is_enabled as boolean,
          createdAt: category.group_created_at as string,
          updatedAt: category.group_updated_at as string,
          categories: [] // Initialize categories array
        };
      }
      categoryMap[groupId].categories.push({
        id: category.category_id as string,
        name: category.category_name as string,
        description: category.category_description as string,
        createdAt: category.category_created_at as string,
        updatedAt: category.category_updated_at as string,
      });
    });

    return categoryMap;
  }

  /**
   * Fetches the default category groups from the Supabase database.
   * @returns A promise that resolves to a record of category groups.
   */
  async getBudgetCategoryGroupsByTeamAccountSlug(team_account_slug: string): Promise<BudgetCategoryGroups> {
    const { data, error } = await this.supabase
      .from('budgets')
      .select('budget_id:id, accounts!inner(slug)')
      .eq('accounts.slug', team_account_slug)
      .single();

    if (error) {
      console.error('Error fetching budget by team account slug:', error);
      return {};
    }

    const budget_id = data?.budget_id;

    if (!budget_id) {
      console.error('No budget found for team account slug:', team_account_slug);
      return {};
    }

    return this.getBudgetCategoryGroups(budget_id);
  }

  /**
 * Fetches the default category groups from the Supabase database.
 * @returns A promise that resolves to a record of category groups.
 */
  async getBudgetCategoryGroups(budget_id: string): Promise<BudgetCategoryGroups> {
    const { data, error } = await this.supabase.rpc('get_budget_categories', {
      p_budget_id: budget_id
    });

    if (error) {
      console.error('Error fetching budget categories:', error);
      return {};
    }

    const categoryGroups: BudgetCategoryGroups = {};

    data?.forEach((category) => {
      const groupName = category.group_name;
      if (!categoryGroups[groupName]) {
        categoryGroups[groupName] = {
          id: category.group_id as string,
          budgetId: category.group_budget_id,
          name: groupName,
          description: category.group_description,
          isEnabled: category.group_is_enabled,
          createdAt: category.group_created_at,
          updatedAt: category.group_updated_at,
          categories: []
        };
      }

      if (category.category_id && category.category_name) {
        categoryGroups[groupName].categories.push({
          id: category.category_id,
          budgetId: category.category_budget_id,
          name: category.category_name,
          description: category.category_description,
          createdAt: category.category_created_at,
          updatedAt: category.category_updated_at,
        });
      }
    });

    return categoryGroups;
  }

  /**
   * Maps Plaid detailed categories to Svend category IDs.
   * @param plaidDetailedCategories - An array of detailed category names from Plaid.
   * @returns A record of Plaid detailed category names to Svend categories.
   */
  async mapPlaidCategoriesToSvendCategories(plaidDetailedCategories: string[]): Promise<BudgetCategoryGroups> {
    const defaultCategoryGroups = await this.getSvendDefaultCategoryGroups();
    const categoryIdMap = Object.fromEntries(
      Object.values(defaultCategoryGroups).flatMap(group =>
        group.categories.map(category => [category.name, category.id])
      )
    );

    const svendCategories = plaidDetailedCategories
      .map(plaidCategory => [plaidCategory, this.mapPlaidDetailedCategoryToSvend(plaidCategory)])
      .map(([plaidCategory, svendCategoryName]) => [plaidCategory, {
        id: categoryIdMap[svendCategoryName as string],
        name: svendCategoryName,
      }]);

    return Object.fromEntries(svendCategories);
  }

  /**
   * Maps a Plaid detailed category to a Svend category.
   * @param plaidDetailedCategory - The detailed category name from Plaid.
   * @returns The corresponding Svend category name or 'Other'.
   */
  private mapPlaidDetailedCategoryToSvend(plaidDetailedCategory: string): string {
    const plaidSvendCategoryMapping = plaidSvendCategories as any;
    return plaidSvendCategoryMapping[plaidDetailedCategory] || 'Other';
  }
}

/**
 * Creates an instance of the CategoryService.
 * @param supabaseClient - The Supabase client instance
 * @returns An instance of CategoryService.
 */
export function createCategoryService(supabaseClient: SupabaseClient): ICategoryService {
  return new CategoryService(supabaseClient);
}

export interface ICategoryService {
  getSvendDefaultCategoryGroups: () => Promise<BudgetCategoryGroups>;
  getBudgetCategoryGroupsByTeamAccountSlug: (team_account_slug: string) => Promise<BudgetCategoryGroups>;
  getBudgetCategoryGroups: (budget_id: string) => Promise<BudgetCategoryGroups>;
  mapPlaidCategoriesToSvendCategories: (plaidDetailedCategories: string[]) => Promise<BudgetCategoryGroups>;
}

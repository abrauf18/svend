import { Category, CategoryGroup } from '../model/fin.types';
import plaidSvendCategories from '../config/plaid_svend_categories.json';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * @name CategoryService
 * @description Service for category-related operations
 * @example
 * const categoryService = new CategoryService();
 */
class CategoryService {
  private supabase: SupabaseClient;

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient
  }

  /**
   * Fetches the default category groups from the Supabase database.
   * @returns A promise that resolves to a record of category groups.
   */
  async getSvendDefaultCategoryGroups(): Promise<Record<string, CategoryGroup>> {
    const { data, error } = await this.supabase
      .from('built_in_categories')
      .select('*'); // Assuming group_id is available in the query

    if (error) {
      console.error('Error fetching Svend default categories:', error);
      return {};
    }

    const categoryMap: Record<string, CategoryGroup> = {};

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
  async getBudgetCategoryGroupsByTeamAccountSlug(team_account_slug: string): Promise<Record<string, CategoryGroup>> {
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
  async getBudgetCategoryGroups(budget_id: string): Promise<Record<string, CategoryGroup>> {
    const { data, error } = await this.supabase.rpc('get_budget_categories', {
      p_budget_id: budget_id
    });

    if (error) {
      console.error('Error fetching Svend default categories:', error);
      return {};
    }

    const categoryMap: Record<string, CategoryGroup> = {};

    data?.forEach((category: any) => {
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
   * Maps Plaid detailed categories to Svend category IDs.
   * @param plaidDetailedCategories - An array of detailed category names from Plaid.
   * @returns A promise that resolves to an array of Svend category IDs.
   */
  async mapPlaidCategoriesToSvendCategories(plaidDetailedCategories: string[]): Promise<Record<string, Category>> {
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
 * @returns An instance of CategoryService.
 */
export function createCategoryService(supabaseClient: SupabaseClient) {
  return new CategoryService(supabaseClient);
}

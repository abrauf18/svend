import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';
 
export function createEntitlementsService(
  client: SupabaseClient<Database>,
  accountId: string
) {
  return new EntitlementsService(client, accountId);
}
 
class EntitlementsService {
  constructor(
    private readonly client: SupabaseClient<Database>,
    private readonly accountId: string
  ) {}
 
  async canUseFeature(feature: string) {
    const { data, error } = await this.client.rpc('can_use_feature', {
      p_account_id: this.accountId,
      p_feature: feature
    });
 
    if (error) throw error;
    return data;
  }
 
  async getEntitlement(feature: string) {
    const { data, error } = await this.client.rpc('get_entitlement', {
      p_account_id: this.accountId,
      p_feature: feature
    });
 
    if (error) throw error;
    return data;
  }
 
  async updateFeatureUsage(feature: string, usage: Record<string, unknown>) {
    const { error } = await this.client.rpc('update_feature_usage', {
      p_account_id: this.accountId,
      p_feature: feature,
      p_usage: JSON.stringify(usage)
    });
 
    if (error) throw error;
  }
}

import { createClient } from '@supabase/supabase-js';
import { Database } from '../../../../packages/supabase/src/database.types';

/**
 * @name getTestSupabaseClient
 * @description Get a Supabase client for use in tests with admin access to the database.
 */
export function getTestSupabaseClient<GenericSchema = Database>() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      `Missing required Supabase environment variables for testing:
      NEXT_PUBLIC_SUPABASE_URL: ${url ? 'set' : 'missing'}
      SUPABASE_SERVICE_ROLE_KEY: ${serviceRoleKey ? 'set' : 'missing'}
      Current process.env keys: ${Object.keys(process.env).join(', ')}`
    );
  }

  return createClient<GenericSchema>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      detectSessionInUrl: false,
      autoRefreshToken: false,
    },
  });
} 
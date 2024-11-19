import 'server-only';

import { cache } from 'react';

import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';
import { createTeamBudgetsApi } from './api';

export type BudgetWorkspace = Awaited<
  ReturnType<typeof loadBudgetWorkspace>
>;

/**
 * Load the account workspace data.
 * We place this function into a separate file so it can be reused in multiple places across the server components.
 *
 * This function is used in the layout component for the account workspace.
 * It is cached so that the data is only fetched once per request.
 *
 * @param accountSlug
 */
export const loadBudgetWorkspace = cache(workspaceLoader);

async function workspaceLoader(accountSlug: string) {
  const client = getSupabaseServerClient();
  const api = createTeamBudgetsApi(client);

  const [workspace, user] = await Promise.all([
    api.getBudgetWorkspace(accountSlug),
    requireUserInServerComponent(),
  ]);

  // we cannot find any record for the selected account
  // so we redirect the user to the home page
  if (!workspace.data?.account) {
    return redirect(pathsConfig.app.home);
  }

  return {
    ...workspace.data,
    user,
  };
}

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { NextResponse } from 'next/server';

// POST /api/fin-account-mgmt/plaid/account/link
export async function POST(request: Request) {
  const supabaseClient = getSupabaseServerClient();
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { plaidAccountId, budgetId } = await request.json();

  if (!plaidAccountId || !budgetId) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }

  try {
    const { data: budgetFinAccountId, error } = await supabaseClient.rpc(
      'link_budget_plaid_account',
      { p_budget_id: budgetId, p_plaid_account_id: plaidAccountId }
    );

    if (error) throw error;

    return NextResponse.json({
      success: true,
      budgetFinAccountId
    });

  } catch (error) {
    console.error('Error linking account to budget:', error);
    return NextResponse.json({ error: 'Failed to link account to budget' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const supabaseClient = getSupabaseServerClient();
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { plaidAccountId, budgetId } = await request.json();

  if (!plaidAccountId || !budgetId) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }

  try {
    const { data: success, error } = await supabaseClient.rpc(
      'unlink_budget_plaid_account',
      { p_budget_id: budgetId, p_plaid_account_id: plaidAccountId }
    );

    if (error) throw error;

    return NextResponse.json({ success });

  } catch (error) {
    console.error('Error unlinking account from budget:', error);
    return NextResponse.json({ error: 'Failed to unlink account from budget' }, { status: 500 });
  }
} 
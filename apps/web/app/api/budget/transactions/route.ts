import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { NextResponse } from 'next/server';

// PUT /api/saveTransaction
export async function PUT(request: Request) {
  const supabaseAdmin = getSupabaseServerAdminClient();

  try {
    // Parse the incoming request body (transaction data)
    const { transaction_id, new_category, category_id, merchant_name, notes, attachments } = await request.json();
    console.log('PUT /api/budget/transactions');
    console.log('transaction_id', transaction_id);
    console.log('new_category', new_category);
    console.log('category_id', category_id);
    console.log('merchant_name', merchant_name);
    console.log('notes', notes);
    console.log('attachments', attachments);
    // Perform the RPC call to save the transaction
    const { data, error } = await supabaseAdmin.rpc('save_fin_account_transaction', {
      transaction_id,
      new_category,
      p_merchant_name: merchant_name,
      p_notes: notes,
      category_id,
      attachments,
    });

    // If there's an error with the RPC, return a response with the error details
    if (error) {
      console.error('RPC error:', error.message);
      return NextResponse.json(
        { error: `Error in save_transaction RPC: ${error.message}` },
        { status: 500 }
      );
    }

    // Return success response with the data
    return NextResponse.json(
      { message: 'Transaction updated successfully', data },
      { status: 200 }
    );
  } catch (err: unknown) {
    console.error('Unexpected error:', err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Unexpected error: ${errorMessage}` },
      { status: 500 }
    );
  }
}

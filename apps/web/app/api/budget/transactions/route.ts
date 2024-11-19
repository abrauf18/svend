import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { NextResponse } from 'next/server';

// PUT /api/saveTransaction
export async function PUT(request: Request) {
  const supabaseAdmin = getSupabaseServerAdminClient();

  try {
    const { transaction_id, new_category, category_id, merchant_name, notes, attachments, tags } = await request.json();
    console.log('PUT /api/budget/transactions');
    console.log('transaction_id', transaction_id);
    console.log('new_category', new_category);
    console.log('category_id', category_id);
    console.log('merchant_name', merchant_name);
    console.log('notes', notes);
    console.log('attachments', attachments);
    console.log('tags', tags);

    // Only save transaction details if relevant fields have actual values (not undefined or empty)
    if ((new_category !== undefined && new_category !== '') || 
        (category_id !== undefined && category_id !== '') || 
        (merchant_name !== undefined && merchant_name !== '') || 
        (notes !== undefined && notes !== '') || 
        (attachments !== undefined && attachments.length > 0)) {
      console.log('Saving transaction details');
      const {error: transactionError } = await supabaseAdmin.rpc('update_fin_account_transaction', {
        p_transaction_id: transaction_id,
        p_category_id: category_id,
        p_merchant_name: merchant_name,
        p_notes: notes,
      });

      if (transactionError) {
        console.error('RPC error:', transactionError.message);
        return NextResponse.json(
          { error: `Error in save_transaction RPC: ${transactionError.message}` },
          { status: 500 }
        );
      }
    }

    // Save tags independently, even if the array is empty
    const { data, error } = await supabaseAdmin.rpc('save_transaction_tags', {
      p_transaction_id: transaction_id,
      p_tag_names: tags || [], // Ensure tags is an array, even if empty
    });

    if (error) {
      console.error('RPC error:', error.message);
      return NextResponse.json({ error: `Error in save_transaction_tags RPC: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json(
      { message: 'Transaction updated successfully' },
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


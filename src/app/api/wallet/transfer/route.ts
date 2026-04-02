import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { amount, currency, from_type, from_id, to_type, to_id } = body;

    // Validate required fields
    if (!amount || !currency || !from_type || !to_type) {
      return NextResponse.json(
        { error: 'Amount, currency, from_type, and to_type are required' },
        { status: 400 }
      );
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
    }

    // Validate transfer types
    const validTypes = ['wallet', 'trading_account'];
    if (!validTypes.includes(from_type) || !validTypes.includes(to_type)) {
      return NextResponse.json({ error: 'Invalid transfer type. Use "wallet" or "trading_account".' }, { status: 400 });
    }

    if (from_type === to_type && from_id === to_id) {
      return NextResponse.json({ error: 'Cannot transfer to the same account' }, { status: 400 });
    }

    // Verify source balance
    if (from_type === 'wallet') {
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('id, balance')
        .eq('user_id', user.id)
        .eq('currency', currency)
        .single();

      if (walletError || !wallet) {
        return NextResponse.json({ error: 'Source wallet not found' }, { status: 404 });
      }

      if (numAmount > wallet.balance) {
        return NextResponse.json(
          { error: `Insufficient wallet balance. Available: ${wallet.balance} ${currency}` },
          { status: 400 }
        );
      }
    } else {
      const { data: account, error: acctError } = await supabase
        .from('trading_accounts')
        .select('id, balance')
        .eq('id', from_id)
        .eq('user_id', user.id)
        .single();

      if (acctError || !account) {
        return NextResponse.json({ error: 'Source trading account not found' }, { status: 404 });
      }

      if (numAmount > account.balance) {
        return NextResponse.json(
          { error: `Insufficient account balance. Available: ${account.balance} ${currency}` },
          { status: 400 }
        );
      }
    }

    // Create transfer transaction
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        type: 'internal_transfer',
        amount: numAmount,
        currency,
        status: 'completed',
        payment_method: 'internal',
        reference: `TRF-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        metadata: {
          from_type,
          from_id: from_id || null,
          to_type,
          to_id: to_id || null,
        },
      })
      .select()
      .single();

    if (txError) {
      return NextResponse.json({ error: 'Failed to create transfer record' }, { status: 500 });
    }

    return NextResponse.json({
      transaction,
      message: 'Internal transfer completed successfully.',
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

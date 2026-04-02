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
    const { amount, currency, payment_method, account_id } = body;

    // Validate required fields
    if (!amount || !currency || !payment_method) {
      return NextResponse.json(
        { error: 'Amount, currency, and payment method are required' },
        { status: 400 }
      );
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
    }

    if (numAmount < 10) {
      return NextResponse.json({ error: 'Minimum withdrawal amount is $10' }, { status: 400 });
    }

    // Check balance
    if (account_id) {
      const { data: account, error: acctError } = await supabase
        .from('trading_accounts')
        .select('balance, currency')
        .eq('id', account_id)
        .eq('user_id', user.id)
        .single();

      if (acctError || !account) {
        return NextResponse.json({ error: 'Trading account not found' }, { status: 404 });
      }

      if (numAmount > account.balance) {
        return NextResponse.json(
          { error: `Insufficient balance. Available: ${account.balance} ${account.currency}` },
          { status: 400 }
        );
      }
    } else {
      // Check wallet balance
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('balance, currency')
        .eq('user_id', user.id)
        .eq('currency', currency)
        .single();

      if (walletError || !wallet) {
        return NextResponse.json({ error: 'Wallet not found for this currency' }, { status: 404 });
      }

      if (numAmount > wallet.balance) {
        return NextResponse.json(
          { error: `Insufficient balance. Available: ${wallet.balance} ${wallet.currency}` },
          { status: 400 }
        );
      }
    }

    // Check for pending withdrawals
    const { count: pendingCount } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('type', 'withdrawal')
      .eq('status', 'pending');

    if ((pendingCount || 0) >= 3) {
      return NextResponse.json(
        { error: 'You have 3 pending withdrawal requests. Please wait for processing before submitting more.' },
        { status: 400 }
      );
    }

    // Create withdrawal request
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        account_id: account_id || null,
        type: 'withdrawal',
        amount: numAmount,
        currency,
        payment_method,
        status: 'pending',
        reference: `WDR-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      })
      .select()
      .single();

    if (txError) {
      return NextResponse.json({ error: 'Failed to create withdrawal request' }, { status: 500 });
    }

    return NextResponse.json({
      transaction,
      message: 'Withdrawal request submitted. Processing time is 1-3 business days.',
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

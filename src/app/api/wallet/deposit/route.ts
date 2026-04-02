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

    // Validate amount
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
    }

    if (numAmount < 10) {
      return NextResponse.json({ error: 'Minimum deposit amount is $10' }, { status: 400 });
    }

    if (numAmount > 100000) {
      return NextResponse.json({ error: 'Maximum single deposit is $100,000. Contact support for larger amounts.' }, { status: 400 });
    }

    // Validate currency
    const allowedCurrencies = ['USD', 'EUR', 'GBP', 'AUD', 'JPY', 'CHF', 'BTC', 'ETH', 'USDT'];
    if (!allowedCurrencies.includes(currency)) {
      return NextResponse.json({ error: `Currency must be one of: ${allowedCurrencies.join(', ')}` }, { status: 400 });
    }

    // Validate payment method
    const allowedMethods = ['bank_wire', 'credit_card', 'debit_card', 'crypto', 'skrill', 'neteller'];
    if (!allowedMethods.includes(payment_method)) {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 });
    }

    // Create transaction record
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        account_id: account_id || null,
        type: 'deposit',
        amount: numAmount,
        currency,
        payment_method,
        status: 'pending',
        reference: `DEP-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      })
      .select()
      .single();

    if (txError) {
      return NextResponse.json({ error: 'Failed to create deposit record' }, { status: 500 });
    }

    return NextResponse.json({
      transaction,
      message: 'Deposit request created successfully. Processing time depends on payment method.',
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

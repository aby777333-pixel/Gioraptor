'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import {
  Wallet,
  CreditCard,
  Building2,
  Bitcoin,
  Smartphone,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  DollarSign,
} from 'lucide-react';
import { TabGroup } from '@/components/ui/TabGroup';
import { DataTable } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { KpiCard } from '@/components/ui/KpiCard';
import { formatCurrency, cn } from '@/lib/utils/format';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'deposit', label: 'Deposit' },
  { id: 'withdraw', label: 'Withdraw' },
  { id: 'transfer', label: 'Transfer' },
  { id: 'history', label: 'History' },
];

const PAYMENT_METHODS = [
  { id: 'wire', label: 'Bank Wire', icon: Building2, min: 100, processing: '1-3 days' },
  { id: 'card', label: 'Credit/Debit Card', icon: CreditCard, min: 50, processing: 'Instant' },
  { id: 'crypto', label: 'Cryptocurrency', icon: Bitcoin, min: 20, processing: '10-30 min' },
  { id: 'ewallet', label: 'E-Wallet', icon: Smartphone, min: 10, processing: 'Instant' },
];

export default function WalletPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [accounts, setAccounts] = useState<Record<string, unknown>[]>([]);
  const [transactions, setTransactions] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('card');
  const [sourceAccount, setSourceAccount] = useState('');
  const [destAccount, setDestAccount] = useState('');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: accts } = await supabase
      .from('trading_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true);

    setAccounts(accts ?? []);

    const { data: txns } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    setTransactions(txns ?? []);
    setLoading(false);
  }

  const totalBalance = accounts.reduce((s, a) => s + ((a.balance as number) ?? 0), 0);
  const totalDeposits = transactions
    .filter((t) => t.type === 'deposit' && t.status === 'approved')
    .reduce((s, t) => s + ((t.amount as number) ?? 0), 0);
  const totalWithdrawals = transactions
    .filter((t) => t.type === 'withdrawal' && t.status === 'approved')
    .reduce((s, t) => s + ((t.amount as number) ?? 0), 0);

  const txnColumns = [
    {
      key: 'created_at',
      label: 'Date',
      render: (row: Record<string, unknown>) => (
        <span className="text-foreground">
          {new Date(row.created_at as string).toLocaleDateString(undefined, {
            month: 'short', day: 'numeric', year: 'numeric',
          })}
        </span>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (row: Record<string, unknown>) => (
        <span className="capitalize font-medium text-foreground">{row.type as string}</span>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      align: 'right' as const,
      render: (row: Record<string, unknown>) => {
        const isDebit = row.type === 'withdrawal' || row.type === 'transfer_out';
        return (
          <span className={cn('mono font-semibold', isDebit ? 'text-loss' : 'text-profit')}>
            {isDebit ? '-' : '+'}{formatCurrency(row.amount as number)}
          </span>
        );
      },
    },
    {
      key: 'method',
      label: 'Method',
      render: (row: Record<string, unknown>) => (
        <span className="text-secondary capitalize">{(row.method as string) ?? '\u2014'}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: Record<string, unknown>) => (
        <StatusBadge status={row.status as string} />
      ),
    },
  ];

  if (loading) {
    return (
      <div className="space-y-5">
        <h1 className="text-lg font-bold text-foreground">Wallet</h1>
        <LoadingSkeleton variant="card" count={4} />
        <LoadingSkeleton variant="table" count={5} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-bold text-foreground">Wallet</h1>

      <TabGroup tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard label="Total Balance" value={formatCurrency(totalBalance)} icon={Wallet} />
            <KpiCard label="Total Deposits" value={formatCurrency(totalDeposits)} icon={ArrowDownToLine} />
            <KpiCard label="Total Withdrawals" value={formatCurrency(totalWithdrawals)} icon={ArrowUpFromLine} />
          </div>

          {accounts.length > 0 && (
            <div className="rounded-xl border border-border bg-elevated p-4">
              <h3 className="mb-3 text-sm font-semibold text-foreground">Account Balances</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {accounts.map((a) => (
                  <div key={a.id as string} className="rounded-lg bg-surface/50 px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-foreground">{a.account_number as string}</p>
                      <p className="text-[10px] text-muted capitalize">{(a.account_type as string).replace(/_/g, ' ')} &middot; {a.currency as string}</p>
                    </div>
                    <span className="mono text-sm font-bold text-foreground">{formatCurrency(a.balance as number, a.currency as string)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'deposit' && (
        <div className="space-y-5">
          <h3 className="text-sm font-semibold text-foreground">Select Payment Method</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PAYMENT_METHODS.map((pm) => {
              const Icon = pm.icon;
              const active = selectedMethod === pm.id;
              return (
                <button
                  key={pm.id}
                  onClick={() => setSelectedMethod(pm.id)}
                  className={cn(
                    'rounded-xl border p-4 text-left transition-colors',
                    active ? 'border-accent bg-accent/5' : 'border-border bg-elevated hover:bg-surface/50'
                  )}
                >
                  <Icon className={cn('h-6 w-6 mb-2', active ? 'text-accent' : 'text-secondary')} />
                  <p className="text-xs font-semibold text-foreground">{pm.label}</p>
                  <p className="text-[10px] text-muted">Min: ${pm.min} &middot; {pm.processing}</p>
                </button>
              );
            })}
          </div>
          <div className="rounded-xl border border-border bg-elevated p-5 max-w-md space-y-4">
            <div>
              <label className="block text-xs font-medium text-secondary mb-1">Amount (USD)</label>
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground outline-none focus:border-accent"
              />
            </div>
            <button className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/80 transition-colors btn-glow">
              Proceed to Deposit
            </button>
          </div>
        </div>
      )}

      {activeTab === 'withdraw' && (
        <div className="rounded-xl border border-border bg-elevated p-5 max-w-md space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Request Withdrawal</h3>
          <div>
            <label className="block text-xs font-medium text-secondary mb-1">Amount (USD)</label>
            <input
              type="number"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="Enter amount"
              className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-secondary mb-1">Withdrawal Method</label>
            <select className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground outline-none focus:border-accent">
              {PAYMENT_METHODS.map((pm) => (
                <option key={pm.id} value={pm.id}>{pm.label}</option>
              ))}
            </select>
          </div>
          <button className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/80 transition-colors btn-glow">
            Submit Withdrawal Request
          </button>
        </div>
      )}

      {activeTab === 'transfer' && (
        <div className="rounded-xl border border-border bg-elevated p-5 max-w-md space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Internal Transfer</h3>
          <div>
            <label className="block text-xs font-medium text-secondary mb-1">From Account</label>
            <select
              value={sourceAccount}
              onChange={(e) => setSourceAccount(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground outline-none focus:border-accent"
            >
              <option value="">Select source...</option>
              {accounts.map((a) => (
                <option key={a.id as string} value={a.id as string}>
                  {a.account_number as string} ({formatCurrency(a.balance as number)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-secondary mb-1">To Account</label>
            <select
              value={destAccount}
              onChange={(e) => setDestAccount(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground outline-none focus:border-accent"
            >
              <option value="">Select destination...</option>
              {accounts.filter((a) => (a.id as string) !== sourceAccount).map((a) => (
                <option key={a.id as string} value={a.id as string}>
                  {a.account_number as string} ({formatCurrency(a.balance as number)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-secondary mb-1">Amount</label>
            <input
              type="number"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              placeholder="Enter amount"
              className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground outline-none focus:border-accent"
            />
          </div>
          <button className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/80 transition-colors btn-glow">
            Transfer Funds
          </button>
        </div>
      )}

      {activeTab === 'history' && (
        transactions.length === 0 ? (
          <EmptyState
            icon={DollarSign}
            title="No transactions yet"
            description="Your deposit, withdrawal, and transfer history will appear here."
          />
        ) : (
          <DataTable columns={txnColumns} data={transactions} sortable />
        )
      )}
    </div>
  );
}

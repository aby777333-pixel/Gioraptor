import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  Users,
  UserCheck,
  UserPlus,
  ArrowDownToLine,
  ArrowUpFromLine,
  TrendingUp,
  BarChart3,
  DollarSign,
} from 'lucide-react';
import { KpiCard } from '@/components/ui/KpiCard';
import { DataTable } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';

export const dynamic = 'force-dynamic';

async function getBrokerKpis(brokerId: string) {
  const supabase = await createServerSupabaseClient();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Total clients
  const { count: totalClients } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('broker_id', brokerId)
    .eq('role', 'client');

  // Active traders (have traded in last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { count: activeTraders } = await supabase
    .from('trading_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('broker_id', brokerId)
    .gte('last_trade_at', thirtyDaysAgo);

  // New this month
  const { count: newThisMonth } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('broker_id', brokerId)
    .eq('role', 'client')
    .gte('created_at', monthStart);

  // Deposits MTD
  const { data: depositData } = await supabase
    .from('transactions')
    .select('amount')
    .eq('broker_id', brokerId)
    .eq('type', 'deposit')
    .eq('status', 'completed')
    .gte('created_at', monthStart);
  const depositsMtd = depositData?.reduce((sum, t) => sum + (t.amount || 0), 0) ?? 0;

  // Withdrawals MTD
  const { data: withdrawalData } = await supabase
    .from('transactions')
    .select('amount')
    .eq('broker_id', brokerId)
    .eq('type', 'withdrawal')
    .eq('status', 'completed')
    .gte('created_at', monthStart);
  const withdrawalsMtd = withdrawalData?.reduce((sum, t) => sum + (t.amount || 0), 0) ?? 0;

  // Volume MTD
  const { data: volumeData } = await supabase
    .from('trades')
    .select('volume_usd')
    .eq('broker_id', brokerId)
    .gte('opened_at', monthStart);
  const volumeMtd = volumeData?.reduce((sum, t) => sum + (t.volume_usd || 0), 0) ?? 0;

  // Revenue MTD (commission + spread)
  const { data: revenueData } = await supabase
    .from('trades')
    .select('commission, spread_revenue')
    .eq('broker_id', brokerId)
    .gte('opened_at', monthStart);
  const revenueMtd = revenueData?.reduce(
    (sum, t) => sum + (t.commission || 0) + (t.spread_revenue || 0),
    0,
  ) ?? 0;

  return {
    totalClients: totalClients ?? 0,
    activeTraders: activeTraders ?? 0,
    newThisMonth: newThisMonth ?? 0,
    depositsMtd,
    withdrawalsMtd,
    netFlow: depositsMtd - withdrawalsMtd,
    volumeMtd,
    revenueMtd,
  };
}

async function getTopClients(brokerId: string) {
  const supabase = await createServerSupabaseClient();
  const monthStart = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  ).toISOString();

  const { data } = await supabase
    .from('trading_accounts')
    .select(`
      id,
      account_number,
      balance,
      volume_mtd,
      user:users!inner(id, full_name, email)
    `)
    .eq('broker_id', brokerId)
    .order('volume_mtd', { ascending: false })
    .limit(10);

  return data ?? [];
}

function formatCurrency(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(2)}`;
}

export default async function BrokerOverviewPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('users')
    .select('broker_id')
    .eq('id', user!.id)
    .single();

  const brokerId = profile?.broker_id;
  if (!brokerId) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-secondary">No broker assigned to your account.</p>
      </div>
    );
  }

  const kpis = await getBrokerKpis(brokerId);
  const topClients = await getTopClients(brokerId);

  const kpiCards = [
    { label: 'Total Clients', value: kpis.totalClients.toLocaleString(), icon: Users },
    { label: 'Active Traders', value: kpis.activeTraders.toLocaleString(), icon: UserCheck },
    { label: 'New This Month', value: kpis.newThisMonth.toLocaleString(), icon: UserPlus, change: kpis.newThisMonth > 0 ? 12.5 : 0, changeLabel: 'vs last month' },
    { label: 'Deposits MTD', value: formatCurrency(kpis.depositsMtd), icon: ArrowDownToLine },
    { label: 'Withdrawals MTD', value: formatCurrency(kpis.withdrawalsMtd), icon: ArrowUpFromLine },
    { label: 'Net Flow', value: formatCurrency(kpis.netFlow), icon: TrendingUp, change: kpis.netFlow >= 0 ? 5.2 : -3.1 },
    { label: 'Volume MTD', value: formatCurrency(kpis.volumeMtd), icon: BarChart3 },
    { label: 'Revenue MTD', value: formatCurrency(kpis.revenueMtd), icon: DollarSign },
  ];

  const topClientColumns = [
    { key: 'rank', label: '#', width: '40px', render: (_: Record<string, unknown>, i: number) => <span className="text-muted">{i + 1}</span> },
    {
      key: 'name',
      label: 'Client',
      render: (row: Record<string, unknown>) => {
        const u = row.user as Record<string, unknown> | undefined;
        return (
          <div>
            <p className="font-medium text-foreground">{(u?.full_name as string) ?? 'Unknown'}</p>
            <p className="text-[10px] text-muted">{(u?.email as string) ?? ''}</p>
          </div>
        );
      },
    },
    { key: 'account_number', label: 'Account' },
    {
      key: 'balance',
      label: 'Balance',
      align: 'right' as const,
      render: (row: Record<string, unknown>) => (
        <span className="mono">{formatCurrency(Number(row.balance) || 0)}</span>
      ),
    },
    {
      key: 'volume_mtd',
      label: 'Volume MTD',
      align: 'right' as const,
      render: (row: Record<string, unknown>) => (
        <span className="mono">{formatCurrency(Number(row.volume_mtd) || 0)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">Broker Dashboard</h1>
        <p className="text-xs text-secondary">Real-time overview of your brokerage operations</p>
      </div>

      {/* KPI Row */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 xl:grid-cols-8">
        {kpiCards.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* Second Row: Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* New Registrations Chart Placeholder */}
        <div className="rounded-xl border border-border bg-elevated p-5">
          <h3 className="mb-4 text-sm font-semibold text-foreground">New Registrations</h3>
          <div className="flex h-48 items-end gap-1">
            {Array.from({ length: 30 }).map((_, i) => {
              const height = 20 + Math.random() * 80;
              return (
                <div
                  key={i}
                  className="flex-1 rounded-t transition-all hover:opacity-80"
                  style={{
                    height: `${height}%`,
                    backgroundColor: 'var(--accent)',
                    opacity: 0.3 + (i / 30) * 0.7,
                  }}
                />
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-muted">
            <span>1st</span>
            <span>15th</span>
            <span>30th</span>
          </div>
        </div>

        {/* Revenue Breakdown */}
        <div className="rounded-xl border border-border bg-elevated p-5">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Revenue Breakdown</h3>
          <div className="space-y-3">
            {[
              { label: 'Spread Revenue', pct: 55, color: 'var(--accent)' },
              { label: 'Commissions', pct: 25, color: 'var(--profit)' },
              { label: 'Swap Fees', pct: 12, color: 'var(--gold)' },
              { label: 'Other', pct: 8, color: 'var(--text-secondary)' },
            ].map((item) => (
              <div key={item.label}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-secondary">{item.label}</span>
                  <span className="mono text-foreground">{item.pct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${item.pct}%`, backgroundColor: item.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Third Row: Top Clients */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Top 10 Clients by Volume</h3>
        {topClients.length > 0 ? (
          <DataTable
            columns={topClientColumns}
            data={topClients as unknown as Record<string, unknown>[]}
            sortable
            pageSize={10}
          />
        ) : (
          <EmptyState
            icon={Users}
            title="No trading activity"
            description="Client trading data will appear here once trades are placed."
          />
        )}
      </div>
    </div>
  );
}

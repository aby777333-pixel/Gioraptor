'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Copy, TrendingUp, Users, ShieldAlert, Search } from 'lucide-react';
import { MiniSparkline } from '@/components/charts/MiniSparkline';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn, formatPercent } from '@/lib/utils/format';

export default function CopyTradingPage() {
  const router = useRouter();
  const [strategies, setStrategies] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [riskFilter, setRiskFilter] = useState(10);
  const [sortBy, setSortBy] = useState('total_return');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('copy_strategies')
        .select('*')
        .eq('is_active', true)
        .order('total_return_pct', { ascending: false });
      setStrategies(data ?? []);
      setLoading(false);
    }
    fetch();
  }, []);

  const filtered = strategies
    .filter((s) => ((s.risk_score as number) ?? 0) <= riskFilter)
    .sort((a, b) => {
      if (sortBy === 'total_return') return ((b.total_return_pct as number) ?? 0) - ((a.total_return_pct as number) ?? 0);
      if (sortBy === 'followers') return ((b.followers_count as number) ?? 0) - ((a.followers_count as number) ?? 0);
      if (sortBy === 'risk') return ((a.risk_score as number) ?? 0) - ((b.risk_score as number) ?? 0);
      return 0;
    });

  const riskColor = (score: number) => {
    if (score <= 3) return 'text-profit bg-profit/15';
    if (score <= 6) return 'text-gold bg-gold/15';
    return 'text-loss bg-loss/15';
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-xl border border-accent/20 bg-gradient-to-r from-accent/5 to-transparent p-6">
        <div className="flex items-center gap-3 mb-2">
          <Copy className="h-6 w-6 text-accent" />
          <h1 className="text-xl font-bold text-foreground">Copy Top Traders Automatically</h1>
        </div>
        <p className="text-sm text-secondary max-w-xl">
          Browse proven strategies from top traders. Copy their trades in real-time with customizable risk management.
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs text-secondary">Max Risk Score:</label>
          <input
            type="range"
            min={1}
            max={10}
            value={riskFilter}
            onChange={(e) => setRiskFilter(Number(e.target.value))}
            className="w-32 accent-[var(--accent)]"
          />
          <span className="text-xs mono text-foreground">{riskFilter}/10</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-secondary">Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-foreground outline-none focus:border-accent"
          >
            <option value="total_return">Total Return</option>
            <option value="followers">Followers</option>
            <option value="risk">Risk (Low to High)</option>
          </select>
        </div>
      </div>

      {loading ? (
        <LoadingSkeleton variant="card" count={3} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Copy}
          title="No strategies available"
          description="No copy trading strategies match your filters."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => {
            const sparkData = Array.from({ length: 20 }, (_, i) => {
              const base = (s.total_return_pct as number) ?? 10;
              return base * 0.5 + (i / 20) * base * 0.5 + (Math.random() - 0.4) * base * 0.1;
            });

            return (
              <div key={s.id as string} className="rounded-xl border border-border bg-elevated p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{s.name as string}</h3>
                    <p className="text-[10px] text-muted mt-0.5 line-clamp-2">{s.description as string}</p>
                  </div>
                  <MiniSparkline data={sparkData} width={70} height={28} color="var(--accent)" />
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[10px] text-muted">Return</p>
                    <p className={cn('mono text-xs font-bold', (s.total_return_pct as number) >= 0 ? 'text-profit' : 'text-loss')}>
                      {formatPercent((s.total_return_pct as number) ?? 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted">Max DD</p>
                    <p className="mono text-xs font-medium text-loss">{((s.max_drawdown_pct as number) ?? 0).toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted">Followers</p>
                    <p className="text-xs font-medium text-foreground">{(s.followers_count as number) ?? 0}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', riskColor((s.risk_score as number) ?? 5))}>
                    Risk {s.risk_score as number}/10
                  </span>
                  <button
                    onClick={() => router.push(`/dashboard/copy-trading/${s.id}`)}
                    className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/80 transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

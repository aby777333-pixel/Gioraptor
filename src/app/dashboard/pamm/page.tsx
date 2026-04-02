'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Users, DollarSign, TrendingUp, Lock } from 'lucide-react';
import { MiniSparkline } from '@/components/charts/MiniSparkline';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { cn, formatCurrency, formatPercent } from '@/lib/utils/format';

export default function PammPage() {
  const [funds, setFunds] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [investModal, setInvestModal] = useState<Record<string, unknown> | null>(null);
  const [investAmount, setInvestAmount] = useState('');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('pamm_funds')
        .select('*')
        .eq('is_active', true)
        .order('total_return_pct', { ascending: false });
      setFunds(data ?? []);
      setLoading(false);
    }
    fetch();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">PAMM Funds</h1>
          <p className="text-xs text-secondary mt-0.5">Invest in professionally managed trading accounts</p>
        </div>
      </div>

      {loading ? (
        <LoadingSkeleton variant="card" count={4} />
      ) : funds.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No PAMM funds available"
          description="PAMM investment opportunities will appear here when managers create new funds."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {funds.map((f) => {
            const sparkData = Array.from({ length: 15 }, (_, i) => {
              const base = (f.nav as number) ?? 100;
              return base * 0.9 + (i / 15) * base * 0.1 + (Math.random() - 0.4) * base * 0.03;
            });

            return (
              <div key={f.id as string} className="rounded-xl border border-border bg-elevated p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{f.name as string}</h3>
                    <p className="text-[10px] text-muted">Managed by {f.manager_name as string}</p>
                  </div>
                  <MiniSparkline data={sparkData} width={70} height={28} color="var(--profit)" />
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-3.5 w-3.5 text-muted" />
                    <div>
                      <p className="text-[10px] text-muted">AUM</p>
                      <p className="font-medium text-foreground">{formatCurrency((f.aum as number) ?? 0)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-3.5 w-3.5 text-muted" />
                    <div>
                      <p className="text-[10px] text-muted">NAV</p>
                      <p className="mono font-medium text-foreground">{((f.nav as number) ?? 100).toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-3.5 w-3.5 text-profit" />
                    <div>
                      <p className="text-[10px] text-muted">Return</p>
                      <p className={cn('mono font-bold', ((f.total_return_pct as number) ?? 0) >= 0 ? 'text-profit' : 'text-loss')}>
                        {formatPercent((f.total_return_pct as number) ?? 0)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5 text-muted" />
                    <div>
                      <p className="text-[10px] text-muted">Lock-up</p>
                      <p className="font-medium text-foreground">{(f.lockup_period_days as number) ?? 30} days</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setInvestModal(f)}
                  className="w-full rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white hover:bg-accent/80 transition-colors"
                >
                  Invest
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Invest Modal */}
      <Modal
        isOpen={!!investModal}
        onClose={() => { setInvestModal(null); setInvestAmount(''); }}
        title={`Invest in ${investModal?.name ?? ''}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-secondary">
            Minimum investment: {formatCurrency((investModal?.min_investment as number) ?? 100)}.
            Lock-up period: {(investModal?.lockup_period_days as number) ?? 30} days.
          </p>
          <div>
            <label className="block text-xs font-medium text-secondary mb-1">Investment Amount (USD)</label>
            <input
              type="number"
              value={investAmount}
              onChange={(e) => setInvestAmount(e.target.value)}
              placeholder="Enter amount"
              className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground outline-none focus:border-accent"
            />
          </div>
          <button className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/80 transition-colors btn-glow">
            Confirm Investment
          </button>
        </div>
      </Modal>
    </div>
  );
}

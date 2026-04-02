'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { UserPlus, Copy, Check, DollarSign, Users, Link } from 'lucide-react';
import { KpiCard } from '@/components/ui/KpiCard';
import { DataTable } from '@/components/ui/DataTable';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { formatCurrency } from '@/lib/utils/format';

export default function ReferralsPage() {
  const [loading, setLoading] = useState(true);
  const [referralCode, setReferralCode] = useState('');
  const [referredCount, setReferredCount] = useState(0);
  const [commissions, setCommissions] = useState<Record<string, unknown>[]>([]);
  const [copied, setCopied] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function fetch() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get referral code
      const { data: profile } = await supabase
        .from('users')
        .select('referral_code')
        .eq('id', user.id)
        .single();

      setReferralCode(profile?.referral_code ?? user.id.slice(0, 8).toUpperCase());

      // Count referred users
      const { count } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('referred_by', user.id);

      setReferredCount(count ?? 0);

      // Fetch commissions
      const { data: comms } = await supabase
        .from('ib_commissions')
        .select('*')
        .eq('ib_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      setCommissions(comms ?? []);
      setLoading(false);
    }
    fetch();
  }, []);

  const totalCommissions = commissions.reduce((s, c) => s + ((c.amount as number) ?? 0), 0);
  const referralLink = typeof window !== 'undefined'
    ? `${window.location.origin}/auth/register?ref=${referralCode}`
    : '';

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const commissionColumns = [
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
      key: 'source_type',
      label: 'Type',
      render: (row: Record<string, unknown>) => (
        <span className="capitalize text-secondary">{(row.source_type as string) ?? 'trade'}</span>
      ),
    },
    {
      key: 'amount',
      label: 'Commission',
      align: 'right' as const,
      render: (row: Record<string, unknown>) => (
        <span className="mono font-semibold text-profit">+{formatCurrency(row.amount as number)}</span>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="space-y-5">
        <h1 className="text-lg font-bold text-foreground">IB Referrals</h1>
        <LoadingSkeleton variant="card" count={3} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold text-foreground">IB Referrals</h1>

      {/* Referral Code & Link */}
      <div className="rounded-xl border border-border bg-elevated p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Your Referral Code</h3>
        <div className="flex items-center gap-3">
          <div className="flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 mono text-lg font-bold text-accent tracking-widest">
            {referralCode}
          </div>
          <button
            onClick={() => copyToClipboard(referralCode)}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-xs font-medium text-white hover:bg-accent/80 transition-colors shrink-0"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <div>
          <label className="block text-xs font-medium text-secondary mb-1">Referral Link</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={referralLink}
              className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground outline-none"
            />
            <button
              onClick={() => copyToClipboard(referralLink)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-secondary hover:bg-elevated transition-colors"
            >
              <Link className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Referred Clients" value={referredCount.toString()} icon={Users} />
        <KpiCard label="Total Commissions" value={formatCurrency(totalCommissions)} icon={DollarSign} />
        <KpiCard label="This Month" value={formatCurrency(
          commissions
            .filter((c) => {
              const d = new Date(c.created_at as string);
              const now = new Date();
              return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            })
            .reduce((s, c) => s + ((c.amount as number) ?? 0), 0)
        )} icon={DollarSign} />
      </div>

      {/* Commission History */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Commission History</h3>
        {commissions.length === 0 ? (
          <p className="text-xs text-secondary py-8 text-center">No commissions yet. Share your referral code to start earning.</p>
        ) : (
          <DataTable columns={commissionColumns} data={commissions} sortable />
        )}
      </div>
    </div>
  );
}

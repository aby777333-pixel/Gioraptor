'use client';

import { useTradingStore } from '@/stores/trading';
import { formatCurrency, cn } from '@/lib/utils/format';

export default function AccountBar() {
  const { accountSummary } = useTradingStore();

  const {
    balance,
    equity,
    margin_used,
    free_margin,
    margin_level_pct,
    floating_pnl,
  } = accountSummary;

  const items = [
    { label: 'Balance', value: formatCurrency(balance), color: null },
    { label: 'Equity', value: formatCurrency(equity), color: null },
    { label: 'Margin', value: formatCurrency(margin_used), color: null },
    { label: 'Free Margin', value: formatCurrency(free_margin), color: null },
    {
      label: 'Margin Level',
      value: margin_level_pct > 0 ? `${margin_level_pct.toFixed(1)}%` : '--',
      color: null,
    },
    {
      label: 'P/L',
      value: `${floating_pnl >= 0 ? '+' : ''}${formatCurrency(floating_pnl)}`,
      color: floating_pnl >= 0 ? 'text-green-400' : 'text-red-400',
    },
  ];

  return (
    <div
      className="flex items-center justify-center gap-6 px-4 border-t select-none"
      style={{
        height: 32,
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border)',
      }}
    >
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5 text-[11px]">
          <span className="opacity-40">{item.label}</span>
          <span className={cn('font-mono font-medium', item.color)}>
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

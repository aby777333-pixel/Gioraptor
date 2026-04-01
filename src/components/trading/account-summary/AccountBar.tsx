'use client';

import { useTradingStore } from '@/stores/trading';
import { formatCurrency } from '@/lib/utils/format';

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

  const pnlColor = floating_pnl >= 0 ? '#00C853' : '#FF5252';
  const pnlSign = floating_pnl >= 0 ? '+' : '';

  return (
    <div
      className="flex items-center justify-center gap-6 px-4 select-none"
      style={{
        height: 32,
        backgroundColor: 'var(--bg-primary)',
        borderTop: '1px solid var(--border)',
        fontSize: 12,
      }}
    >
      <Item label="Account Currency" value="USD" />
      <Sep />
      <Item label="Balance" value={formatCurrency(balance)} />
      <Sep />
      <Item label="Equity" value={formatCurrency(equity)} />
      <Sep />
      <Item label="Margin" value={formatCurrency(margin_used)} />
      <Sep />
      <Item label="Free Margin" value={formatCurrency(free_margin)} />
      <Sep />
      <Item
        label="Margin Level"
        value={margin_level_pct > 0 ? `${margin_level_pct.toFixed(2)}%` : '--'}
      />
      <Sep />
      <Item
        label="Net P&L"
        value={`${pnlSign}${formatCurrency(floating_pnl)}`}
        valueColor={pnlColor}
      />
    </div>
  );
}

function Item({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ color: '#29ABE2', opacity: 0.85, fontSize: 12 }}>{label}:</span>
      <span
        className="font-mono font-medium"
        style={{ color: valueColor ?? 'var(--text-primary)', fontSize: 13 }}
      >
        {value}
      </span>
    </div>
  );
}

function Sep() {
  return (
    <span style={{ opacity: 0.15, color: '#fff' }}>|</span>
  );
}

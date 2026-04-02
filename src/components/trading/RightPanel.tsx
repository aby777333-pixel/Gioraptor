'use client';

import { useState } from 'react';
import OrderTicket from '@/components/trading/order-ticket/OrderTicket';
import TradingTools from '@/components/trading/tools/TradingTools';
import { useTradingStore } from '@/stores/trading';
import { formatCurrency } from '@/lib/utils/format';

type RightTab = 'order' | 'account' | 'tools';

export default function RightPanel() {
  const [activeTab, setActiveTab] = useState<RightTab>('order');

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ backgroundColor: 'var(--bg-surface)' }}>
      {/* Tab bar */}
      <div
        className="flex shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        {(['order', 'account', 'tools'] as RightTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-2 text-xs font-semibold uppercase tracking-wider transition-all"
            style={{
              backgroundColor: activeTab === tab ? 'var(--bg-elevated)' : 'transparent',
              color: activeTab === tab ? '#0091D5' : 'rgba(255,255,255,0.45)',
              borderBottom: activeTab === tab ? '2px solid #0091D5' : '2px solid transparent',
            }}
          >
            {tab === 'order' ? 'Order' : tab === 'account' ? 'Account' : 'Tools'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden hide-scrollbar" style={{ scrollbarWidth: 'none' }}>
        {activeTab === 'order' && <OrderTicket />}
        {activeTab === 'account' && <AccountSummaryPanel />}
        {activeTab === 'tools' && (
          <div className="flex flex-col h-full">
            <TradingTools />
            {/* Bloomberg TV Live */}
            <LiveTVPanel />
          </div>
        )}
      </div>
    </div>
  );
}

function AccountSummaryPanel() {
  const { accountSummary, positions, pendingOrders } = useTradingStore();

  const {
    balance,
    equity,
    margin_used,
    free_margin,
    margin_level_pct,
    floating_pnl,
    open_positions_count,
  } = accountSummary;

  const pnlColor = floating_pnl >= 0 ? '#00C853' : '#FF5252';

  const items: { label: string; value: string; color?: string }[] = [
    { label: 'Balance', value: formatCurrency(balance) },
    { label: 'Equity', value: formatCurrency(equity) },
    { label: 'Floating P&L', value: `${floating_pnl >= 0 ? '+' : ''}${formatCurrency(floating_pnl)}`, color: pnlColor },
    { label: 'Margin Used', value: formatCurrency(margin_used) },
    { label: 'Free Margin', value: formatCurrency(free_margin) },
    { label: 'Margin Level', value: margin_level_pct > 0 ? `${margin_level_pct.toFixed(2)}%` : '--' },
    { label: 'Open Positions', value: String(open_positions_count || positions.length) },
    { label: 'Pending Orders', value: String(pendingOrders.length) },
  ];

  const marginHealthPct = margin_level_pct;
  const marginColor = marginHealthPct > 500 ? '#00C853' : marginHealthPct > 200 ? '#FFC107' : '#FF5252';

  return (
    <div className="flex flex-col p-3 gap-3">
      {/* Margin health indicator */}
      <div className="stat-card">
        <div className="text-[10px] uppercase tracking-wider opacity-40 mb-2">
          Margin Health
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, marginHealthPct / 10)}%`,
                backgroundColor: marginColor,
              }}
            />
          </div>
          <span className="font-mono text-sm font-bold" style={{ color: marginColor }}>
            {marginHealthPct > 0 ? `${marginHealthPct.toFixed(0)}%` : '--'}
          </span>
        </div>
      </div>

      {/* Account details */}
      {items.map((item) => (
        <div
          key={item.label}
          className="stat-card flex items-center justify-between"
        >
          <span className="text-xs opacity-50">{item.label}</span>
          <span
            className="font-mono text-sm font-medium"
            style={{ color: item.color ?? 'var(--text-primary)' }}
          >
            {item.value}
          </span>
        </div>
      ))}

      {/* Exposure by symbol */}
      {positions.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider opacity-40 mb-2 px-1">
            Open Exposure
          </div>
          {positions.filter(p => p.status === 'open').map((pos) => (
            <div
              key={pos.id}
              className="flex items-center justify-between px-3 py-1.5 text-xs"
            >
              <span className="font-mono">{pos.symbol}</span>
              <span
                className="font-mono"
                style={{ color: pos.direction === 'BUY' ? '#00C853' : '#FF5252' }}
              >
                {pos.direction} {pos.size.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LiveTVPanel() {
  return (
    <div className="p-3 flex flex-col gap-2">
      <div className="flex items-center gap-1.5 py-1 px-2 text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-muted)' }}>
        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#00C853' }} />
        Live Market Data
      </div>
      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
        <iframe
          src="https://s.tradingview.com/embed-widget/ticker-tape/?locale=en#%7B%22symbols%22%3A%5B%7B%22proName%22%3A%22FOREXCOM%3AEURUSD%22%7D%2C%7B%22proName%22%3A%22FOREXCOM%3AGBPUSD%22%7D%2C%7B%22proName%22%3A%22FX_IDC%3AUSDJPY%22%7D%2C%7B%22proName%22%3A%22OANDA%3AXAUUSD%22%7D%2C%7B%22proName%22%3A%22BITSTAMP%3ABTCUSD%22%7D%5D%2C%22showSymbolLogo%22%3Atrue%2C%22colorTheme%22%3A%22dark%22%2C%22isTransparent%22%3Atrue%2C%22displayMode%22%3A%22compact%22%7D"
          title="Live Ticker"
          style={{ width: '100%', height: 46, border: 'none' }}
        />
      </div>
      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
        <iframe
          src="https://s.tradingview.com/embed-widget/market-overview/?locale=en#%7B%22colorTheme%22%3A%22dark%22%2C%22dateRange%22%3A%221D%22%2C%22showChart%22%3Atrue%2C%22isTransparent%22%3Atrue%2C%22showFloatingTooltip%22%3Afalse%2C%22tabs%22%3A%5B%7B%22title%22%3A%22Forex%22%2C%22symbols%22%3A%5B%7B%22s%22%3A%22FX%3AEURUSD%22%7D%2C%7B%22s%22%3A%22FX%3AGBPUSD%22%7D%2C%7B%22s%22%3A%22FX%3AUSDJPY%22%7D%2C%7B%22s%22%3A%22FX%3AAUDUSD%22%7D%5D%7D%2C%7B%22title%22%3A%22Crypto%22%2C%22symbols%22%3A%5B%7B%22s%22%3A%22BITSTAMP%3ABTCUSD%22%7D%2C%7B%22s%22%3A%22BITSTAMP%3AETHUSD%22%7D%5D%7D%5D%7D"
          title="Market Overview"
          style={{ width: '100%', height: 300, border: 'none' }}
        />
      </div>
    </div>
  );
}

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
            {/* Market Overview Widget */}
            <MarketOverviewWidget />
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

function MarketOverviewWidget() {
  const containerId = 'tv-market-overview';

  useState(() => {
    if (typeof window === 'undefined') return;
    const timer = setTimeout(() => {
      const container = document.getElementById(containerId);
      if (!container || container.querySelector('script')) return;
      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js';
      script.async = true;
      script.textContent = JSON.stringify({
        colorTheme: 'dark',
        dateRange: '1D',
        showChart: false,
        locale: 'en',
        largeChartUrl: '',
        isTransparent: true,
        showSymbolLogo: true,
        showFloatingTooltip: false,
        width: '100%',
        height: '100%',
        tabs: [
          {
            title: 'Forex',
            symbols: [
              { s: 'FX:EURUSD', d: 'EUR/USD' },
              { s: 'FX:GBPUSD', d: 'GBP/USD' },
              { s: 'FX:USDJPY', d: 'USD/JPY' },
              { s: 'FX:AUDUSD', d: 'AUD/USD' },
            ],
            originalTitle: 'Forex',
          },
          {
            title: 'Indices',
            symbols: [
              { s: 'FOREXCOM:SPXUSD', d: 'S&P 500' },
              { s: 'FOREXCOM:NSXUSD', d: 'Nasdaq' },
              { s: 'INDEX:DXY', d: 'Dollar Index' },
            ],
            originalTitle: 'Indices',
          },
          {
            title: 'Crypto',
            symbols: [
              { s: 'COINBASE:BTCUSD', d: 'BTC/USD' },
              { s: 'COINBASE:ETHUSD', d: 'ETH/USD' },
              { s: 'BINANCE:SOLUSDT', d: 'SOL/USDT' },
            ],
            originalTitle: 'Crypto',
          },
        ],
      });
      container.appendChild(script);
    }, 100);
    return () => clearTimeout(timer);
  });

  return (
    <div className="p-3 flex flex-col gap-2">
      <div
        className="flex items-center gap-1.5 py-1 px-2 text-[10px] uppercase tracking-wider font-semibold"
        style={{ color: 'var(--text-muted)' }}
      >
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00C896]" />
        Market Overview
      </div>
      <div
        className="tradingview-widget-container rounded-lg overflow-hidden"
        id={containerId}
        style={{
          height: 220,
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      />
    </div>
  );
}

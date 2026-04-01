'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useTradingStore } from '@/stores/trading';
import { formatPrice, formatPnL, formatLot, formatCurrency, cn } from '@/lib/utils/format';
import type { Position, Order } from '@/types/trading';

type TabKey = 'positions' | 'pending' | 'history';

const mockPositions: Position[] = [
  {
    id: 'pos-1',
    account_id: 'acc-1',
    symbol: 'EURUSD',
    direction: 'BUY',
    size: 0.5,
    open_price: 1.08210,
    close_price: null,
    current_price: 1.08432,
    sl: 1.07900,
    tp: 1.08800,
    commission: -3.50,
    swap_accrued: -1.20,
    floating_pnl: 111.00,
    realized_pnl: null,
    status: 'open',
    opened_at: '2026-03-31T14:22:00Z',
    closed_at: null,
  },
  {
    id: 'pos-2',
    account_id: 'acc-1',
    symbol: 'XAUUSD',
    direction: 'SELL',
    size: 0.1,
    open_price: 2358.40,
    close_price: null,
    current_price: 2345.12,
    sl: 2375.00,
    tp: 2320.00,
    commission: -5.00,
    swap_accrued: 0.80,
    floating_pnl: 132.80,
    realized_pnl: null,
    status: 'open',
    opened_at: '2026-03-31T10:05:00Z',
    closed_at: null,
  },
  {
    id: 'pos-3',
    account_id: 'acc-1',
    symbol: 'GBPUSD',
    direction: 'BUY',
    size: 0.2,
    open_price: 1.26520,
    close_price: null,
    current_price: 1.26318,
    sl: null,
    tp: null,
    commission: -2.00,
    swap_accrued: -0.40,
    floating_pnl: -40.40,
    realized_pnl: null,
    status: 'open',
    opened_at: '2026-04-01T08:15:00Z',
    closed_at: null,
  },
];

const mockPendingOrders: Order[] = [
  {
    id: 'ord-1',
    account_id: 'acc-1',
    symbol: 'USDJPY',
    order_type: 'limit',
    direction: 'BUY',
    requested_size: 0.3,
    filled_size: 0,
    remaining_size: 0.3,
    requested_price: 150.500,
    fill_price: null,
    sl: 149.800,
    tp: 152.000,
    trailing_stop_pips: null,
    time_in_force: 'GTC',
    status: 'pending_lp',
    commission: 0,
    source: 'web',
    comment: '',
    created_at: '2026-04-01T09:30:00Z',
    filled_at: null,
  },
];

function getDecimals(symbol: string): number {
  if (symbol === 'USDJPY') return 3;
  if (symbol.startsWith('XAU')) return 2;
  if (symbol.startsWith('BTC') || symbol === 'US30' || symbol === 'NAS100') return 1;
  if (symbol.startsWith('ETH')) return 2;
  return 5;
}

export default function PositionsPanel() {
  const { positions: storePositions, pendingOrders: storePendingOrders } =
    useTradingStore();
  const [activeTab, setActiveTab] = useState<TabKey>('positions');

  const openPositions =
    storePositions.length > 0 ? storePositions : mockPositions;
  const pendingOrders =
    storePendingOrders.length > 0 ? storePendingOrders : mockPendingOrders;

  const totalProfit = openPositions.reduce((s, p) => s + p.floating_pnl, 0);
  const totalSwap = openPositions.reduce((s, p) => s + p.swap_accrued, 0);
  const totalCommission = openPositions.reduce((s, p) => s + p.commission, 0);

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'positions', label: 'Open Positions', count: openPositions.length },
    { key: 'pending', label: 'Pending Orders', count: pendingOrders.length },
    { key: 'history', label: 'History', count: 0 },
  ];

  function handleClosePosition(id: string) {
    console.log('Close position:', id);
  }

  function handleCancelOrder(id: string) {
    console.log('Cancel order:', id);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div
        className="flex border-b shrink-0"
        style={{ borderColor: 'var(--border)' }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2 text-xs font-medium transition-all border-b-2',
              activeTab === tab.key
                ? 'border-[#29ABE2] opacity-100'
                : 'border-transparent opacity-50 hover:opacity-70'
            )}
          >
            {tab.label}
            {tab.count > 0 && (
              <span
                className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: 'var(--bg-elevated)' }}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'positions' && (
          <>
            {/* Table header */}
            <div
              className="grid grid-cols-[80px_50px_55px_75px_75px_65px_65px_55px_55px_70px_30px] gap-1 px-3 py-1.5 text-[10px] uppercase tracking-wider opacity-40 border-b sticky top-0"
              style={{
                borderColor: 'var(--border)',
                backgroundColor: 'var(--bg-surface)',
              }}
            >
              <span>Symbol</span>
              <span>Dir</span>
              <span className="text-right">Size</span>
              <span className="text-right">Open</span>
              <span className="text-right">Current</span>
              <span className="text-right">SL</span>
              <span className="text-right">TP</span>
              <span className="text-right">Swap</span>
              <span className="text-right">Comm</span>
              <span className="text-right">Profit</span>
              <span />
            </div>

            {/* Position rows */}
            {openPositions.map((pos) => {
              const dec = getDecimals(pos.symbol);
              const isProfitable = pos.floating_pnl >= 0;

              return (
                <div
                  key={pos.id}
                  className="grid grid-cols-[80px_50px_55px_75px_75px_65px_65px_55px_55px_70px_30px] gap-1 px-3 py-1.5 text-xs border-b hover:opacity-90 transition-opacity"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <span className="font-medium">{pos.symbol}</span>
                  <span
                    className={cn(
                      'font-bold text-[10px]',
                      pos.direction === 'BUY'
                        ? 'text-green-400'
                        : 'text-red-400'
                    )}
                  >
                    {pos.direction}
                  </span>
                  <span className="font-mono text-right">
                    {formatLot(pos.size)}
                  </span>
                  <span className="font-mono text-right">
                    {formatPrice(pos.open_price, dec)}
                  </span>
                  <span className="font-mono text-right">
                    {formatPrice(pos.current_price, dec)}
                  </span>
                  <span className="font-mono text-right opacity-60">
                    {pos.sl ? formatPrice(pos.sl, dec) : '--'}
                  </span>
                  <span className="font-mono text-right opacity-60">
                    {pos.tp ? formatPrice(pos.tp, dec) : '--'}
                  </span>
                  <span className="font-mono text-right opacity-60">
                    {pos.swap_accrued.toFixed(2)}
                  </span>
                  <span className="font-mono text-right opacity-60">
                    {pos.commission.toFixed(2)}
                  </span>
                  <span
                    className={cn(
                      'font-mono text-right font-bold',
                      isProfitable ? 'text-green-400' : 'text-red-400'
                    )}
                  >
                    {formatPnL(pos.floating_pnl)}
                  </span>
                  <button
                    onClick={() => handleClosePosition(pos.id)}
                    className="flex items-center justify-center hover:text-red-400 transition-colors opacity-50 hover:opacity-100"
                    title="Close position"
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}

            {/* Summary row */}
            <div
              className="grid grid-cols-[80px_50px_55px_75px_75px_65px_65px_55px_55px_70px_30px] gap-1 px-3 py-2 text-xs font-bold border-t"
              style={{
                borderColor: 'var(--border)',
                backgroundColor: 'var(--bg-elevated)',
              }}
            >
              <span className="col-span-7 opacity-50">Total</span>
              <span className="font-mono text-right opacity-60">
                {totalSwap.toFixed(2)}
              </span>
              <span className="font-mono text-right opacity-60">
                {totalCommission.toFixed(2)}
              </span>
              <span
                className={cn(
                  'font-mono text-right',
                  totalProfit >= 0 ? 'text-green-400' : 'text-red-400'
                )}
              >
                {formatPnL(totalProfit)}
              </span>
              <span />
            </div>
          </>
        )}

        {activeTab === 'pending' && (
          <>
            <div
              className="grid grid-cols-[80px_50px_55px_60px_75px_65px_65px_60px_30px] gap-1 px-3 py-1.5 text-[10px] uppercase tracking-wider opacity-40 border-b sticky top-0"
              style={{
                borderColor: 'var(--border)',
                backgroundColor: 'var(--bg-surface)',
              }}
            >
              <span>Symbol</span>
              <span>Dir</span>
              <span>Type</span>
              <span className="text-right">Size</span>
              <span className="text-right">Price</span>
              <span className="text-right">SL</span>
              <span className="text-right">TP</span>
              <span>Status</span>
              <span />
            </div>

            {pendingOrders.map((ord) => {
              const dec = getDecimals(ord.symbol);
              return (
                <div
                  key={ord.id}
                  className="grid grid-cols-[80px_50px_55px_60px_75px_65px_65px_60px_30px] gap-1 px-3 py-1.5 text-xs border-b hover:opacity-90 transition-opacity"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <span className="font-medium">{ord.symbol}</span>
                  <span
                    className={cn(
                      'font-bold text-[10px]',
                      ord.direction === 'BUY'
                        ? 'text-green-400'
                        : 'text-red-400'
                    )}
                  >
                    {ord.direction}
                  </span>
                  <span className="capitalize opacity-60">
                    {ord.order_type}
                  </span>
                  <span className="font-mono text-right">
                    {formatLot(ord.requested_size)}
                  </span>
                  <span className="font-mono text-right">
                    {ord.requested_price
                      ? formatPrice(ord.requested_price, dec)
                      : '--'}
                  </span>
                  <span className="font-mono text-right opacity-60">
                    {ord.sl ? formatPrice(ord.sl, dec) : '--'}
                  </span>
                  <span className="font-mono text-right opacity-60">
                    {ord.tp ? formatPrice(ord.tp, dec) : '--'}
                  </span>
                  <span className="text-[10px] opacity-50 capitalize">
                    {ord.status.replace(/_/g, ' ')}
                  </span>
                  <button
                    onClick={() => handleCancelOrder(ord.id)}
                    className="flex items-center justify-center hover:text-red-400 transition-colors opacity-50 hover:opacity-100"
                    title="Cancel order"
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </>
        )}

        {activeTab === 'history' && (
          <div className="flex items-center justify-center h-32 text-xs opacity-30">
            No trade history available
          </div>
        )}
      </div>
    </div>
  );
}

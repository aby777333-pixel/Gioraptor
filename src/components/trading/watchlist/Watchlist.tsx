'use client';

import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { useTradingStore } from '@/stores/trading';
import { formatPrice, formatPercent, cn } from '@/lib/utils/format';
import type { WatchlistItem } from '@/types/trading';

const mockWatchlist: WatchlistItem[] = [
  {
    symbol: 'EURUSD',
    description: 'Euro / US Dollar',
    type: 'forex',
    bid: 1.08432,
    ask: 1.08445,
    spread: 1.3,
    change: 0.00052,
    change_pct: 0.048,
    high: 1.08610,
    low: 1.08210,
  },
  {
    symbol: 'GBPUSD',
    description: 'British Pound / US Dollar',
    type: 'forex',
    bid: 1.26318,
    ask: 1.26336,
    spread: 1.8,
    change: -0.00124,
    change_pct: -0.098,
    high: 1.26590,
    low: 1.26100,
  },
  {
    symbol: 'USDJPY',
    description: 'US Dollar / Japanese Yen',
    type: 'forex',
    bid: 151.432,
    ask: 151.448,
    spread: 1.6,
    change: 0.312,
    change_pct: 0.206,
    high: 151.720,
    low: 150.980,
  },
  {
    symbol: 'XAUUSD',
    description: 'Gold / US Dollar',
    type: 'metal',
    bid: 2345.12,
    ask: 2345.52,
    spread: 4.0,
    change: 12.45,
    change_pct: 0.533,
    high: 2352.80,
    low: 2330.15,
  },
  {
    symbol: 'BTCUSD',
    description: 'Bitcoin / US Dollar',
    type: 'crypto',
    bid: 69425.50,
    ask: 69445.50,
    spread: 200.0,
    change: -352.80,
    change_pct: -0.506,
    high: 70120.00,
    low: 68980.00,
  },
  {
    symbol: 'ETHUSD',
    description: 'Ethereum / US Dollar',
    type: 'crypto',
    bid: 3524.18,
    ask: 3526.18,
    spread: 20.0,
    change: 45.62,
    change_pct: 1.312,
    high: 3545.00,
    low: 3470.50,
  },
  {
    symbol: 'US30',
    description: 'Dow Jones Industrial',
    type: 'index',
    bid: 39845.5,
    ask: 39848.5,
    spread: 3.0,
    change: 125.3,
    change_pct: 0.315,
    high: 39920.0,
    low: 39680.0,
  },
  {
    symbol: 'NAS100',
    description: 'Nasdaq 100 Index',
    type: 'index',
    bid: 18432.2,
    ask: 18434.2,
    spread: 2.0,
    change: -48.6,
    change_pct: -0.263,
    high: 18520.0,
    low: 18380.0,
  },
];

function getDecimals(symbol: string): number {
  if (symbol === 'USDJPY') return 3;
  if (symbol.startsWith('XAU')) return 2;
  if (symbol.startsWith('BTC') || symbol === 'US30' || symbol === 'NAS100') return 1;
  if (symbol.startsWith('ETH')) return 2;
  return 5;
}

export default function Watchlist() {
  const { activeSymbol, setActiveSymbol, prices } = useTradingStore();
  const [search, setSearch] = useState('');

  const items = useMemo(() => {
    const list = mockWatchlist.map((item) => {
      const live = prices[item.symbol];
      if (live) {
        return {
          ...item,
          bid: live.bid,
          ask: live.ask,
          spread: live.spread,
        };
      }
      return item;
    });

    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (item) =>
        item.symbol.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
    );
  }, [search, prices]);

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>
        <div
          className="flex items-center gap-2 px-2 py-1.5 rounded text-sm"
          style={{ backgroundColor: 'var(--bg-elevated)' }}
        >
          <Search size={14} className="opacity-50 shrink-0" />
          <input
            type="text"
            placeholder="Search symbols..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent outline-none text-sm placeholder:opacity-40"
          />
        </div>
      </div>

      {/* Header */}
      <div
        className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-1 px-3 py-1 text-[10px] uppercase tracking-wider opacity-40 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        <span>Symbol</span>
        <span className="text-right w-16">Bid</span>
        <span className="text-right w-16">Ask</span>
        <span className="text-right w-10">Sprd</span>
        <span className="text-right w-12">Chg%</span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {items.map((item) => {
          const isActive = activeSymbol === item.symbol;
          const decimals = getDecimals(item.symbol);
          const isPositive = item.change_pct >= 0;

          return (
            <button
              key={item.symbol}
              onClick={() => setActiveSymbol(item.symbol)}
              className={cn(
                'w-full grid grid-cols-[1fr_auto_auto_auto_auto] gap-1 items-center px-3 py-1.5 text-xs transition-all hover:opacity-90',
                isActive && 'border-l-2',
                !isActive && 'border-l-2 border-transparent'
              )}
              style={{
                borderLeftColor: isActive ? '#29ABE2' : 'transparent',
                backgroundColor: isActive ? 'var(--bg-elevated)' : 'transparent',
              }}
            >
              <div className="text-left">
                <div className="font-medium text-xs">{item.symbol}</div>
                <div className="text-[10px] opacity-40 truncate">
                  {item.description}
                </div>
              </div>
              <span
                className={cn(
                  'font-mono text-right w-16',
                  isPositive ? 'text-green-400' : 'text-red-400'
                )}
              >
                {formatPrice(item.bid, decimals)}
              </span>
              <span
                className={cn(
                  'font-mono text-right w-16',
                  isPositive ? 'text-green-400' : 'text-red-400'
                )}
              >
                {formatPrice(item.ask, decimals)}
              </span>
              <span className="font-mono text-right w-10 opacity-60">
                {item.spread.toFixed(1)}
              </span>
              <span
                className={cn(
                  'font-mono text-right w-12 font-medium',
                  isPositive ? 'text-green-400' : 'text-red-400'
                )}
              >
                {formatPercent(item.change_pct)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Search, ArrowUp, ArrowDown } from 'lucide-react';
import { useTradingStore } from '@/stores/trading';
import { formatPrice, formatPercent, cn } from '@/lib/utils/format';
import type { WatchlistItem, InstrumentType } from '@/types/trading';

interface WatchlistItemWithDirection extends WatchlistItem {
  direction: 'up' | 'down' | 'neutral';
}

const defaultWatchlist: WatchlistItem[] = [
  { symbol: 'EURUSD', description: 'Euro / US Dollar', type: 'forex', bid: 1.08432, ask: 1.08445, spread: 1.3, change: 0.00052, change_pct: 0.048, high: 1.08610, low: 1.08210 },
  { symbol: 'GBPUSD', description: 'British Pound / US Dollar', type: 'forex', bid: 1.26318, ask: 1.26336, spread: 1.8, change: -0.00124, change_pct: -0.098, high: 1.26590, low: 1.26100 },
  { symbol: 'USDJPY', description: 'US Dollar / Japanese Yen', type: 'forex', bid: 154.432, ask: 154.448, spread: 1.6, change: 0.312, change_pct: 0.206, high: 154.720, low: 153.980 },
  { symbol: 'XAUUSD', description: 'Gold / US Dollar', type: 'metal', bid: 2340.12, ask: 2340.52, spread: 4.0, change: 12.45, change_pct: 0.533, high: 2352.80, low: 2330.15 },
  { symbol: 'BTCUSD', description: 'Bitcoin / US Dollar', type: 'crypto', bid: 67425.50, ask: 67445.50, spread: 200.0, change: -352.80, change_pct: -0.506, high: 67920.00, low: 66980.00 },
  { symbol: 'ETHUSD', description: 'Ethereum / US Dollar', type: 'crypto', bid: 3450.18, ask: 3452.18, spread: 20.0, change: 45.62, change_pct: 1.312, high: 3475.00, low: 3420.50 },
  { symbol: 'US30', description: 'Dow Jones Industrial', type: 'index', bid: 39800.5, ask: 39803.5, spread: 3.0, change: 125.3, change_pct: 0.315, high: 39920.0, low: 39680.0 },
  { symbol: 'NAS100', description: 'Nasdaq 100 Index', type: 'index', bid: 17950.2, ask: 17952.2, spread: 2.0, change: -48.6, change_pct: -0.263, high: 18020.0, low: 17880.0 },
  { symbol: 'USDCHF', description: 'US Dollar / Swiss Franc', type: 'forex', bid: 0.88180, ask: 0.88200, spread: 2.0, change: -0.00035, change_pct: -0.040, high: 0.88350, low: 0.88050 },
  { symbol: 'AUDUSD', description: 'Australian Dollar / US Dollar', type: 'forex', bid: 0.65480, ask: 0.65498, spread: 1.8, change: 0.00042, change_pct: 0.064, high: 0.65600, low: 0.65350 },
  { symbol: 'USDCAD', description: 'US Dollar / Canadian Dollar', type: 'forex', bid: 1.36480, ask: 1.36500, spread: 2.0, change: 0.00085, change_pct: 0.062, high: 1.36620, low: 1.36300 },
  { symbol: 'EURGBP', description: 'Euro / British Pound', type: 'forex', bid: 0.85680, ask: 0.85700, spread: 2.0, change: -0.00018, change_pct: -0.021, high: 0.85780, low: 0.85600 },
  { symbol: 'XAGUSD', description: 'Silver / US Dollar', type: 'metal', bid: 27.480, ask: 27.510, spread: 3.0, change: 0.15, change_pct: 0.549, high: 27.65, low: 27.30 },
  { symbol: 'SPX500', description: 'S&P 500 Index', type: 'index', bid: 5280.0, ask: 5280.8, spread: 0.8, change: 8.5, change_pct: 0.161, high: 5295.0, low: 5268.0 },
  { symbol: 'USOIL', description: 'US Crude Oil', type: 'energy' as InstrumentType, bid: 78.45, ask: 78.50, spread: 0.05, change: -0.32, change_pct: -0.407, high: 79.10, low: 78.20 },
];

function getDecimals(symbol: string): number {
  if (['USDJPY', 'EURJPY', 'GBPJPY'].includes(symbol)) return 3;
  if (symbol.startsWith('XAU') || symbol.startsWith('ETH')) return 2;
  if (symbol === 'XAGUSD' || symbol === 'NATGAS') return 3;
  if (symbol.startsWith('BTC') || symbol === 'US30' || symbol === 'NAS100' || symbol === 'SPX500') return 1;
  if (symbol === 'USOIL' || symbol === 'UKOIL') return 2;
  return 5;
}

export default function Watchlist() {
  const { activeSymbol, setActiveSymbol, prices } = useTradingStore();
  const [search, setSearch] = useState('');

  // Track previous prices for flash direction
  const prevPricesRef = useRef<Record<string, number>>({});
  const [flashState, setFlashState] = useState<Record<string, 'up' | 'down' | null>>({});

  // Detect price direction changes and trigger flash
  useEffect(() => {
    const newFlash: Record<string, 'up' | 'down' | null> = {};
    let hasChange = false;

    for (const symbol of Object.keys(prices)) {
      const current = prices[symbol].bid;
      const prev = prevPricesRef.current[symbol];

      if (prev !== undefined && current !== prev) {
        newFlash[symbol] = current > prev ? 'up' : 'down';
        hasChange = true;
      }
      prevPricesRef.current[symbol] = current;
    }

    if (hasChange) {
      setFlashState((old) => ({ ...old, ...newFlash }));

      // Clear flash after 400ms
      const timeout = setTimeout(() => {
        setFlashState((old) => {
          const cleared: Record<string, 'up' | 'down' | null> = {};
          for (const key of Object.keys(old)) {
            cleared[key] = null;
          }
          return cleared;
        });
      }, 400);

      return () => clearTimeout(timeout);
    }
  }, [prices]);

  // Track tick direction per symbol
  const directionRef = useRef<Record<string, 'up' | 'down' | 'neutral'>>({});

  useEffect(() => {
    for (const symbol of Object.keys(prices)) {
      const current = prices[symbol].bid;
      const prev = prevPricesRef.current[symbol];
      if (prev !== undefined) {
        if (current > prev) directionRef.current[symbol] = 'up';
        else if (current < prev) directionRef.current[symbol] = 'down';
      }
    }
  }, [prices]);

  const items = useMemo(() => {
    const list: WatchlistItemWithDirection[] = defaultWatchlist.map((item) => {
      const live = prices[item.symbol];
      const direction = directionRef.current[item.symbol] ?? 'neutral';
      if (live) {
        return {
          ...item,
          bid: live.bid,
          ask: live.ask,
          spread: live.spread,
          direction,
        };
      }
      return { ...item, direction };
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
      <div className="p-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div
          className="flex items-center gap-2 px-2 py-1.5 rounded text-sm"
          style={{ backgroundColor: '#111118' }}
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
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
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
          const flash = flashState[item.symbol];

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
                backgroundColor: flash === 'up'
                  ? 'rgba(0,194,122,0.08)'
                  : flash === 'down'
                  ? 'rgba(193,18,31,0.08)'
                  : isActive
                  ? '#111118'
                  : 'transparent',
                transition: 'background-color 0.15s ease',
              }}
            >
              <div className="text-left flex items-center gap-1">
                <div>
                  <div className="font-medium text-xs flex items-center gap-1">
                    {item.symbol}
                    {item.direction === 'up' && (
                      <ArrowUp size={10} className="text-green-400" />
                    )}
                    {item.direction === 'down' && (
                      <ArrowDown size={10} className="text-red-400" />
                    )}
                  </div>
                  <div className="text-[10px] opacity-40 truncate">
                    {item.description}
                  </div>
                </div>
              </div>
              <span
                className={cn(
                  'font-mono text-right w-16',
                  flash === 'up' ? 'text-green-300' : flash === 'down' ? 'text-red-300' : isPositive ? 'text-green-400' : 'text-red-400'
                )}
              >
                {formatPrice(item.bid, decimals)}
              </span>
              <span
                className={cn(
                  'font-mono text-right w-16',
                  flash === 'up' ? 'text-green-300' : flash === 'down' ? 'text-red-300' : isPositive ? 'text-green-400' : 'text-red-400'
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

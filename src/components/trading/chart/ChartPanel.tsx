'use client';

import { useState } from 'react';
import { BarChart3, Pencil } from 'lucide-react';
import { useTradingStore } from '@/stores/trading';
import { cn } from '@/lib/utils/format';

const timeframes = ['1m', '5m', '15m', '1H', '4H', '1D'] as const;

export default function ChartPanel() {
  const { activeSymbol } = useTradingStore();
  const [selectedTf, setSelectedTf] = useState<string>('1H');

  return (
    <div className="flex flex-col h-full w-full">
      {/* Chart toolbar */}
      <div
        className="flex items-center gap-1 px-3 py-1 border-b shrink-0"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border)',
        }}
      >
        {/* Symbol label */}
        <span
          className="text-xs font-bold mr-3"
          style={{ color: '#29ABE2' }}
        >
          {activeSymbol}
        </span>

        {/* Timeframe buttons */}
        {timeframes.map((tf) => (
          <button
            key={tf}
            onClick={() => setSelectedTf(tf)}
            className={cn(
              'px-2 py-1 text-[11px] font-mono rounded transition-all',
              selectedTf === tf
                ? 'font-bold opacity-100'
                : 'opacity-40 hover:opacity-70'
            )}
            style={{
              backgroundColor:
                selectedTf === tf ? 'var(--bg-elevated)' : 'transparent',
            }}
          >
            {tf}
          </button>
        ))}

        {/* Divider */}
        <div
          className="w-px h-4 mx-2"
          style={{ backgroundColor: 'var(--border)' }}
        />

        {/* Indicators button */}
        <button
          className="flex items-center gap-1 px-2 py-1 text-[11px] rounded opacity-50 hover:opacity-80 transition-opacity"
          style={{ backgroundColor: 'var(--bg-elevated)' }}
        >
          <BarChart3 size={12} />
          Indicators
        </button>

        {/* Drawing tools button */}
        <button
          className="flex items-center gap-1 px-2 py-1 text-[11px] rounded opacity-50 hover:opacity-80 transition-opacity"
          style={{ backgroundColor: 'var(--bg-elevated)' }}
        >
          <Pencil size={12} />
          Draw
        </button>
      </div>

      {/* Chart area placeholder */}
      <div
        className="flex-1 flex items-center justify-center"
        style={{ backgroundColor: 'var(--bg-main, #0d1117)' }}
      >
        <div className="text-center opacity-20">
          <BarChart3 size={48} className="mx-auto mb-3" />
          <div className="text-sm font-medium">TradingView Chart</div>
          <div className="text-xs mt-1">
            {activeSymbol} &middot; {selectedTf}
          </div>
        </div>
      </div>
    </div>
  );
}

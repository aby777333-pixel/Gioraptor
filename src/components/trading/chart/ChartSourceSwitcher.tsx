'use client';

// Chart source switcher: TradingView live data (default) ⇄ native RAPTOR
// chart. Purely additive wrapper — ChartPanel is mounted unchanged, and the
// order/quote engine is untouched.

import { useState } from 'react';
import ChartPanel from './ChartPanel';
import TradingViewPanel from './TradingViewPanel';
import type { OHLCVBuilder } from '@/lib/trading/ohlcv-builder';

type ChartSource = 'tradingview' | 'raptor';

export default function ChartSourceSwitcher({
  ohlcvBuilder,
  isLiveData = false,
}: {
  ohlcvBuilder: OHLCVBuilder | null;
  isLiveData?: boolean;
}) {
  const [source, setSource] = useState<ChartSource>('tradingview');

  return (
    <div
      className="flex h-full w-full flex-col"
      // EA drag-and-drop lands on the RAPTOR chart's drop zone; the TradingView
      // iframe would swallow the drop, so flip tabs as soon as a drag enters.
      onDragEnter={() => { if (source === 'tradingview') setSource('raptor'); }}
    >
      {/* Source tabs */}
      <div
        className="flex shrink-0 items-center gap-1 border-b px-2"
        style={{ height: 30, minHeight: 30, backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
      >
        {(
          [
            { id: 'tradingview' as const, label: 'TradingView (Live Data)' },
            { id: 'raptor' as const, label: 'RAPTOR Chart' },
          ]
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSource(tab.id)}
            className="rounded px-2.5 py-1 font-mono text-[11px] transition-colors"
            style={{
              backgroundColor: source === tab.id ? 'rgba(41,171,226,0.15)' : 'transparent',
              color: source === tab.id ? '#0091D5' : 'rgba(255,255,255,0.45)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active chart */}
      <div className="min-h-0 flex-1">
        {source === 'tradingview' ? (
          <TradingViewPanel />
        ) : (
          <ChartPanel ohlcvBuilder={ohlcvBuilder} isLiveData={isLiveData} />
        )}
      </div>
    </div>
  );
}

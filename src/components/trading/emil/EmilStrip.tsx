'use client';

// EMIL strip — a one-line live council read embedded inside the Scanner and
// Hedge panels, with a hand-off into the full EMIL console. Display-only.

import { useEffect, useRef, useState } from 'react';
import { useTradingStore } from '@/stores/trading';
import type { OHLCVBuilder } from '@/lib/trading/ohlcv-builder';
import { getCalendar, type NewsEvent } from '@/lib/trading/news-guard';
import { getInstrumentSpecs, type InstrumentSpec } from '@/lib/insights/risk';
import { buildCouncil, isEmilOnboarded, type EmilConsensus } from '@/lib/trading/emil-council';

export default function EmilStrip({ ohlcvBuilder, onOpenEmil }: { ohlcvBuilder: OHLCVBuilder | null; onOpenEmil: () => void }) {
  const { activeSymbol, prices, positions, activeAccountId, accountSummary } = useTradingStore();
  const [council, setCouncil] = useState<EmilConsensus | null>(null);
  const [calendar, setCalendar] = useState<NewsEvent[]>([]);
  const [specs, setSpecs] = useState<Record<string, InstrumentSpec> | null>(null);
  const builderRef = useRef(ohlcvBuilder);
  builderRef.current = ohlcvBuilder;

  useEffect(() => { getCalendar().then(setCalendar); }, []);
  useEffect(() => { getInstrumentSpecs().then(setSpecs).catch(() => {}); }, []);

  useEffect(() => {
    if (!isEmilOnboarded()) return; // EMIL stays silent until woken
    const compute = () => {
      const builder = builderRef.current;
      if (!builder) return;
      setCouncil(buildCouncil({
        builder, symbol: activeSymbol, ticks: prices, calendar, positions,
        history: [], specs, accountId: activeAccountId,
        balance: Number(accountSummary?.balance ?? 0), isLiveData: false,
      }));
    };
    compute();
    const id = setInterval(compute, 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSymbol, calendar.length, specs]);

  if (!isEmilOnboarded()) {
    return (
      <button onClick={onOpenEmil}
        className="flex w-full items-center gap-2 rounded border px-3 py-1.5 text-[10px] transition-all hover:brightness-125"
        style={{ borderColor: 'rgba(255,213,79,0.25)', backgroundColor: 'rgba(255,213,79,0.04)', color: 'rgba(255,213,79,0.7)' }}>
        🧠 EMIL is asleep — click to wake the Agent Council (observe-only)
      </button>
    );
  }

  return (
    <button onClick={onOpenEmil}
      className="flex w-full items-center gap-2 rounded border px-3 py-1.5 text-left font-mono text-[10px] transition-all hover:brightness-125"
      style={{ borderColor: 'rgba(255,213,79,0.3)', backgroundColor: 'rgba(255,213,79,0.05)', color: '#FFD54F' }}
      title="EMIL Agent Council — click for the full console">
      🧠 {council ? council.headline : `EMIL · reading ${activeSymbol}…`}
    </button>
  );
}

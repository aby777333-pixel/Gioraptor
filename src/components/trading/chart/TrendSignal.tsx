'use client';

// Live trend signal beacon. Sits in the shared TimeframeBar's free space and
// works over BOTH charts. Computed from REAL platform bars via the existing
// NEXUS engines (classifyMarketState + computeEntryZone) on the active
// symbol/timeframe:
//   - trending regime  → BUY / SELL with a full entry/exit plan
//   - chop / range     → NO-TRADE ("stand aside") with the reason
//   - not enough bars  → neutral placeholder
// Display-only: it never places orders, and every plan carries warnings +
// a heuristic disclaimer. Recomputes on a short interval and on symbol/TF
// change — never per tick, so the header stays cheap.

import { useEffect, useRef, useState } from 'react';
import { TrendingUp, TrendingDown, PauseOctagon, Activity } from 'lucide-react';
import HeaderPortal from './HeaderPortal';
import { useTradingStore } from '@/stores/trading';
import { classifyMarketState, type MarketStateAssessment } from '@/lib/nexus/market-state';
import { computeEntryZone, type EntryZoneAssessment, type NoSetupAssessment } from '@/lib/nexus/entry-exit';
import { TF_TO_RESOLUTION, type OHLCVBuilder, type Resolution } from '@/lib/trading/ohlcv-builder';

type SignalKind = 'BUY' | 'SELL' | 'WAIT' | 'NONE';

interface SignalRead {
  kind: SignalKind;
  state: MarketStateAssessment | null;
  zone: EntryZoneAssessment | NoSetupAssessment | null;
  warnings: string[];
  tfLabel: string;
  symbol: string;
}

const KIND_META: Record<SignalKind, { label: string; hex: string; rgb: string }> = {
  BUY:  { label: 'BUY',      hex: '#00C27A', rgb: '0,194,122' },
  SELL: { label: 'SELL',     hex: '#FF5252', rgb: '255,82,82' },
  WAIT: { label: 'NO-TRADE', hex: '#FFB300', rgb: '255,179,0' },
  NONE: { label: 'SIGNAL',   hex: '#8B93A7', rgb: '139,147,167' },
};

const TF_LABELS: Record<string, string> = {
  '1m': 'M1', '5m': 'M5', '15m': 'M15', '30m': 'M30',
  '1H': 'H1', '4H': 'H4', '1D': 'D1', '1W': 'W1', '1Mo': 'MN',
};

function isZone(z: EntryZoneAssessment | NoSetupAssessment | null): z is EntryZoneAssessment {
  return !!z && 'direction' in z;
}

export default function TrendSignal({ ohlcvBuilder }: { ohlcvBuilder: OHLCVBuilder | null }) {
  const activeSymbol = useTradingStore((s) => s.activeSymbol);
  const activeTimeframe = useTradingStore((s) => s.activeTimeframe);
  const [read, setRead] = useState<SignalRead>({ kind: 'NONE', state: null, zone: null, warnings: [], tfLabel: 'H1', symbol: '' });
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  const builderRef = useRef(ohlcvBuilder);
  builderRef.current = ohlcvBuilder;

  useEffect(() => {
    const h = (e: MouseEvent) => { if (anchorRef.current && !anchorRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    const compute = () => {
      const tfLabel = TF_LABELS[activeTimeframe] ?? activeTimeframe;
      const builder = builderRef.current;
      const resolution: Resolution = TF_TO_RESOLUTION[activeTimeframe] ?? '60';
      const bars = builder ? builder.getAllBars(activeSymbol, resolution) : [];
      const state = classifyMarketState(bars);
      if (!state) {
        setRead({ kind: 'NONE', state: null, zone: null, warnings: [], tfLabel, symbol: activeSymbol });
        return;
      }
      const price = bars[bars.length - 1].close;
      const trending = state.state.includes('Uptrend') || state.state.includes('Downtrend');
      if (!trending) {
        setRead({
          kind: 'WAIT', state, zone: computeEntryZone(activeSymbol, bars, state, price),
          warnings: [
            `Regime is "${state.state}" — trend signals are suppressed in chop to avoid whipsaw losses.`,
            'Standing aside is the disciplined play until a trend confirms (ADX pushing above ~22).',
          ],
          tfLabel, symbol: activeSymbol,
        });
        return;
      }
      const zone = computeEntryZone(activeSymbol, bars, state, price);
      const warnings: string[] = [];
      if (state.state.includes('Weak')) warnings.push('Weak trend — lower conviction; smaller size or waiting for strength is prudent.');
      if (state.volatility === 'High Volatility') warnings.push('High volatility — widen stops and reduce position size accordingly.');
      if (state.confidence < 50) warnings.push(`Low signal confidence (${state.confidence}%) — treat as context, not a trigger.`);
      if (isZone(zone) && Math.abs(price - zone.preferred) > 0) {
        const stretchWarn = zone.evidence.find((e) => e.includes('extended'));
        if (stretchWarn) warnings.push('Price is extended from the entry anchor — chasing here worsens the risk:reward.');
      }
      setRead({
        kind: state.state.includes('Uptrend') ? 'BUY' : 'SELL',
        state, zone, warnings, tfLabel, symbol: activeSymbol,
      });
    };
    compute();
    const id = setInterval(compute, 5000);
    return () => clearInterval(id);
  }, [activeSymbol, activeTimeframe]);

  const meta = KIND_META[read.kind];
  const glow = read.kind !== 'NONE';

  return (
    <div className="relative shrink-0" ref={anchorRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        title={
          read.kind === 'NONE'
            ? 'Trend signal — collecting bar history for this symbol/timeframe'
            : read.kind === 'WAIT'
              ? `No-trade zone: ${read.state?.state ?? 'chop'} — click for why`
              : `${meta.label} signal on ${read.symbol} (${read.tfLabel}) — click for the entry/exit plan`
        }
        className="flex items-center gap-1.5 rounded px-2.5 py-0.5 font-mono text-[11px] font-bold transition-all"
        style={{
          background: glow
            ? `linear-gradient(180deg, rgba(${meta.rgb},0.30) 0%, rgba(${meta.rgb},0.10) 100%)`
            : `rgba(${meta.rgb},0.08)`,
          color: glow ? meta.hex : `rgba(${meta.rgb},0.6)`,
          border: `1px solid rgba(${meta.rgb},${glow ? 0.7 : 0.2})`,
          boxShadow: glow
            ? `0 0 12px rgba(${meta.rgb},0.45), 0 0 3px rgba(${meta.rgb},0.55), inset 0 1px 0 rgba(255,255,255,0.2)`
            : 'none',
          textShadow: glow ? `0 0 8px rgba(${meta.rgb},0.85)` : 'none',
        }}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${glow ? 'animate-pulse' : ''}`} style={{ backgroundColor: glow ? meta.hex : `rgba(${meta.rgb},0.5)` }} />
        {read.kind === 'BUY' && <TrendingUp size={12} />}
        {read.kind === 'SELL' && <TrendingDown size={12} />}
        {read.kind === 'WAIT' && <PauseOctagon size={12} />}
        {read.kind === 'NONE' && <Activity size={12} />}
        {meta.label}
        {read.kind !== 'NONE' && read.state && (
          <span className="hidden font-normal opacity-70 md:inline">· {read.state.confidence}%</span>
        )}
      </button>

      <HeaderPortal open={open} anchorRef={anchorRef}>
        <div className="w-[320px] rounded-lg border shadow-2xl" style={{ backgroundColor: '#0A0F1A', borderColor: `rgba(${meta.rgb},0.35)` }}>
          {/* Header */}
          <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <span className="text-[12px] font-bold" style={{ color: meta.hex }}>
              {read.kind === 'WAIT' ? '⚠ Stand aside' : read.kind === 'NONE' ? 'Trend signal' : `${meta.label} — trend signal`}
            </span>
            <span className="font-mono text-[10px] text-white/40">{read.symbol} · {read.tfLabel}</span>
          </div>

          <div className="max-h-[380px] overflow-y-auto p-3 text-[11px]" style={{ scrollbarWidth: 'thin' }}>
            {read.kind === 'NONE' && (
              <p className="leading-relaxed text-white/55">
                Collecting bar history for {read.symbol} on {read.tfLabel} — the signal engine needs ~60 bars
                before it will make a call. Switch to a lower timeframe or give it a moment.
              </p>
            )}

            {read.state && (
              <div className="mb-2 flex items-center justify-between rounded px-2 py-1.5" style={{ backgroundColor: `rgba(${meta.rgb},0.08)`, border: `1px solid rgba(${meta.rgb},0.2)` }}>
                <span className="font-semibold text-white/85">{read.state.state}</span>
                <span className="font-mono text-[10px]" style={{ color: meta.hex }}>
                  {read.state.confidence}% · {read.state.volatility.replace(' Volatility', ' vol')}
                </span>
              </div>
            )}

            {/* Entry / exit plan (trending regimes) */}
            {(read.kind === 'BUY' || read.kind === 'SELL') && isZone(read.zone) && (
              <div className="mb-2">
                <div className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-white/35">Where to enter</div>
                <PlanRow k="Preferred (pullback)" v={String(read.zone.preferred)} accent={meta.hex} />
                <PlanRow k="Aggressive (market)" v={String(read.zone.aggressive)} />
                <PlanRow k="Conservative (deep)" v={String(read.zone.conservative)} />
                <div className="mb-1 mt-2 text-[9px] font-semibold uppercase tracking-wider text-white/35">Where to exit</div>
                <PlanRow k="Stop loss" v={String(read.zone.stop)} accent="#FF5252" />
                <PlanRow k={`Target 1 (${read.zone.riskReward1}R)`} v={String(read.zone.target1)} accent="#00C27A" />
                <PlanRow k="Target 2" v={String(read.zone.target2)} accent="#00C27A" />
                <p className="mt-1.5 leading-relaxed text-white/45">{read.zone.invalidation}</p>
              </div>
            )}

            {/* No-setup reason (chop / range) */}
            {read.zone && !isZone(read.zone) && read.kind !== 'NONE' && (
              <p className="mb-2 leading-relaxed text-white/60">{read.zone.reason}</p>
            )}

            {/* Warnings */}
            {read.warnings.length > 0 && (
              <div className="mb-2 rounded border px-2 py-1.5" style={{ borderColor: 'rgba(255,179,0,0.3)', backgroundColor: 'rgba(255,179,0,0.06)' }}>
                {read.warnings.map((w, i) => (
                  <p key={i} className="leading-relaxed" style={{ color: '#FFB300' }}>⚠ {w}</p>
                ))}
              </div>
            )}

            {/* Evidence */}
            {read.state && (
              <div className="mb-2">
                <div className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-white/35">Evidence (real platform bars)</div>
                {read.state.evidence.map((e, i) => (
                  <p key={i} className="leading-relaxed text-white/45">· {e}</p>
                ))}
              </div>
            )}

            <p className="border-t pt-2 text-[9px] leading-relaxed text-white/30" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              Heuristic assessment computed from real platform bars — not financial advice and never a
              guarantee. Signals are suppressed in choppy regimes by design; no entry is risk-free.
            </p>
          </div>
        </div>
      </HeaderPortal>
    </div>
  );
}

function PlanRow({ k, v, accent }: { k: string; v: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-white/45">{k}</span>
      <span className="font-mono font-semibold" style={{ color: accent ?? 'rgba(255,255,255,0.85)' }}>{v}</span>
    </div>
  );
}

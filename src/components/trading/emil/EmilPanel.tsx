'use client';

// EMIL — Evolving Market Intelligence Lab · console (Phase 1, OBSERVE mode).
// Inert until the trader completes onboarding (disclaimer acceptance).
// Shows the presence orb, the live Agent Council over the platform's real
// engines, an explainable consensus, and hand-off buttons into the Scanner,
// Hedge engine and NEXUS. EMIL v1 owns NO execution: Assist/Confirm/Semi/
// Autonomous/Away modes are visible but locked for later phases behind
// typed consent and feature flags.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, BrainCircuit } from 'lucide-react';
import { useTradingStore } from '@/stores/trading';
import { orderService } from '@/lib/trading/order-service';
import { getInstrumentSpecs, type InstrumentSpec } from '@/lib/insights/risk';
import type { OHLCVBuilder } from '@/lib/trading/ohlcv-builder';
import { getCalendar, type NewsEvent } from '@/lib/trading/news-guard';
import type { ClosedTrade } from '@/lib/trading/trader-metrics';
import {
  buildCouncil, isEmilOnboarded, recordEmilOnboarding, EMIL_DISCLAIMER,
  type EmilConsensus, type CouncilStance,
} from '@/lib/trading/emil-council';

const ORB: Record<string, { color: string; label: string }> = {
  inactive: { color: '#8B93A7', label: 'INACTIVE — onboarding required' },
  observing: { color: '#29ABE2', label: 'OBSERVING' },
  standaside: { color: '#FFB300', label: 'CAUTIOUS — stand aside' },
  locked: { color: '#FF5252', label: 'CAPITAL LOCK' },
};

const stanceColor = (s: CouncilStance) => (s === 'bull' ? '#00C27A' : s === 'bear' ? '#FF5252' : '#8B93A7');

export default function EmilPanel({ ohlcvBuilder, isLiveData, onClose, standalone = false }: {
  ohlcvBuilder: OHLCVBuilder | null; isLiveData: boolean; onClose: () => void; standalone?: boolean;
}) {
  const { activeSymbol, prices, positions, activeAccountId, accountSummary, setActiveSymbol } = useTradingStore();
  const [onboarded, setOnboarded] = useState(false);
  const [ticked, setTicked] = useState(false);
  const [specs, setSpecs] = useState<Record<string, InstrumentSpec> | null>(null);
  const [calendar, setCalendar] = useState<NewsEvent[]>([]);
  const [history, setHistory] = useState<ClosedTrade[]>([]);
  const [council, setCouncil] = useState<EmilConsensus | null>(null);
  const [showWhy, setShowWhy] = useState(false);
  const builderRef = useRef(ohlcvBuilder);
  builderRef.current = ohlcvBuilder;

  useEffect(() => { setOnboarded(isEmilOnboarded()); }, []);
  useEffect(() => { getInstrumentSpecs().then(setSpecs).catch(() => {}); }, []);
  useEffect(() => { getCalendar().then(setCalendar); }, []);
  useEffect(() => {
    if (!activeAccountId) return;
    let active = true;
    orderService.getTradeHistory(activeAccountId, 60)
      .then((rows) => { if (active) setHistory(rows as unknown as ClosedTrade[]); })
      .catch(() => {});
    return () => { active = false; };
  }, [activeAccountId]);

  // Council recompute: on symbol change + every 20s while onboarded.
  useEffect(() => {
    if (!onboarded) return;
    const compute = () => {
      const builder = builderRef.current;
      if (!builder) return;
      setCouncil(buildCouncil({
        builder, symbol: activeSymbol, ticks: prices, calendar, positions,
        history, specs, accountId: activeAccountId,
        balance: Number(accountSummary?.balance ?? 0), isLiveData,
      }));
    };
    compute();
    const id = setInterval(compute, 20_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboarded, activeSymbol, calendar.length, specs, history.length]);

  const askNexus = useCallback(() => {
    try {
      window.dispatchEvent(new CustomEvent('nexus-ask', {
        detail: { q: `EMIL council reads ${activeSymbol} as ${council?.stance ?? 'unknown'} (${council?.bulls ?? 0} bull / ${council?.bears ?? 0} bear). Give me your independent read on ${activeSymbol} right now and what would invalidate it.` },
      }));
      if (standalone) window.open('/terminal', '_blank');
    } catch { /* ignore */ }
  }, [activeSymbol, council, standalone]);

  const orbState = !onboarded ? 'inactive'
    : council?.protectionState === 'LOCKED' ? 'locked'
    : council?.stance === 'STAND ASIDE' ? 'standaside'
    : 'observing';
  const orb = ORB[orbState];

  return (
    <div
      className={standalone ? 'flex w-full items-start justify-center p-4' : 'fixed inset-0 z-[9500] flex items-start justify-center overflow-y-auto p-4'}
      style={standalone ? undefined : { backgroundColor: 'rgba(3,7,12,0.88)', backdropFilter: 'blur(3px)' }}
      onMouseDown={standalone ? undefined : (e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`w-full rounded-xl border shadow-2xl ${standalone ? '' : 'my-4 max-w-[980px]'}`} style={{ backgroundColor: '#080D16', borderColor: 'rgba(255,213,79,0.3)' }}>
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <span className="relative flex h-4 w-4 items-center justify-center">
            <span className="absolute h-4 w-4 animate-ping rounded-full" style={{ backgroundColor: `${orb.color}55`, animationDuration: '2.5s' }} />
            <span className="relative h-2.5 w-2.5 rounded-full" style={{ backgroundColor: orb.color, boxShadow: `0 0 8px ${orb.color}` }} />
          </span>
          <div className="flex items-center gap-2 text-[15px] font-bold text-white">
            <BrainCircuit size={16} style={{ color: '#FFD54F' }} /> EMIL
            <span className="text-[10px] font-normal text-white/40">Evolving Market Intelligence Lab</span>
          </div>
          <span className="rounded px-2 py-0.5 font-mono text-[9px] font-bold" style={{ backgroundColor: `${orb.color}1F`, color: orb.color, border: `1px solid ${orb.color}66` }}>
            {orb.label}
          </span>
          <span className="rounded px-2 py-0.5 text-[9px] font-bold" style={{ backgroundColor: 'rgba(41,171,226,0.12)', color: '#29ABE2', border: '1px solid rgba(41,171,226,0.35)' }}>
            MODE: OBSERVE
          </span>
          <span className="text-[9px] text-white/35">Assist · Confirm · Semi-Auto · Autonomous · Away 🔒 (later phases, typed consent required)</span>
          <div className="ml-auto flex items-center gap-2">
            {!standalone && (
              <button onClick={() => window.open('/terminal/emil', '_blank')}
                title="Open EMIL as a standalone window (new tab) — ideal for a second monitor"
                className="rounded px-2.5 py-1.5 text-[10px] font-bold transition-all hover:brightness-125"
                style={{ backgroundColor: 'rgba(255,213,79,0.1)', color: '#FFD54F', border: '1px solid rgba(255,213,79,0.4)' }}>
                ⧉ Window
              </button>
            )}
            <button onClick={onClose} className="rounded p-1.5 text-white/40 transition-colors hover:text-white"><X size={16} /></button>
          </div>
        </div>

        <div className={`overflow-y-auto p-4 ${standalone ? '' : 'max-h-[74vh]'}`} style={{ scrollbarWidth: 'thin' }}>
          {/* Onboarding gate — EMIL is fully inert until accepted */}
          {!onboarded && (
            <div className="mx-auto max-w-[640px] rounded-lg border p-4" style={{ borderColor: 'rgba(255,213,79,0.35)', backgroundColor: 'rgba(255,213,79,0.04)' }}>
              <div className="mb-2 text-[13px] font-bold text-white">Wake EMIL — onboarding</div>
              <p className="mb-2 text-[11px] leading-relaxed text-white/60">
                EMIL coordinates the platform&apos;s live engines (regime, entry zones, scanner, hedge, news, Shield,
                behaviour and exposure — including the NEXUS market-state engines) into one explainable read. In this
                version EMIL only <b>observes and explains</b>: it places no orders, changes no settings, and stays
                silent until you wake it. Prime directive: preserve capital → control risk → seek quality.
              </p>
              <p className="mb-3 rounded border px-3 py-2 text-[10px] leading-relaxed" style={{ borderColor: 'rgba(255,179,0,0.3)', backgroundColor: 'rgba(255,179,0,0.05)', color: 'rgba(255,213,120,0.9)' }}>
                {EMIL_DISCLAIMER}
              </p>
              <label className="mb-3 flex items-start gap-2 text-[11px] text-white/70">
                <input type="checkbox" checked={ticked} onChange={(e) => setTicked(e.target.checked)} className="mt-0.5 accent-[#FFD54F]" />
                I have read and accept the disclaimer. I understand EMIL v1 is observe-only and that all trading decisions remain mine.
              </label>
              <button
                onClick={() => { if (!ticked) return; recordEmilOnboarding(); setOnboarded(true); }}
                disabled={!ticked}
                className="rounded px-4 py-2 text-[11px] font-bold text-black transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30"
                style={{ background: 'linear-gradient(180deg,#FFD54F,#FFB300)', boxShadow: ticked ? '0 0 14px rgba(255,213,79,0.5)' : 'none' }}>
                Wake EMIL — Observe mode
              </button>
            </div>
          )}

          {onboarded && (
            <>
              {/* Consensus header */}
              <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border p-3" style={{ borderColor: 'rgba(255,213,79,0.25)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                <select value={activeSymbol} onChange={(e) => setActiveSymbol(e.target.value)}
                  className="rounded bg-white/[0.06] px-2 py-1.5 font-mono text-[12px] font-bold text-white outline-none" style={{ border: '1px solid rgba(255,255,255,0.12)' }}>
                  {Object.keys(prices).filter((s) => prices[s]?.bid != null).map((s) => <option key={s} value={s} style={{ backgroundColor: '#0A0F1A' }}>{s}</option>)}
                </select>
                {council && (
                  <>
                    <span className="font-mono text-[12px] text-white/70">{council.bulls}🐂 {council.bears}🐻 {council.neutrals}◽</span>
                    <span className="rounded px-2 py-1 text-[11px] font-bold"
                      style={{
                        color: council.stance === 'BULLISH LEAN' ? '#00C27A' : council.stance === 'BEARISH LEAN' ? '#FF5252' : '#FFB300',
                        border: '1px solid rgba(255,255,255,0.15)',
                      }}>
                      {council.stance}{council.stance.includes('LEAN') ? ` · ${council.confidence}%` : ''}
                    </span>
                    <span className="text-[9px] text-white/35">protection {council.protectionState} · updated {new Date(council.computedAt).toLocaleTimeString()}</span>
                  </>
                )}
                <div className="ml-auto flex gap-2">
                  <button onClick={() => setShowWhy((s) => !s)} className="rounded px-2.5 py-1 text-[10px] font-bold transition-all hover:brightness-125"
                    style={{ backgroundColor: 'rgba(255,213,79,0.1)', color: '#FFD54F', border: '1px solid rgba(255,213,79,0.35)' }}>
                    {showWhy ? 'Hide reasoning' : 'Why? / What could go wrong'}
                  </button>
                  <button onClick={askNexus} className="rounded px-2.5 py-1 text-[10px] font-bold transition-all hover:brightness-125"
                    style={{ backgroundColor: 'rgba(0,145,213,0.12)', color: '#0091D5', border: '1px solid rgba(0,145,213,0.4)' }}
                    title="Hand this council read to NEXUS for an independent second opinion">
                    Ask NEXUS
                  </button>
                </div>
              </div>

              {showWhy && council && (
                <div className="mb-3 rounded-lg border p-3 text-[11px] leading-relaxed text-white/65" style={{ borderColor: 'rgba(255,213,79,0.2)' }}>
                  {council.explanation.map((l, i) => <p key={i} className="mb-1.5 last:mb-0">{l}</p>)}
                </div>
              )}

              {/* Agent Council grid */}
              {council && (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {council.votes.map((v) => (
                    <div key={v.agent} className="rounded-lg border p-2.5" style={{ borderColor: `${stanceColor(v.stance)}33`, backgroundColor: 'rgba(255,255,255,0.02)' }}>
                      <div className="flex items-center gap-2">
                        <span>{v.icon}</span>
                        <span className="text-[11px] font-bold text-white/85">{v.agent}</span>
                        <span className="ml-auto rounded px-1.5 py-0.5 text-[8px] font-bold uppercase" style={{ backgroundColor: `${stanceColor(v.stance)}1F`, color: stanceColor(v.stance), border: `1px solid ${stanceColor(v.stance)}55` }}>
                          {v.stance}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 rounded bg-white/[0.05]">
                        <div className="h-full rounded" style={{ width: `${v.confidence}%`, backgroundColor: stanceColor(v.stance) }} />
                      </div>
                      <p className="mt-1 text-[9px] leading-relaxed text-white/45">{v.note}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Hand-offs — EMIL never executes; it walks you to the tools */}
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="text-[9px] uppercase tracking-wide text-white/30">Act through the tools (EMIL never places orders):</span>
                <button onClick={() => window.open('/terminal/scan-trade', '_blank')} className="rounded px-2.5 py-1 text-[9px] font-bold transition-all hover:brightness-125" style={{ backgroundColor: 'rgba(41,171,226,0.1)', color: '#29ABE2', border: '1px solid rgba(41,171,226,0.35)' }}>📡 Scan & Trade</button>
                <button onClick={() => window.open('/terminal/hedge-trade', '_blank')} className="rounded px-2.5 py-1 text-[9px] font-bold transition-all hover:brightness-125" style={{ backgroundColor: 'rgba(171,71,188,0.1)', color: '#CE93D8', border: '1px solid rgba(171,71,188,0.35)' }}>⇄ Hedge & Trade</button>
              </div>
            </>
          )}

          <p className="mt-4 text-[9px] leading-relaxed text-white/30">
            EMIL is decision support, not a guarantee. Every council read is an estimate over {isLiveData ? 'live' : 'simulated platform'} data;
            engines can be wrong individually and collectively. Execution modes arrive in later phases behind typed consent,
            feature flags and full audit logging — nothing trades on your behalf today.
          </p>
        </div>
      </div>
    </div>
  );
}

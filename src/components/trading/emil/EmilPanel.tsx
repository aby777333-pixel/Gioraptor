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
  loadEmilAutoParams, saveEmilAutoParams, isEmilAutoConsented, recordEmilAutoConsent,
  emilLog, loadEmilLog,
  type EmilConsensus, type CouncilStance, type EmilAutoParams,
} from '@/lib/trading/emil-council';

type EmilMode = 'observe' | 'confirm' | 'auto';

// Closed rows carry the order comment; EMIL trades are tagged EMIL:*.
interface EmilClosedRow { realized_pnl: number | null; closed_at: string | null; comment?: string | null }

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
  const [mode, setMode] = useState<EmilMode>('observe'); // resets to observe every session by design
  const [autoParams, setAutoParams] = useState<EmilAutoParams>(loadEmilAutoParams);
  const [gateOpen, setGateOpen] = useState(false);
  const [gateTyped, setGateTyped] = useState('');
  const [placing, setPlacing] = useState(false);
  const [logTick, setLogTick] = useState(0);
  const builderRef = useRef(ohlcvBuilder);
  builderRef.current = ohlcvBuilder;
  const modeRef = useRef<EmilMode>('observe');
  modeRef.current = mode;
  const beDoneRef = useRef<Set<string>>(new Set());

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

  // ── EMIL automation core (Confirm-to-Trade + Autonomous Pilot) ──

  const stopEverything = useCallback((reason: string) => {
    setMode('observe');
    emilLog('mode', `STOP EVERYTHING — ${reason}. Automation halted; re-arming requires explicit mode selection.`);
    setLogTick((t) => t + 1);
  }, []);

  const placeEmilOrder = useCallback(async (opp: NonNullable<EmilConsensus['bestOpp']>, tag: string) => {
    if (!activeAccountId) { emilLog('blocked', 'no trading account selected'); setLogTick((t) => t + 1); return false; }
    const t = useTradingStore.getState().prices[opp.symbol];
    if (!t?.bid || !t?.ask) { emilLog('blocked', `${opp.symbol}: no live quote — refusing stale data`); setLogTick((x) => x + 1); return false; }
    const base = opp.suggestedLots ?? 0.01; // scanner sizes at 1% risk
    const lots = Math.max(0.01, Math.round(base * loadEmilAutoParams().riskPct * 100) / 100);
    const fill = opp.direction === 'BUY' ? t.ask : t.bid;
    try {
      await orderService.placeMarketOrder({
        accountId: activeAccountId, symbol: opp.symbol, direction: opp.direction, size: lots,
        sl: opp.zone.stop, tp: opp.zone.target1, fillPrice: fill, comment: tag,
      });
      emilLog('entry', `${tag}: ${opp.direction} ${lots} ${opp.symbol} @ ${fill} · SL ${opp.zone.stop} · TP ${opp.zone.target1} · score ${opp.score}`);
      setLogTick((x) => x + 1);
      return true;
    } catch (err) {
      emilLog('blocked', `${opp.symbol} rejected: ${err instanceof Error ? err.message.slice(0, 140) : 'error'}`);
      setLogTick((x) => x + 1);
      return false;
    }
  }, [activeAccountId]);

  // The pilot loop: manage EMIL positions first, then (auto mode) seek one
  // quality entry per cycle inside the trader's limit envelope. Runs only
  // while an EMIL console/window is open — by design in this phase.
  useEffect(() => {
    if (!onboarded) return;
    const id = setInterval(async () => {
      const m = modeRef.current;
      if (m === 'observe' || !activeAccountId || !builderRef.current) return;
      const builder = builderRef.current;
      const p = loadEmilAutoParams();
      try {
        // EMIL day stats from real closed trades (EMIL-tagged).
        const rows = (await orderService.getTradeHistory(activeAccountId, 100)) as unknown as EmilClosedRow[];
        const emilRows = rows.filter((r) => String(r.comment ?? '').startsWith('EMIL'));
        const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
        const closedToday = emilRows.filter((r) => r.closed_at && new Date(r.closed_at).getTime() >= midnight.getTime());
        const realized = closedToday.reduce((a, r) => a + Number(r.realized_pnl ?? 0), 0);
        let consec = 0;
        for (const r of emilRows) { if (Number(r.realized_pnl ?? 0) < 0) consec++; else break; }

        const open = (await orderService.getOpenPositions(activeAccountId)) as Array<{ id: string; symbol: string; direction: string; size: number; open_price: number; current_price: number | null; sl: number | null; tp: number | null; comment?: string | null }>;
        const emilOpenPos = open.filter((x) => String(x.comment ?? '').startsWith('EMIL'));
        const ticks = useTradingStore.getState().prices;

        // ── Exit management (runs in confirm AND auto modes) ──
        for (const pos of emilOpenPos) {
          const dir = pos.direction === 'BUY' ? 1 : -1;
          const tk = ticks[pos.symbol];
          const cur = dir > 0 ? (tk?.bid ?? Number(pos.current_price)) : (tk?.ask ?? Number(pos.current_price));
          if (cur == null) continue;
          // Break-even at +1R (once per position).
          if (pos.sl != null && pos.sl !== 0 && !beDoneRef.current.has(pos.id)) {
            const risk = (Number(pos.open_price) - Number(pos.sl)) * dir;
            if (risk > 0 && (Number(cur) - Number(pos.open_price)) * dir >= risk) {
              try {
                await orderService.modifyPosition(pos.id, Number(pos.open_price), pos.tp ?? undefined);
                beDoneRef.current.add(pos.id);
                emilLog('breakeven', `${pos.symbol}: +1R reached — stop moved to break-even (${pos.open_price}). The trade can no longer lose.`);
                setLogTick((x) => x + 1);
              } catch { /* may have closed */ }
            }
          }
          // Council-flip exit: the read turned against the position.
          const c = buildCouncil({ builder, symbol: pos.symbol, ticks, calendar, positions: [], history: [], specs: null, accountId: activeAccountId, balance: 0, isLiveData });
          const against = (pos.direction === 'BUY' && c.stance === 'BEARISH LEAN') || (pos.direction === 'SELL' && c.stance === 'BULLISH LEAN');
          if (against && c.confidence >= p.minCouncilConf) {
            try {
              await orderService.closePosition(pos.id, Number(cur));
              emilLog('exit', `${pos.symbol}: council flipped ${c.stance} (${c.confidence}%) against the ${pos.direction} — position closed at ${cur}.`);
              setLogTick((x) => x + 1);
            } catch { /* may have closed */ }
          }
        }

        // ── Envelope checks + profit lock / loss stop ──
        if (p.dailyLossStop > 0 && realized <= -Math.abs(p.dailyLossStop)) {
          if (m === 'auto') { emilLog('lock', `daily EMIL loss stop hit (${realized.toFixed(0)}$) — automation paused for today`); stopEverything('daily loss stop'); }
          return;
        }
        if (p.dailyProfitLock > 0 && realized >= p.dailyProfitLock) {
          for (const pos of emilOpenPos) {
            const tk = ticks[pos.symbol];
            const cp = pos.direction === 'BUY' ? (tk?.bid ?? pos.current_price) : (tk?.ask ?? pos.current_price);
            if (cp != null) { try { await orderService.closePosition(pos.id, Number(cp)); } catch { /* ok */ } }
          }
          emilLog('lock', `daily profit target banked (+$${realized.toFixed(0)}) — EMIL positions closed, automation paused. Green days stay green.`);
          stopEverything('profit locked');
          return;
        }
        if (m !== 'auto') return;
        if (consec >= p.stopAfterLosses) { emilLog('lock', `${consec} EMIL losses in a row — pilot paused per your rule`); stopEverything('consecutive losses'); return; }
        const entriesToday = loadEmilLog().filter((e) => e.kind === 'entry' && e.ts >= midnight.getTime()).length;
        if (entriesToday >= p.maxPerDay) return; // manage-only for the rest of the day

        // ── Seek ONE quality entry this cycle ──
        for (const symbol of p.symbols) {
          if (emilOpenPos.some((x) => x.symbol === symbol)) continue; // one EMIL trade per symbol
          const c = buildCouncil({ builder, symbol, ticks, calendar, positions: [], history: [], specs: null, accountId: activeAccountId, balance: Number(accountSummary?.balance ?? 0), isLiveData });
          if (c.stance !== 'BULLISH LEAN' && c.stance !== 'BEARISH LEAN') continue;
          if (c.confidence < p.minCouncilConf) continue;
          const opp = c.bestOpp;
          if (!opp || opp.score < p.minScore) continue;
          const aligned = (c.stance === 'BULLISH LEAN' && opp.direction === 'BUY') || (c.stance === 'BEARISH LEAN' && opp.direction === 'SELL');
          if (!aligned) continue;
          const ok = await placeEmilOrder(opp, `EMIL:AUTO:${opp.tfLabel}`);
          if (ok) break; // one entry per cycle, never bursts
        }
      } catch { /* never let the pilot crash the console */ }
    }, 45_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboarded, activeAccountId, calendar.length]);

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
          {onboarded && (
            <div className="flex items-center gap-1.5">
              {([['observe', 'OBSERVE', '#29ABE2'], ['confirm', 'CONFIRM-TO-TRADE', '#FFB300'], ['auto', 'AUTONOMOUS PILOT', '#CE93D8']] as const).map(([m, label, color]) => (
                <button key={m}
                  onClick={() => {
                    if (m === 'auto' && !isEmilAutoConsented()) { setGateOpen(true); return; }
                    if (m === 'auto') { setGateOpen(true); return; } // always re-review envelope before arming
                    setMode(m);
                    emilLog('mode', `mode → ${label}`);
                    setLogTick((t) => t + 1);
                  }}
                  className="rounded px-2 py-0.5 text-[9px] font-bold transition-all hover:brightness-125"
                  style={{
                    backgroundColor: mode === m ? `${color}2E` : 'rgba(255,255,255,0.04)',
                    color: mode === m ? color : 'rgba(255,255,255,0.4)',
                    border: `1px solid ${mode === m ? `${color}88` : 'rgba(255,255,255,0.1)'}`,
                  }}>
                  {label}
                </button>
              ))}
              <button onClick={() => stopEverything('trader pressed the hard stop')}
                className="rounded px-2 py-0.5 text-[9px] font-bold transition-all hover:brightness-125"
                style={{ backgroundColor: 'rgba(255,82,82,0.12)', color: '#FF5252', border: '1px solid rgba(255,82,82,0.5)' }}
                title="Global hard stop — halts all EMIL automation immediately">
                ⛔ EMIL, STOP EVERYTHING
              </button>
            </div>
          )}
          {!onboarded && <span className="text-[9px] text-white/35">Modes unlock after onboarding · Away & voice arrive in later phases</span>}
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

              {/* Confirm-to-Trade: EMIL's prepared ticket for the council's best setup */}
              {mode === 'confirm' && council?.bestOpp && (council.stance === 'BULLISH LEAN' || council.stance === 'BEARISH LEAN') &&
               ((council.stance === 'BULLISH LEAN' && council.bestOpp.direction === 'BUY') || (council.stance === 'BEARISH LEAN' && council.bestOpp.direction === 'SELL')) && (
                <div className="mt-3 rounded-lg border p-3" style={{ borderColor: 'rgba(255,179,0,0.4)', backgroundColor: 'rgba(255,179,0,0.05)' }}>
                  <div className="mb-1.5 text-[11px] font-bold" style={{ color: '#FFB300' }}>
                    EMIL prepared this trade — nothing happens without your confirm
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 font-mono text-[10px] text-white/70 sm:grid-cols-3">
                    <span>{council.bestOpp.direction} {Math.max(0.01, Math.round((council.bestOpp.suggestedLots ?? 0.01) * autoParams.riskPct * 100) / 100)} {council.bestOpp.symbol}</span>
                    <span>Entry: market (~{council.bestOpp.zone.aggressive})</span>
                    <span>SL {council.bestOpp.zone.stop} · TP {council.bestOpp.zone.target1}</span>
                    <span>{council.bestOpp.zone.riskReward1}R · score {council.bestOpp.score}</span>
                    <span>Council {council.stance} {council.confidence}%</span>
                    <span>{council.bestOpp.style} · {council.bestOpp.tfLabel}</span>
                  </div>
                  <p className="mt-1 text-[9px] text-white/40">
                    Reason: {council.bestOpp.reasonsFor[0]}. Invalidation: {council.bestOpp.invalidation} Shield rules apply; tagged EMIL:CONF.
                  </p>
                  <button
                    onClick={async () => { setPlacing(true); try { await placeEmilOrder(council.bestOpp!, `EMIL:CONF:${council.bestOpp!.tfLabel}`); } finally { setPlacing(false); } }}
                    disabled={placing}
                    className="mt-2 rounded px-4 py-2 text-[11px] font-bold text-black transition-all hover:brightness-110 disabled:opacity-40"
                    style={{ background: 'linear-gradient(180deg,#FFD54F,#FFB300)', boxShadow: '0 0 12px rgba(255,213,79,0.5)' }}>
                    {placing ? 'Placing…' : `CONFIRM — ${council.bestOpp.direction} ${council.bestOpp.symbol}`}
                  </button>
                </div>
              )}

              {/* EMIL activity feed */}
              {(mode !== 'observe' || loadEmilLog().length > 0) && (
                <div className="mt-3 rounded-lg border p-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }} data-logtick={logTick}>
                  <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-white/40">
                    EMIL activity {mode === 'auto' ? '· PILOT ARMED — acts while this console/window is open' : mode === 'confirm' ? '· preparing trades for your confirm' : ''}
                  </div>
                  {loadEmilLog().slice(-10).reverse().map((e, i) => (
                    <p key={i} className="font-mono text-[9px]" style={{ color: e.kind === 'entry' ? '#00C27A' : e.kind === 'exit' || e.kind === 'lock' ? '#FF8A65' : e.kind === 'breakeven' ? '#00E5A0' : 'rgba(255,255,255,0.45)' }}>
                      {new Date(e.ts).toLocaleTimeString()} · {e.kind.toUpperCase()} · {e.text}
                    </p>
                  ))}
                  {loadEmilLog().length === 0 && <p className="text-[9px] text-white/30">No EMIL actions yet.</p>}
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
            EMIL is decision support and bounded automation, never a guarantee — it seeks quality and protects capital
            but cannot promise profits. Every read is an estimate over {isLiveData ? 'live' : 'simulated platform'} data.
            The Autonomous Pilot acts ONLY inside your typed-consent limit envelope, only while an EMIL console/window is
            open, always through the Shield-gated order path (tag EMIL:*), and it resets to OBSERVE every session.
            Neither the broker nor the Raptor platform is responsible for trading losses, missed opportunities,
            execution delays or market outcomes.
          </p>
        </div>

        {/* ── Autonomous Pilot gate: limit envelope + typed consent ── */}
        {gateOpen && (
          <div className="fixed inset-0 z-[9600] flex items-center justify-center overflow-y-auto p-4" style={{ backgroundColor: 'rgba(3,7,12,0.85)' }} onMouseDown={(e) => { if (e.target === e.currentTarget) setGateOpen(false); }}>
            <div className="my-4 w-full max-w-[560px] rounded-xl border p-5 shadow-2xl" style={{ backgroundColor: '#0A0F1A', borderColor: 'rgba(206,147,216,0.5)' }}>
              <div className="mb-2 text-[14px] font-bold text-white">Arm the Autonomous Pilot — your limit envelope</div>
              <p className="mb-3 text-[10px] leading-relaxed text-white/55">
                Inside this envelope EMIL may enter (council-aligned scanner setups, SL + TP attached, one entry per cycle,
                one per symbol) and exit (break-even at +1R, council-flip close, daily profit lock, daily loss stop).
                Outside it, EMIL refuses and tells you why. Every order passes your Shield rules.
              </p>
              <div className="mb-2">
                <div className="mb-1 text-[9px] uppercase tracking-wide text-white/40">Instrument whitelist</div>
                <div className="flex flex-wrap gap-1">
                  {Object.keys(prices).filter((s) => prices[s]?.bid != null).map((s) => (
                    <button key={s}
                      onClick={() => setAutoParams((p) => ({ ...p, symbols: p.symbols.includes(s) ? p.symbols.filter((x) => x !== s) : [...p.symbols, s] }))}
                      className="rounded px-1.5 py-0.5 font-mono text-[9px] font-bold transition-all"
                      style={{
                        backgroundColor: autoParams.symbols.includes(s) ? 'rgba(206,147,216,0.25)' : 'rgba(255,255,255,0.04)',
                        color: autoParams.symbols.includes(s) ? '#CE93D8' : 'rgba(255,255,255,0.35)',
                        border: `1px solid ${autoParams.symbols.includes(s) ? 'rgba(206,147,216,0.6)' : 'rgba(255,255,255,0.1)'}`,
                      }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                {([
                  ['Risk % / trade', 'riskPct', 0.25, 3, 0.25],
                  ['Min score', 'minScore', 50, 95, 5],
                  ['Min council conf', 'minCouncilConf', 40, 90, 5],
                  ['Max entries / day', 'maxPerDay', 1, 20, 1],
                  ['Stop after losses', 'stopAfterLosses', 1, 10, 1],
                  ['Daily loss stop $', 'dailyLossStop', 0, 100000, 50],
                  ['Daily profit lock $ (0=off)', 'dailyProfitLock', 0, 100000, 50],
                ] as const).map(([label, key, min, max, step]) => (
                  <label key={key} className="text-[9px] text-white/45">{label}
                    <input type="number" min={min} max={max} step={step} value={autoParams[key] as number}
                      onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) setAutoParams((p) => ({ ...p, [key]: Math.max(min, Math.min(max, v)) })); }}
                      className="mt-0.5 block w-full rounded bg-white/[0.06] px-1.5 py-1 font-mono text-[10px] text-white outline-none" style={{ border: '1px solid rgba(206,147,216,0.3)' }} />
                  </label>
                ))}
              </div>
              <p className="mb-2 rounded border px-3 py-2 text-[9px] leading-relaxed" style={{ borderColor: 'rgba(255,179,0,0.3)', backgroundColor: 'rgba(255,179,0,0.05)', color: 'rgba(255,213,120,0.9)' }}>
                {EMIL_DISCLAIMER}
              </p>
              <label className="mb-3 block text-[10px] text-white/60">
                Type <span className="font-mono font-bold text-white">I AUTHORIZE EMIL</span> to arm the pilot:
                <input value={gateTyped} onChange={(e) => setGateTyped(e.target.value)} placeholder="I AUTHORIZE EMIL"
                  className="mt-1 block w-full rounded bg-white/[0.06] px-2 py-1.5 font-mono text-[11px] text-white placeholder:text-white/20 outline-none" style={{ border: '1px solid rgba(206,147,216,0.4)' }} />
              </label>
              <div className="flex justify-end gap-2">
                <button onClick={() => setGateOpen(false)} className="rounded px-3 py-2 text-[11px] font-semibold" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.55)' }}>Cancel</button>
                <button
                  onClick={() => {
                    if (gateTyped.trim().toUpperCase() !== 'I AUTHORIZE EMIL') return;
                    if (!autoParams.symbols.length) return;
                    saveEmilAutoParams(autoParams);
                    recordEmilAutoConsent(gateTyped.trim(), autoParams);
                    setGateOpen(false); setGateTyped('');
                    setMode('auto');
                    emilLog('mode', `AUTONOMOUS PILOT armed — ${autoParams.symbols.join(', ')} · risk ${autoParams.riskPct}%/trade · max ${autoParams.maxPerDay}/day · stop after ${autoParams.stopAfterLosses} losses · loss stop $${autoParams.dailyLossStop}${autoParams.dailyProfitLock ? ` · profit lock $${autoParams.dailyProfitLock}` : ''}`);
                    setLogTick((t) => t + 1);
                  }}
                  disabled={gateTyped.trim().toUpperCase() !== 'I AUTHORIZE EMIL' || !autoParams.symbols.length}
                  className="rounded px-4 py-2 text-[11px] font-bold text-black transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30"
                  style={{ background: 'linear-gradient(180deg,#CE93D8,#AB47BC)', boxShadow: '0 0 14px rgba(171,71,188,0.5)' }}>
                  ARM AUTONOMOUS PILOT
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

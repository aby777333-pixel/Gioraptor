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
  emilLog, loadEmilLog, recordEmilOutcome, emilShouldAvoid, loadEmilLearning,
  type EmilConsensus, type CouncilStance, type EmilAutoParams,
} from '@/lib/trading/emil-council';
import { findHedges } from '@/lib/trading/hedge-engine';
import { getLock, symbolCurrencies } from '@/lib/trading/protection';
import { emilLearnBonus } from '@/lib/trading/emil-council';
import { riskMood, uncertaintyScore, forecastScenarios, eventGuidance, marketMood, type RiskMood, type ForecastRead, type EventGuidance, type MoodRead } from '@/lib/trading/emil-macro';
import { parseMission, type MissionParse } from '@/lib/trading/emil-mission';
import { runScan, DEFAULT_FILTERS, type Opportunity } from '@/lib/trading/scanner-engine';
import { SCAN_TFS } from '@/lib/trading/scanner-engine';
import { sessionSnapshot, fmtMins, type SessionSnapshot } from '@/lib/trading/emil-sessions';

// ── Wake Me for Markets (browser-honest: notifications + beeps; SMS/calls/
// watch are future integrations and never claimed) ──
interface WakeSettings {
  enabled: boolean; minConviction: number; capitalRisk: boolean;
  sessionLON: boolean; sessionNYC: boolean;
  quietEnabled: boolean; quietFrom: string; quietTo: string;
}
const WAKE_KEY = 'raptor_emil_wake_v1';
const DEFAULT_WAKE: WakeSettings = { enabled: false, minConviction: 85, capitalRisk: true, sessionLON: false, sessionNYC: false, quietEnabled: false, quietFrom: '23:00', quietTo: '07:00' };
function loadWake(): WakeSettings { try { return { ...DEFAULT_WAKE, ...(JSON.parse(localStorage.getItem(WAKE_KEY) || '{}')) }; } catch { return { ...DEFAULT_WAKE }; } }

function inQuietHours(w: WakeSettings): boolean {
  if (!w.quietEnabled) return false;
  const now = new Date().toTimeString().slice(0, 5);
  return w.quietFrom <= w.quietTo ? (now >= w.quietFrom && now < w.quietTo) : (now >= w.quietFrom || now < w.quietTo);
}

function beep(times: number, freq: number): void {
  try {
    const Ctor = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!Ctor) return;
    const ctx = new Ctor();
    for (let i = 0; i < times; i++) {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq; gain.gain.value = 0.08;
      osc.start(ctx.currentTime + i * 0.5); osc.stop(ctx.currentTime + i * 0.5 + 0.28);
    }
    setTimeout(() => ctx.close(), times * 600 + 500);
  } catch { /* audio unavailable */ }
}
import { classifyMarketState } from '@/lib/nexus/market-state';
import { highImpactWithin, fmtEta } from '@/lib/trading/news-guard';

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
  const [emilStatus, setEmilStatus] = useState('Watching');
  const [riskState, setRiskState] = useState('Normal');
  const [macro, setMacro] = useState<{ mood: RiskMood; forecast: ForecastRead | null; events: EventGuidance[]; symMood: MoodRead | null } | null>(null);
  const [debate, setDebate] = useState(false);
  const [missionText, setMissionText] = useState('');
  const [missionParse, setMissionParse] = useState<MissionParse | null>(null);
  const [radar, setRadar] = useState<Opportunity[]>([]);
  const [modeBoard, setModeBoard] = useState<{ mode: string; conf: number }[]>([]);
  const [wake, setWake] = useState<WakeSettings>(loadWake);
  const [sessions, setSessions] = useState<SessionSnapshot | null>(null);
  const [sleepNoNew, setSleepNoNew] = useState(false);
  const sleepNoNewRef = useRef(false);
  sleepNoNewRef.current = sleepNoNew;
  const wakeThrottleRef = useRef<Map<string, number>>(new Map());
  const prevOpenRef = useRef<Record<string, boolean>>({});
  const [currentMode, setCurrentMode] = useState('No-Trade');
  const lastModeRef = useRef<string>('No-Trade');
  const prevModeRef = useRef<string>('—');
  const [placing, setPlacing] = useState(false);
  const [logTick, setLogTick] = useState(0);
  const builderRef = useRef(ohlcvBuilder);
  builderRef.current = ohlcvBuilder;
  const modeRef = useRef<EmilMode>('observe');
  modeRef.current = mode;
  const riskRef = useRef<Map<string, number>>(new Map());   // original SL risk per position (for the R-ladder)
  const hedgedRef = useRef<Set<string>>(new Set());         // positions EMIL already hedged
  const lastEmilClosedRef = useRef<number | null>(null);    // learning: newest EMIL close seen

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
      setMacro({
        mood: riskMood(builder),
        forecast: forecastScenarios(builder, activeSymbol, prices[activeSymbol], calendar),
        events: eventGuidance(symbolCurrencies(activeSymbol), calendar),
        symMood: marketMood(builder, activeSymbol, prices[activeSymbol], calendar),
      });
      // Opportunity radar: top setups across the whole market right now.
      const found = runScan({
        builder, universe: Object.keys(prices).filter((s) => prices[s]?.bid != null),
        ticks: prices, calendar, openPositions: positions,
        balance: Number(accountSummary?.balance ?? 0), isLiveData,
        filters: { ...DEFAULT_FILTERS, minScore: 60 },
      });
      setRadar(found.slice(0, 6));
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

  // Wake alert dispatcher: quiet hours suppress everything except critical.
  const wakeAlert = useCallback((level: 'info' | 'opportunity' | 'critical', key: string, text: string, throttleMin = 30) => {
    const w = loadWake();
    if (!w.enabled) return;
    if (level !== 'critical' && inQuietHours(w)) { emilLog('mode', `wake suppressed (quiet hours): ${text}`); return; }
    const last = wakeThrottleRef.current.get(key) ?? 0;
    if (Date.now() - last < throttleMin * 60_000) return;
    wakeThrottleRef.current.set(key, Date.now());
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(level === 'critical' ? '🚨 EMIL — CAPITAL AT RISK' : level === 'opportunity' ? '⏰ EMIL — opportunity' : '🌍 EMIL — session', { body: text });
      }
    } catch { /* notifications unavailable */ }
    beep(level === 'critical' ? 6 : 3, level === 'critical' ? 880 : 620);
    emilLog('mode', `WAKE (${level.toUpperCase()}): ${text}`);
    setLogTick((t) => t + 1);
  }, []);

  // Session clock (30s) + session-open wakes.
  useEffect(() => {
    const tick = () => {
      const snap = sessionSnapshot();
      setSessions(snap);
      const w = loadWake();
      for (const s of snap.sessions) {
        const was = prevOpenRef.current[s.id];
        if (was === false && s.open) {
          if ((s.id === 'LON' && w.sessionLON) || (s.id === 'NYC' && w.sessionNYC)) {
            wakeAlert('info', `session-${s.id}`, `${s.label} session just opened — liquidity transition in progress.`, 120);
          }
        }
        prevOpenRef.current[s.id] = s.open;
      }
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [wakeAlert]);

  const stopEverything = useCallback((reason: string) => {
    setMode('observe');
    emilLog('mode', `STOP EVERYTHING — ${reason}. Automation halted; re-arming requires explicit mode selection.`);
    setLogTick((t) => t + 1);
  }, []);

  const placeEmilOrder = useCallback(async (opp: NonNullable<EmilConsensus['bestOpp']>, tag: string) => {
    if (!activeAccountId) { emilLog('blocked', 'no trading account selected'); setLogTick((t) => t + 1); return false; }
    const t = useTradingStore.getState().prices[opp.symbol];
    if (!t?.bid || !t?.ask) { emilLog('blocked', `${opp.symbol}: no live quote — refusing stale data`); setLogTick((x) => x + 1); return false; }
    const p = loadEmilAutoParams();
    const base = opp.suggestedLots ?? p.baseLot; // scanner sizes at 1% risk; base lot is the floor
    // Small & Steady: minimum size only — discipline over throughput.
    const lots = p.smallSteady ? p.baseLot : Math.max(p.baseLot, Math.round(base * p.riskPct * 100) / 100);
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

        // ── Learning never stops: absorb every newly-closed EMIL trade ──
        const emilClosed = emilRows.filter((r) => r.closed_at).sort((a, b) => new Date(b.closed_at!).getTime() - new Date(a.closed_at!).getTime());
        const newestClosed = emilClosed.length ? new Date(emilClosed[0].closed_at!).getTime() : null;
        if (lastEmilClosedRef.current != null && newestClosed != null && newestClosed > lastEmilClosedRef.current) {
          for (const r of emilClosed.filter((x) => new Date(x.closed_at!).getTime() > lastEmilClosedRef.current!)) {
            const parts = String(r.comment ?? '').split(':'); // EMIL:AUTO:H1 · EMIL:CONF:M15 · EMIL:HEDGE:EURUSD
            if (parts[1] === 'HEDGE') continue;
            const tf = parts[2] ?? '?';
            const sym = (r as unknown as { symbol?: string }).symbol ?? '?';
            const win = Number(r.realized_pnl ?? 0) > 0;
            const learned = recordEmilOutcome(sym, tf, win);
            // Self-evaluation (§14): every close gets a short honest review.
            const closeState = classifyMarketState(builder.getAllBars(sym, '60'));
            emilLog('mode', `review: ${sym} ${tf} ${win ? 'WIN' : 'LOSS'} ${Number(r.realized_pnl ?? 0) >= 0 ? '+' : ''}$${Number(r.realized_pnl ?? 0).toFixed(2)} · regime at close: ${closeState?.state ?? 'unknown'} · bucket now ${learned.bucket.wins}/${learned.bucket.n}${win ? '' : ' · lesson: was the entry chased, or did the regime flip? probabilities updated'}`);
            if (learned.avoided) {
              emilLog('lock', `learned: avoiding ${sym} ${tf} for now (${learned.bucket.wins}/${learned.bucket.n} wins) — losing buckets get benched, not repeated.`);
            }
            setLogTick((x) => x + 1);
          }
        }
        if (newestClosed != null) lastEmilClosedRef.current = newestClosed;

        const open = (await orderService.getOpenPositions(activeAccountId)) as Array<{ id: string; symbol: string; direction: string; size: number; open_price: number; current_price: number | null; sl: number | null; tp: number | null; comment?: string | null }>;
        const emilOpenPos = open.filter((x) => String(x.comment ?? '').startsWith('EMIL'));
        const ticks = useTradingStore.getState().prices;
        const universeAll = Object.keys(ticks).filter((s) => ticks[s]?.bid != null);

        // ── Exit management (runs in confirm AND auto modes) ──
        for (const pos of emilOpenPos) {
          const dir = pos.direction === 'BUY' ? 1 : -1;
          const tk = ticks[pos.symbol];
          const cur = dir > 0 ? (tk?.bid ?? Number(pos.current_price)) : (tk?.ask ?? Number(pos.current_price));
          if (cur == null) continue;
          const openPx = Number(pos.open_price);

          // R-ladder stop management: capture the ORIGINAL risk on first
          // sighting, then +1R → break-even, +2R → lock +1R, +3R → +2R…
          if (pos.sl != null && pos.sl !== 0) {
            if (!riskRef.current.has(pos.id)) {
              const r0 = (openPx - Number(pos.sl)) * dir;
              if (r0 > 0) riskRef.current.set(pos.id, r0); // only pre-BE sightings define R
            }
            const risk0 = riskRef.current.get(pos.id);
            if (risk0 && risk0 > 0) {
              const profitR = (Number(cur) - openPx) * dir / risk0;
              const currentLockR = (Number(pos.sl) - openPx) * dir / risk0; // negative before BE
              const targetLockR = Math.floor(profitR) - 1;                  // +1R→0, +2R→1, +3R→2…
              if (targetLockR >= 0 && targetLockR > currentLockR + 1e-9) {
                const newSl = Number((openPx + dir * targetLockR * risk0).toFixed(openPx < 20 ? 5 : 2));
                try {
                  await orderService.modifyPosition(pos.id, newSl, pos.tp ?? undefined);
                  emilLog('breakeven', targetLockR === 0
                    ? `${pos.symbol}: +1R reached — stop to break-even (${newSl}). The trade can no longer lose.`
                    : `${pos.symbol}: +${Math.floor(profitR)}R reached — stop trailed to lock +${targetLockR}R (${newSl}).`);
                  setLogTick((x) => x + 1);
                } catch { /* may have closed */ }
              }
            }
          }

          // Council read for this symbol (cheap: no hedge/exposure agents).
          const c = buildCouncil({ builder, symbol: pos.symbol, ticks, calendar, positions: [], history: [], specs: null, accountId: activeAccountId, balance: 0, isLiveData });
          const against = (pos.direction === 'BUY' && c.stance === 'BEARISH LEAN') || (pos.direction === 'SELL' && c.stance === 'BULLISH LEAN');
          if (against && c.confidence >= p.minCouncilConf) {
            try {
              await orderService.closePosition(pos.id, Number(cur));
              emilLog('exit', `${pos.symbol}: council flipped ${c.stance} (${c.confidence}%) against the ${pos.direction} — position closed at ${cur}.`);
              setLogTick((x) => x + 1);
            } catch { /* may have closed */ }
            continue;
          }

          // Auto-hedge: position adverse ≥0.5R while the council is UNCERTAIN
          // (NO EDGE) — not confident enough to close, so reduce the bleed with
          // a viable hedge leg instead. Once per position; efficiency-gated by
          // the hedge engine's own viability rules.
          if (p.autoHedge && specs && modeRef.current === 'auto' && !hedgedRef.current.has(pos.id) && !String(pos.comment ?? '').startsWith('EMIL:HEDGE')) {
            const risk0 = riskRef.current.get(pos.id);
            const adverseR = risk0 && risk0 > 0 ? (openPx - Number(cur)) * dir / risk0 : 0;
            if (adverseR >= 0.5 && c.stance === 'NO EDGE') {
              const { viable } = findHedges(builder, { primary: pos.symbol, direction: pos.direction as 'BUY' | 'SELL', lots: Number(pos.size), hedgePct: 0.5 }, universeAll, specs, ticks);
              const h = viable[0];
              if (h) {
                const ht = ticks[h.symbol];
                const hFill = h.hedgeDirection === 'BUY' ? ht?.ask : ht?.bid;
                if (hFill != null) {
                  try {
                    await orderService.placeMarketOrder({
                      accountId: activeAccountId, symbol: h.symbol, direction: h.hedgeDirection,
                      size: Math.max(p.baseLot, h.suggestedLots), fillPrice: Number(hFill), comment: `EMIL:HEDGE:${pos.symbol}`,
                    });
                    hedgedRef.current.add(pos.id);
                    emilLog('entry', `hedge: ${pos.symbol} is ${adverseR.toFixed(1)}R adverse with an uncertain council — ${h.hedgeDirection} ${Math.max(p.baseLot, h.suggestedLots)} ${h.symbol} placed (~${h.reductionPct.toFixed(0)}% est. risk reduction, corr ${h.corr.avg?.toFixed(2)}).`);
                    setLogTick((x) => x + 1);
                  } catch (err) {
                    emilLog('blocked', `hedge for ${pos.symbol} rejected: ${err instanceof Error ? err.message.slice(0, 120) : 'error'}`);
                    setLogTick((x) => x + 1);
                  }
                }
              }
            }
          }
        }

        // ── Envelope checks + profit lock / loss stop ──
        // Capital-at-risk wake: approaching the daily loss stop or thin margin.
        const marginLvl = Number(useTradingStore.getState().accountSummary?.margin_level_pct ?? 0);
        if ((p.dailyLossStop > 0 && realized <= -0.8 * Math.abs(p.dailyLossStop)) || (marginLvl > 0 && marginLvl < 150)) {
          wakeAlert('critical', 'capital-risk', `Capital at risk: EMIL day P&L ${realized >= 0 ? '+' : ''}$${realized.toFixed(0)}${p.dailyLossStop > 0 ? ` (loss stop $${p.dailyLossStop})` : ''}${marginLvl > 0 && marginLvl < 150 ? ` · margin level ${marginLvl.toFixed(0)}%` : ''}. Review the account.`, 15);
        }

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
        // ── Adaptive risk state — EMIL throttles himself before rules force him ──
        const lock = getLock(activeAccountId);
        const rs = lock ? 'Capital Lock'
          : consec >= Math.max(1, p.stopAfterLosses - 1) ? 'Defensive'
          : p.dailyProfitLock > 0 && realized >= 0.7 * p.dailyProfitLock ? 'Profit Protection'
          : realized < 0 ? 'Cautious' : 'Normal';
        setRiskState(rs);

        if (m !== 'auto') { setEmilStatus('Managing'); return; }
        if (consec >= p.stopAfterLosses) { emilLog('lock', `${consec} EMIL losses in a row — pilot paused per your rule`); stopEverything('consecutive losses'); return; }
        const entriesToday = loadEmilLog().filter((e) => e.kind === 'entry' && e.ts >= midnight.getTime()).length;
        if (entriesToday >= p.maxPerDay) { setEmilStatus('Managing'); return; } // manage-only for the rest of the day
        if (rs === 'Defensive' || rs === 'Capital Lock') { setEmilStatus('Protecting'); return; } // no new risk while defensive

        // Quality bar rises when cautious or in Small & Steady mode.
        const minScoreEff = p.minScore + (rs === 'Cautious' ? 10 : 0) + (p.smallSteady ? 10 : 0);

        // Profit-Only: capital is untouchable — new risk comes from the
        // realized profit cushion only, and only a slice of it per trade.
        const balanceNow = Number(useTradingStore.getState().accountSummary?.balance ?? 0);
        const cushion = p.profitOnly ? balanceNow - p.protectedCapital : Infinity;
        if (p.profitOnly && cushion <= 0) {
          setEmilStatus('Protecting');
          return; // capital protected; EMIL waits until profits exist to trade from
        }
        const maxRiskAllowed = p.profitOnly ? cushion * (p.tradableProfitPct / 100) : Infinity;

        // ── Seek the BEST entry this cycle — EMIL selects the market ──
        setEmilStatus('Scanning');
        const scanUniverse = p.selectAll ? universeAll : p.symbols;
        const candidates: { c: EmilConsensus; opp: NonNullable<EmilConsensus['bestOpp']>; adj: number }[] = [];
        for (const symbol of scanUniverse) {
          if (emilOpenPos.some((x) => x.symbol === symbol)) continue; // one EMIL trade per symbol
          const c = buildCouncil({ builder, symbol, ticks, calendar, positions: [], history: [], specs: null, accountId: activeAccountId, balance: balanceNow, isLiveData });
          if (c.stance !== 'BULLISH LEAN' && c.stance !== 'BEARISH LEAN') continue;
          if (c.confidence < p.minCouncilConf) continue;
          const opp = c.bestOpp;
          if (!opp || opp.score < minScoreEff) continue;
          if (emilShouldAvoid(symbol, opp.tfLabel)) continue; // learned avoidance — losing buckets are benched
          const aligned = (c.stance === 'BULLISH LEAN' && opp.direction === 'BUY') || (c.stance === 'BEARISH LEAN' && opp.direction === 'SELL');
          if (!aligned) continue;
          if (p.profitOnly && (opp.maxLossEstimate == null || opp.maxLossEstimate > maxRiskAllowed)) continue; // slice of profits only
          // Trade Mode controller: only allowed modes may trade (trader/shared control).
          if (p.modeControl !== 'emil' && !p.enabledModes.includes(opp.style)) continue;
          // News buffer: no entries within 30 min of a red-flag event on the symbol.
          if (highImpactWithin(symbolCurrencies(symbol), calendar, 30).length) continue;
          // Uncertainty gate: EMIL refuses to enter markets he cannot read.
          const unc = uncertaintyScore(builder, symbol, ticks[symbol], calendar);
          if (unc.level === 'HIGH') continue;
          candidates.push({ c, opp, adj: opp.score + emilLearnBonus(symbol, opp.tfLabel) - (unc.level === 'ELEVATED' ? 8 : 0) });
        }
        // ── Mode Confidence board: every allowed mode competes, and No-Trade
        // is a first-class contender that wins when nothing qualifies. ──
        const byStyle = new Map<string, number>();
        for (const cand of candidates) {
          byStyle.set(cand.opp.style, Math.max(byStyle.get(cand.opp.style) ?? 0, cand.adj));
        }
        const board = SCAN_TFS
          .filter((t) => p.modeControl === 'emil' || p.enabledModes.includes(t.style))
          .map((t) => ({ mode: `${t.style} (${t.label})`, conf: Math.min(100, byStyle.get(t.style) ?? 0) }));
        const topAdj = candidates.length ? Math.max(...candidates.map((x) => x.adj)) : 0;
        board.push({ mode: 'No-Trade', conf: candidates.length ? Math.max(20, 95 - topAdj) : 95 });
        board.sort((a, b) => b.conf - a.conf);
        setModeBoard(board);

        // Opportunity wake: an exceptional setup clears the trader's wake bar.
        if (candidates.length) {
          const top = candidates.reduce((a, b) => (b.adj > a.adj ? b : a));
          const conviction = Math.round(0.6 * top.opp.score + 0.4 * top.c.confidence);
          if (conviction >= loadWake().minConviction) {
            wakeAlert('opportunity', `opp-${top.opp.symbol}`, `${top.opp.symbol} ${top.opp.direction} — conviction ${conviction} (${top.opp.style} ${top.opp.tfLabel}, score ${top.opp.score}, council ${top.c.confidence}%).`, 30);
          }
        }

        // Sleep Mode: manage existing only — no new entries while it holds.
        if (sleepNoNewRef.current) { setEmilStatus('Managing'); return; }

        if (candidates.length) {
          setEmilStatus('Trading');
          candidates.sort((a, b) => b.adj - a.adj);
          // Conservative tie-break: among near-equal scores (±3), prefer the
          // HIGHER timeframe — never the more aggressive mode.
          const tfIdx = (s: string) => SCAN_TFS.findIndex((t) => t.label === s);
          let bestPick = candidates[0];
          for (const cand of candidates.slice(1)) {
            if (bestPick.adj - cand.adj <= 3 && tfIdx(cand.opp.tfLabel) > tfIdx(bestPick.opp.tfLabel)) bestPick = cand;
          }
          const chosenMode = `${bestPick.opp.style} (${bestPick.opp.tfLabel})`;
          if (lastModeRef.current !== chosenMode) {
            emilLog('mode', `mode switch: ${lastModeRef.current} → ${chosenMode} — reason: highest-confidence qualified setup (${bestPick.opp.symbol}, score ${bestPick.opp.score}, council ${bestPick.c.confidence}%); conservative tie-break favours higher timeframes; never switched to chase losses.`);
            prevModeRef.current = lastModeRef.current;
            lastModeRef.current = chosenMode;
            setLogTick((x) => x + 1);
          }
          setCurrentMode(chosenMode);
          await placeEmilOrder(bestPick.opp, `EMIL:AUTO:${bestPick.opp.tfLabel}`);
        } else {
          if (lastModeRef.current !== 'No-Trade') {
            emilLog('mode', `mode switch: ${lastModeRef.current} → No-Trade — no setup clears the quality/uncertainty/news bars. EMIL is protecting capital; staying flat is a successful decision.`);
            prevModeRef.current = lastModeRef.current;
            lastModeRef.current = 'No-Trade';
            setLogTick((x) => x + 1);
          }
          setCurrentMode('No-Trade');
        }
        setEmilStatus('Watching');
      } catch { /* never let the pilot crash the console */ }
    }, 45_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboarded, activeAccountId, calendar.length, specs]);

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
            <span className="rounded px-2 py-0.5 font-mono text-[9px]" style={{
              backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
              color: riskState === 'Normal' ? '#00C27A' : riskState === 'Cautious' || riskState === 'Profit Protection' ? '#FFB300' : '#FF5252',
            }}>
              EMIL: {mode === 'auto' ? emilStatus : mode === 'confirm' ? 'Preparing' : 'Watching'} · {Object.keys(prices).filter((s) => prices[s]?.bid != null).length} instruments · Risk {riskState}
            </span>
          )}
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
                {/* Confidence meter (grey = "I don't know") + market mood */}
                {council && (() => {
                  const noEdge = council.stance === 'NO EDGE' || council.stance === 'STAND ASIDE';
                  const col = noEdge ? '#8B93A7' : council.confidence >= 75 ? '#00C27A' : council.confidence >= 60 ? '#D4E157' : council.confidence >= 45 ? '#FFB300' : '#FF5252';
                  return (
                    <span className="flex items-center gap-1.5 rounded px-2 py-1 text-[10px] font-bold" style={{ border: `1px solid ${col}55`, color: col }}
                      title={noEdge ? 'EMIL honestly does not know — grey means no directional confidence' : `Directional confidence ${council.confidence}%`}>
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: col, boxShadow: `0 0 6px ${col}` }} />
                      {noEdge ? "I don't know" : `${council.confidence}%`}
                    </span>
                  );
                })()}
                {macro?.symMood && (
                  <span className="rounded px-2 py-1 text-[10px] font-bold" style={{ border: `1px solid ${macro.symMood.color}55`, color: macro.symMood.color }}
                    title={`Market mood: ${macro.symMood.note}`}>
                    {macro.symMood.label}
                  </span>
                )}
                <div className="ml-auto flex gap-2">
                  <button onClick={() => setDebate((d) => !d)} className="rounded px-2.5 py-1 text-[10px] font-bold transition-all hover:brightness-125"
                    style={{ backgroundColor: debate ? 'rgba(41,171,226,0.18)' : 'rgba(41,171,226,0.08)', color: '#29ABE2', border: '1px solid rgba(41,171,226,0.35)' }}>
                    {debate ? 'Grid view' : '🗣 Debate room'}
                  </button>
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

              {/* 🎯 Mission Control */}
              <div className="mt-3 rounded-lg border p-3" style={{ borderColor: 'rgba(255,213,79,0.25)' }}>
                <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wide" style={{ color: '#FFD54F' }}>🎯 Mission Control — tell EMIL the mission in plain language</div>
                <div className="flex gap-2">
                  <input value={missionText} onChange={(e) => setMissionText(e.target.value)}
                    placeholder='e.g. "Only trade gold and EURUSD. Risk no more than 0.5 percent. Stop after two losses. Lock the day at a $300 target."'
                    className="min-w-0 flex-1 rounded bg-white/[0.06] px-2 py-1.5 text-[11px] text-white placeholder:text-white/25 outline-none" style={{ border: '1px solid rgba(255,213,79,0.3)' }} />
                  <button onClick={() => setMissionParse(parseMission(missionText, Object.keys(prices).filter((s) => prices[s]?.bid != null)))}
                    disabled={!missionText.trim()}
                    className="shrink-0 rounded px-3 py-1.5 text-[10px] font-bold text-black transition-all hover:brightness-110 disabled:opacity-30"
                    style={{ background: 'linear-gradient(180deg,#FFD54F,#FFB300)' }}>
                    Parse mission
                  </button>
                </div>
                {missionParse && (
                  <div className="mt-2 text-[10px]">
                    {missionParse.rules.map((r, i) => <p key={i} style={{ color: '#00C27A' }}>✓ <b>{r.label}:</b> <span className="text-white/60">{r.detail}</span></p>)}
                    {missionParse.unknown.map((u, i) => <p key={i} style={{ color: '#FFB300' }}>⚠ {u}</p>)}
                    {missionParse.rules.length > 0 && (
                      <button onClick={() => {
                        setAutoParams((p) => { const next = { ...p, ...missionParse.patch }; saveEmilAutoParams(next); return next; });
                        if (missionParse.wakeMinConviction) {
                          const w = { ...loadWake(), minConviction: missionParse.wakeMinConviction };
                          setWake(w); try { localStorage.setItem(WAKE_KEY, JSON.stringify(w)); } catch { /* ok */ }
                        }
                        emilLog('mode', `MISSION accepted: ${missionParse.rules.map((r) => `${r.label} → ${r.detail}`).join(' · ')}. Read-back confirmed; arm the pilot to run it.`);
                        setMissionParse(null); setMissionText('');
                        setLogTick((t) => t + 1);
                      }}
                        className="mt-1.5 rounded px-3 py-1.5 text-[10px] font-bold text-black transition-all hover:brightness-110"
                        style={{ background: 'linear-gradient(180deg,#00E5A0,#00B87F)' }}>
                        Apply mission to the envelope
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Agent Council: debate room or grid */}
              {council && debate && (
                <div className="mt-3 rounded-lg border p-3" style={{ borderColor: 'rgba(41,171,226,0.3)' }}>
                  <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wide" style={{ color: '#29ABE2' }}>🗣 The council debates {council.symbol}</div>
                  {council.votes.map((v) => (
                    <p key={v.agent} className="mb-1 text-[10px] leading-relaxed">
                      <span className="font-bold text-white/75">{v.icon} {v.agent}:</span>{' '}
                      <span style={{ color: stanceColor(v.stance) }}>
                        “{v.stance === 'bull' ? 'I lean long' : v.stance === 'bear' ? 'I lean short' : 'I stay neutral'} ({v.confidence}%) — {v.note}.”
                      </span>
                    </p>
                  ))}
                  <p className="mt-2 border-t pt-1.5 text-[11px] font-bold" style={{ borderColor: 'rgba(255,255,255,0.08)', color: council.stance === 'BULLISH LEAN' ? '#00C27A' : council.stance === 'BEARISH LEAN' ? '#FF5252' : '#FFB300' }}>
                    🧠 EMIL summarises: {council.stance === 'NO EDGE' ? 'the council disagrees — Decision: No Trade.' : council.stance === 'STAND ASIDE' ? 'protection outranks every opinion — Decision: Stand Aside.' : `${council.bulls} for, ${council.bears} against — Decision: ${council.stance} at ${council.confidence}% confidence.`}
                  </p>
                </div>
              )}
              {council && !debate && (
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

              {/* 📡 Opportunity radar — top live setups across the whole market */}
              {radar.length > 0 && (
                <div className="mt-3 rounded-lg border p-3" style={{ borderColor: 'rgba(41,171,226,0.25)' }}>
                  <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-white/40">📡 Opportunity radar — strongest live setups (click to focus)</div>
                  <div className="flex flex-wrap gap-1.5">
                    {radar.map((o) => {
                      const col = o.score >= 80 ? '#00C27A' : o.score >= 70 ? '#D4E157' : '#FFB300';
                      const minsLeft = Math.max(0, Math.round((o.expiresAt - Date.now()) / 60_000));
                      return (
                        <button key={o.id} onClick={() => setActiveSymbol(o.symbol)}
                          className="flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[9px] transition-all hover:brightness-125"
                          style={{ borderColor: `${col}55`, backgroundColor: `${col}12` }}
                          title={`${o.label} · ${o.style} ${o.tfLabel} · ${o.zone.riskReward1}R · stale in ~${minsLeft}m`}>
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: o.direction === 'BUY' ? '#00C27A' : '#FF5252', boxShadow: `0 0 5px ${o.direction === 'BUY' ? '#00C27A' : '#FF5252'}` }} />
                          <span className="text-white/80">{o.symbol}</span>
                          <span style={{ color: col }}>{o.score}</span>
                          <span className="text-white/35">{o.tfLabel} · {minsLeft}m</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Trade Mode board (autonomous pilot) ── */}
              {mode === 'auto' && modeBoard.length === 0 && (
                <div className="mt-3 rounded-lg border p-3 text-[10px] text-white/45" style={{ borderColor: 'rgba(206,147,216,0.25)' }}>
                  🧭 Trade Mode board — pilot armed, first cycle pending{!activeAccountId ? ' · select a trading account for EMIL to act' : ''}. Modes compete each cycle; No-Trade wins when nothing qualifies.
                </div>
              )}
              {mode === 'auto' && modeBoard.length > 0 && (
                <div className="mt-3 rounded-lg border p-3" style={{ borderColor: 'rgba(206,147,216,0.3)' }}>
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: '#CE93D8' }}>Trade Mode board</span>
                    <span className="rounded px-2 py-0.5 font-mono text-[10px] font-bold" style={{ backgroundColor: 'rgba(206,147,216,0.15)', color: '#CE93D8', border: '1px solid rgba(206,147,216,0.5)' }}>
                      Current: {currentMode}
                    </span>
                    <span className="text-[9px] text-white/35">previous: {prevModeRef.current}</span>
                  </div>
                  {modeBoard.map((m) => (
                    <div key={m.mode} className="mb-0.5 flex items-center gap-2 text-[10px]">
                      <span className="w-40 shrink-0" style={{ color: m.mode === 'No-Trade' ? '#FFB300' : 'rgba(255,255,255,0.6)' }}>{m.mode}</span>
                      <div className="h-2 flex-1 rounded bg-white/[0.05]">
                        <div className="h-full rounded" style={{ width: `${m.conf}%`, backgroundColor: m.mode === currentMode ? 'rgba(206,147,216,0.8)' : m.mode === 'No-Trade' ? 'rgba(255,179,0,0.6)' : 'rgba(255,255,255,0.2)' }} />
                      </div>
                      <span className="w-9 shrink-0 text-right font-mono text-white/55">{Math.round(m.conf)}</span>
                    </div>
                  ))}
                  <p className="mt-1 text-[8px] text-white/30">
                    Modes compete on live setup quality; No-Trade wins whenever risk outweighs opportunity. Ties resolve to the
                    more conservative (higher) timeframe. EMIL never switches modes to chase a loss.
                  </p>
                </div>
              )}

              {/* ── Global Session Map + Wake & Sleep ── */}
              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                <div className="rounded-lg border p-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                  <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-white/40">
                    🌍 Global session map · local {sessions?.local ?? '—'} · {sessions?.utc ?? '—'}
                  </div>
                  {sessions?.sessions.map((s) => (
                    <div key={s.id} className="mb-1 flex items-center gap-2 text-[10px]">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.open ? '#00C27A' : 'rgba(255,255,255,0.2)', boxShadow: s.open ? '0 0 5px #00C27A' : 'none' }} />
                      <span className="w-20 font-bold text-white/70">{s.label}</span>
                      <span className="font-mono text-white/40">{s.localTime} local</span>
                      <span className="ml-auto font-mono" style={{ color: s.open ? '#00C27A' : 'rgba(255,255,255,0.4)' }}>
                        {s.open ? 'OPEN' : 'closed'} · {s.changeType} in {fmtMins(s.minsToChange)}
                      </span>
                    </div>
                  ))}
                  {sessions && sessions.overlaps.length > 0 && sessions.overlaps.map((o, i) => (
                    <p key={i} className="mt-0.5 text-[9px]" style={{ color: '#FFB300' }}>⚡ {o}</p>
                  ))}
                  <p className="mt-1 text-[8px] text-white/25">{sessions?.note}</p>
                </div>

                <div className="rounded-lg border p-3" style={{ borderColor: 'rgba(255,213,79,0.25)' }}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: '#FFD54F' }}>⏰ Wake me for markets</span>
                    <button onClick={() => {
                      try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch { /* ok */ }
                      beep(3, 620);
                      emilLog('mode', 'alarm test fired'); setLogTick((t) => t + 1);
                    }} className="rounded px-2 py-0.5 text-[8px] font-bold text-white/50 transition-colors hover:text-white" style={{ border: '1px solid rgba(255,255,255,0.15)' }}>
                      Test alarm
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[9px] text-white/55">
                    <label className="flex items-center gap-1.5"><input type="checkbox" checked={wake.enabled} onChange={(e) => { const w = { ...wake, enabled: e.target.checked }; setWake(w); try { localStorage.setItem(WAKE_KEY, JSON.stringify(w)); if (w.enabled && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch { /* ok */ } }} className="accent-[#FFD54F]" /> Wake alerts</label>
                    <label className="flex items-center gap-1.5">Min conviction <input type="number" min={50} max={100} value={wake.minConviction} onChange={(e) => { const w = { ...wake, minConviction: Math.max(50, Math.min(100, Number(e.target.value) || 85)) }; setWake(w); try { localStorage.setItem(WAKE_KEY, JSON.stringify(w)); } catch { /* ok */ } }} className="w-[46px] rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[9px] text-white outline-none" style={{ border: '1px solid rgba(255,213,79,0.3)' }} /></label>
                    <label className="flex items-center gap-1.5"><input type="checkbox" checked={wake.capitalRisk} onChange={(e) => { const w = { ...wake, capitalRisk: e.target.checked }; setWake(w); try { localStorage.setItem(WAKE_KEY, JSON.stringify(w)); } catch { /* ok */ } }} className="accent-[#FF5252]" /> Capital-at-risk (critical, overrides quiet hours)</label>
                    <label className="flex items-center gap-1.5"><input type="checkbox" checked={wake.sessionLON} onChange={(e) => { const w = { ...wake, sessionLON: e.target.checked }; setWake(w); try { localStorage.setItem(WAKE_KEY, JSON.stringify(w)); } catch { /* ok */ } }} className="accent-[#FFD54F]" /> London open</label>
                    <label className="flex items-center gap-1.5"><input type="checkbox" checked={wake.sessionNYC} onChange={(e) => { const w = { ...wake, sessionNYC: e.target.checked }; setWake(w); try { localStorage.setItem(WAKE_KEY, JSON.stringify(w)); } catch { /* ok */ } }} className="accent-[#FFD54F]" /> New York open</label>
                    <label className="flex items-center gap-1.5"><input type="checkbox" checked={wake.quietEnabled} onChange={(e) => { const w = { ...wake, quietEnabled: e.target.checked }; setWake(w); try { localStorage.setItem(WAKE_KEY, JSON.stringify(w)); } catch { /* ok */ } }} className="accent-[#FFD54F]" /> Quiet hours
                      <input type="time" value={wake.quietFrom} onChange={(e) => { const w = { ...wake, quietFrom: e.target.value }; setWake(w); try { localStorage.setItem(WAKE_KEY, JSON.stringify(w)); } catch { /* ok */ } }} className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[9px] text-white outline-none" />–
                      <input type="time" value={wake.quietTo} onChange={(e) => { const w = { ...wake, quietTo: e.target.value }; setWake(w); try { localStorage.setItem(WAKE_KEY, JSON.stringify(w)); } catch { /* ok */ } }} className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[9px] text-white outline-none" />
                    </label>
                  </div>
                  <div className="mt-2 border-t pt-1.5" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <span className="text-[9px] font-bold uppercase tracking-wide text-white/40">😴 Sleep mode · </span>
                    {([
                      ['Observe only', () => { setSleepNoNew(false); setMode('observe'); emilLog('mode', 'SLEEP: Observe Only — EMIL watches, trades nothing. Read-back confirmed.'); setLogTick((t) => t + 1); }],
                      ['Manage existing only', () => { setSleepNoNew(true); emilLog('mode', 'SLEEP: Manage Existing Only — no new entries; EMIL keeps managing open EMIL trades (stops, exits) while the pilot is armed. Read-back confirmed.'); setLogTick((t) => t + 1); }],
                      ['Confirm before trading', () => { setSleepNoNew(false); setMode('confirm'); emilLog('mode', 'SLEEP: Confirm Before Trading — EMIL prepares, you confirm. Read-back confirmed.'); setLogTick((t) => t + 1); }],
                      ['Autonomous within limits', () => { setSleepNoNew(false); setGateOpen(true); }],
                    ] as const).map(([label, fn]) => (
                      <button key={label} onClick={fn}
                        className="mb-1 mr-1.5 rounded px-2 py-0.5 text-[9px] font-bold transition-all hover:brightness-125"
                        style={{ backgroundColor: 'rgba(255,213,79,0.08)', color: 'rgba(255,213,79,0.8)', border: '1px solid rgba(255,213,79,0.3)' }}>
                        {label}
                      </button>
                    ))}
                    {sleepNoNew && <span className="text-[9px]" style={{ color: '#FFB300' }}>· no-new-entries active</span>}
                    <p className="mt-0.5 text-[8px] text-white/25">
                      Alerts are browser notifications + tones on this device; delivery is never guaranteed (device settings, connectivity). EMIL
                      never invents permissions because you didn&apos;t answer — unanswered alerts fall back to your approved rules only.
                    </p>
                  </div>
                </div>
              </div>

              {/* ── Global Macro Intelligence (real data only) ── */}
              {macro && (
                <div className="mt-3 grid gap-2 lg:grid-cols-2">
                  {/* Risk mood + uncertainty */}
                  <div className="rounded-lg border p-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                    <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-white/40">Global risk mood · cross-asset, last 24h</div>
                    <div className="flex items-center gap-3">
                      <span className="text-[16px] font-bold" style={{ color: macro.mood.color, textShadow: `0 0 8px ${macro.mood.color}66` }}>{macro.mood.label}</span>
                      <div className="h-2.5 flex-1 rounded bg-white/[0.05]">
                        <div className="h-full rounded" style={{ width: `${(macro.mood.score + 100) / 2}%`, background: 'linear-gradient(90deg,#FF5252,#FFB300,#00C27A)' }} />
                      </div>
                      <span className="font-mono text-[11px] text-white/60">{macro.mood.score > 0 ? '+' : ''}{macro.mood.score}</span>
                    </div>
                    {macro.mood.evidence.map((e, i) => <p key={i} className="mt-1 text-[9px] text-white/40">· {e}</p>)}
                    {macro.forecast && (
                      <div className="mt-2 border-t pt-1.5" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                        <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-white/40">
                          Uncertainty · {activeSymbol}: <span style={{ color: macro.forecast.uncertainty.level === 'HIGH' ? '#FF5252' : macro.forecast.uncertainty.level === 'ELEVATED' ? '#FFB300' : '#00C27A' }}>{macro.forecast.uncertainty.level} ({macro.forecast.uncertainty.score}/100)</span>
                        </div>
                        {macro.forecast.uncertainty.reasons.slice(0, 3).map((r, i) => <p key={i} className="text-[9px] text-white/40">· {r}</p>)}
                        {macro.forecast.uncertainty.level === 'HIGH' && <p className="mt-1 text-[9px] font-bold" style={{ color: '#FF5252' }}>Pilot entries suspended on unreadable markets — No Trade is a decision.</p>}
                      </div>
                    )}
                  </div>

                  {/* Probabilistic forecast */}
                  <div className="rounded-lg border p-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                    <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-white/40">
                      Scenario forecast · {activeSymbol} · confidence {macro.forecast?.confidence ?? '—'}% (decays with uncertainty)
                    </div>
                    {macro.forecast ? (
                      <>
                        {macro.forecast.scenarios.map((s) => (
                          <div key={s.name} className="mb-1 flex items-center gap-2 text-[10px]">
                            <span className="w-40 shrink-0 text-white/60">{s.name}</span>
                            <div className="h-2 flex-1 rounded bg-white/[0.05]">
                              <div className="h-full rounded" style={{ width: `${s.probability}%`, backgroundColor: s.name.includes('Bullish') || s.name.includes('up') ? 'rgba(0,194,122,0.7)' : s.name.includes('Bearish') || s.name.includes('down') ? 'rgba(255,82,82,0.7)' : 'rgba(255,179,0,0.7)' }} />
                            </div>
                            <span className="w-10 shrink-0 text-right font-mono text-white/70">{s.probability}%</span>
                          </div>
                        ))}
                        {/* 🎺 Probability cone from the live entry plan */}
                        {council?.bestOpp && (
                          <div className="mt-1.5 rounded border px-2 py-1.5 font-mono text-[9px]" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                            <span className="text-white/35">Cone: </span>
                            <span style={{ color: '#FF5252' }}>pessimistic {council.bestOpp.zone.stop}</span>
                            <span className="text-white/30"> ← </span>
                            <span className="text-white/70">entry {council.bestOpp.zone.preferred}</span>
                            <span className="text-white/30"> → </span>
                            <span style={{ color: '#9CCC65' }}>likely {council.bestOpp.zone.target1}</span>
                            <span className="text-white/30"> → </span>
                            <span style={{ color: '#00C27A' }}>optimistic {council.bestOpp.zone.target2}</span>
                          </div>
                        )}
                        {/* 📖 Market story — the read in plain words */}
                        {macro.symMood && (
                          <p className="mt-1.5 text-[10px] italic leading-relaxed text-white/55">
                            📖 {activeSymbol} reads {macro.symMood.label.toLowerCase()} — {macro.symMood.note}. The council {council?.stance === 'NO EDGE' ? 'sees no edge, and waiting costs nothing' : council?.stance === 'STAND ASIDE' ? 'is standing aside: protection outranks opportunity right now' : `leans ${council?.stance === 'BULLISH LEAN' ? 'long' : 'short'}, but only a disciplined pullback entry keeps the risk honest`}.{macro.events.length ? ` Event risk sits ahead (${macro.events[0].ev.currency} ${macro.events[0].ev.title}), so plans can expire quickly.` : ''}
                          </p>
                        )}
                        <p className="mt-1 text-[9px] text-white/40">Invalidation: {macro.forecast.invalidation}</p>
                        <p className="text-[9px] text-white/30">Horizon: {macro.forecast.horizon}. Probabilities, never certainty.</p>
                      </>
                    ) : <p className="text-[10px] text-white/40">Collecting bars…</p>}
                    {macro.events.length > 0 && (
                      <div className="mt-2 border-t pt-1.5" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                        <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-white/40">Event risk ahead ({activeSymbol} currencies)</div>
                        {macro.events.slice(0, 3).map((g, i) => (
                          <p key={i} className="text-[9px] text-white/45">📅 {g.ev.currency} “{g.ev.title}” {fmtEta(g.ev.timeMs)} — {g.impactNote}. EMIL waits ~{g.waitMin} min after the release.</p>
                        ))}
                      </div>
                    )}
                  </div>
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
                    <span style={{ color: '#FFD54F' }}>Conviction {Math.round(0.6 * council.bestOpp.score + 0.4 * council.confidence)}</span>
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

              {/* 🛑 Guardian status + 📊 Trust score (measured outcomes only) */}
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {(() => {
                  const log = loadEmilLog();
                  const vetoes = log.filter((e) => e.text.startsWith('GUARDIAN VETO')).length;
                  const entries = log.filter((e) => e.kind === 'entry').length;
                  const blocked = log.filter((e) => e.kind === 'blocked').length;
                  const wakes = log.filter((e) => e.text.startsWith('WAKE')).length;
                  const stops = log.filter((e) => e.text.startsWith('STOP EVERYTHING')).length;
                  const learn = loadEmilLearning();
                  const totalTrades = learn.reduce((a, l) => a + l.n, 0);
                  const totalWins = learn.reduce((a, l) => a + l.wins, 0);
                  return (
                    <>
                      <div className="rounded-lg border p-3" style={{ borderColor: 'rgba(255,82,82,0.3)' }}>
                        <div className="mb-1 text-[9px] font-bold uppercase tracking-wide" style={{ color: '#FF5252' }}>🛑 Guardian — independent, EMIL cannot silence it</div>
                        <p className="text-[10px] text-white/55">6 watchdogs armed in the order path: duplicate-order · rate limit · missing stop-loss · stale quote · abnormal spread · unreadable market.</p>
                        <p className="mt-1 font-mono text-[10px]" style={{ color: vetoes ? '#FF8A65' : '#00C27A' }}>
                          {vetoes ? `${vetoes} veto(es) recorded — each logged with its reason` : 'no vetoes needed yet — every EMIL order passed independent checks'}
                        </p>
                      </div>
                      <div className="rounded-lg border p-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                        <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-white/40">📊 Trust score — measured outcomes, not self-praise</div>
                        <div className="grid grid-cols-2 gap-x-4 font-mono text-[10px] text-white/60">
                          <span>Closed trades: {totalTrades}</span>
                          <span>Win rate: {totalTrades ? Math.round((totalWins / totalTrades) * 100) + '%' : '—'}</span>
                          <span>Entries logged: {entries}</span>
                          <span>Refusals/blocks: {blocked}</span>
                          <span>Benched buckets: {learn.filter((l) => l.avoided).length}</span>
                          <span>Wakes fired: {wakes}</span>
                          <span>Guardian vetoes: {vetoes}</span>
                          <span>Hard stops used: {stops}</span>
                        </div>
                        <p className="mt-1 text-[8px] text-white/30">All counts from the real activity log and closed-trade learning — exportable via Knowledge Evolution.</p>
                      </div>
                    </>
                  );
                })()}
              </div>

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
                  {loadEmilLearning().length > 0 && (
                    <div className="mt-1.5 border-t pt-1.5" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                      <p className="text-[9px] text-white/35">
                        📚 Knowledge evolution (learning never stops):{' '}
                        {loadEmilLearning().slice(0, 6).map((l) => `${l.key.replace('|', ' ')} ${l.wins}/${l.n}${l.avoided ? ' ⛔benched' : ''}`).join(' · ')}
                        {' '}— benching is risk-reducing only; risk-raising changes always need your approval.
                      </p>
                      <div className="mt-1 flex gap-1.5">
                        <button onClick={() => {
                          const blob = new Blob([JSON.stringify({ learning: loadEmilLearning(), log: loadEmilLog(), exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
                          const a = document.createElement('a');
                          a.href = URL.createObjectURL(blob);
                          a.download = `emil-knowledge-${new Date().toISOString().slice(0, 10)}.json`;
                          a.click(); URL.revokeObjectURL(a.href);
                        }} className="rounded px-2 py-0.5 text-[8px] font-bold text-white/45 transition-colors hover:text-white" style={{ border: '1px solid rgba(255,255,255,0.12)' }}>
                          Export knowledge
                        </button>
                        <button onClick={() => {
                          if (!window.confirm('Reset EMIL learning? All learned bucket statistics and benchings are cleared. This cannot be undone.')) return;
                          try { localStorage.removeItem('raptor_emil_learn_v1'); } catch { /* ignore */ }
                          emilLog('mode', 'learning RESET by trader — bucket statistics cleared, EMIL starts observing fresh');
                          setLogTick((t) => t + 1);
                        }} className="rounded px-2 py-0.5 text-[8px] font-bold transition-colors hover:brightness-125" style={{ color: '#FF8A65', border: '1px solid rgba(255,138,101,0.3)' }}>
                          Reset learning
                        </button>
                      </div>
                    </div>
                  )}
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
              {/* Setup choice: A) my parameters · B) EMIL managed · C) hybrid */}
              <div className="mb-2 grid grid-cols-3 gap-1.5">
                {([
                  ['mine', 'Use My Parameters', 'You define instruments and modes; EMIL optimises only inside your boundaries.'],
                  ['emil', 'Let EMIL Handle All', 'EMIL selects modes, instruments and timeframes — the risk envelope below still binds him.'],
                  ['hybrid', 'Guide EMIL', 'You set the limits and the approved mode list; EMIL chooses among them.'],
                ] as const).map(([v, label, desc]) => (
                  <button key={v}
                    onClick={() => setAutoParams((p) => ({
                      ...p, setupChoice: v,
                      modeControl: v === 'emil' ? 'emil' : v === 'mine' ? 'trader' : 'shared',
                      selectAll: v === 'emil' ? true : p.selectAll,
                    }))}
                    className="rounded border px-2 py-1.5 text-left transition-all hover:brightness-125"
                    style={{
                      borderColor: autoParams.setupChoice === v ? 'rgba(206,147,216,0.7)' : 'rgba(255,255,255,0.1)',
                      backgroundColor: autoParams.setupChoice === v ? 'rgba(206,147,216,0.15)' : 'rgba(255,255,255,0.03)',
                    }}
                    title={desc}>
                    <div className="text-[10px] font-bold" style={{ color: autoParams.setupChoice === v ? '#CE93D8' : 'rgba(255,255,255,0.6)' }}>{label}</div>
                    <div className="text-[8px] leading-snug text-white/35">{desc}</div>
                  </button>
                ))}
              </div>

              {/* Trade modes: allowed styles (trader/shared control) */}
              {autoParams.modeControl !== 'emil' && (
                <div className="mb-2">
                  <div className="mb-1 text-[9px] uppercase tracking-wide text-white/40">
                    Approved trade modes {autoParams.modeControl === 'trader' ? '(EMIL trades only these)' : '(EMIL picks the best among these)'}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {SCAN_TFS.map((t) => (
                      <button key={t.style}
                        onClick={() => setAutoParams((p) => ({ ...p, enabledModes: p.enabledModes.includes(t.style) ? p.enabledModes.filter((x) => x !== t.style) : [...p.enabledModes, t.style] }))}
                        className="rounded px-1.5 py-0.5 text-[9px] font-bold transition-all"
                        style={{
                          backgroundColor: autoParams.enabledModes.includes(t.style) ? 'rgba(206,147,216,0.25)' : 'rgba(255,255,255,0.04)',
                          color: autoParams.enabledModes.includes(t.style) ? '#CE93D8' : 'rgba(255,255,255,0.35)',
                          border: `1px solid ${autoParams.enabledModes.includes(t.style) ? 'rgba(206,147,216,0.6)' : 'rgba(255,255,255,0.1)'}`,
                        }}
                        title={`${t.label} · holding ${t.holding}`}>
                        {t.style} ({t.label})
                      </button>
                    ))}
                  </div>
                  <p className="mt-0.5 text-[8px] text-white/30">Martingale, grid escalation and averaging-down do not exist as modes and stay disabled by design.</p>
                </div>
              )}

              <div className="mb-2">
                <label className="mb-1.5 flex items-center gap-2 text-[10px] font-bold" style={{ color: '#CE93D8' }}>
                  <input type="checkbox" checked={autoParams.selectAll}
                    onChange={(e) => setAutoParams((p) => ({ ...p, selectAll: e.target.checked }))} className="accent-[#CE93D8]" />
                  EMIL selects instruments himself — full universe ({Object.keys(prices).filter((s) => prices[s]?.bid != null).length} instruments), all styles (M15 scalp-style → D1 positional)
                </label>
                {!autoParams.selectAll && (
                  <>
                    <div className="mb-1 text-[9px] uppercase tracking-wide text-white/40">Restrict EMIL to these instruments</div>
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
                  </>
                )}
                <label className="mt-1.5 flex items-center gap-2 text-[10px] text-white/60">
                  <input type="checkbox" checked={autoParams.autoHedge}
                    onChange={(e) => setAutoParams((p) => ({ ...p, autoHedge: e.target.checked }))} className="accent-[#CE93D8]" />
                  Auto-hedge: when a position goes ≥0.5R adverse and the council is uncertain, EMIL may place a viable hedge leg (efficiency-gated, tagged EMIL:HEDGE)
                </label>
                <label className="mt-1.5 flex items-center gap-2 text-[10px] text-white/60">
                  <input type="checkbox" checked={autoParams.smallSteady}
                    onChange={(e) => setAutoParams((p) => ({ ...p, smallSteady: e.target.checked }))} className="accent-[#CE93D8]" />
                  <b>Small &amp; Steady mode</b>: base lot only, quality bar +10, discipline over throughput — pairs well with a daily profit lock
                </label>
                <div className="mt-1.5 rounded border p-2" style={{ borderColor: 'rgba(0,229,160,0.3)', backgroundColor: 'rgba(0,229,160,0.04)' }}>
                  <label className="flex items-center gap-2 text-[10px] font-bold" style={{ color: '#00E5A0' }}>
                    <input type="checkbox" checked={autoParams.profitOnly}
                      onChange={(e) => setAutoParams((p) => ({ ...p, profitOnly: e.target.checked }))} className="accent-[#00E5A0]" />
                    Profit-Only: capital is untouchable — EMIL trades from realized profits only
                  </label>
                  {autoParams.profitOnly && (
                    <div className="mt-1.5 flex flex-wrap items-end gap-3">
                      <label className="text-[9px] text-white/45">Protected capital $
                        <input type="number" min={0} step={100} value={autoParams.protectedCapital}
                          onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) setAutoParams((p) => ({ ...p, protectedCapital: Math.max(0, v) })); }}
                          className="mt-0.5 block w-[110px] rounded bg-white/[0.06] px-1.5 py-1 font-mono text-[10px] text-white outline-none" style={{ border: '1px solid rgba(0,229,160,0.3)' }} />
                      </label>
                      <button onClick={() => setAutoParams((p) => ({ ...p, protectedCapital: Math.round(Number(accountSummary?.balance ?? 0)) }))}
                        className="rounded px-2 py-1 text-[9px] font-bold transition-all hover:brightness-125"
                        style={{ backgroundColor: 'rgba(0,229,160,0.12)', color: '#00E5A0', border: '1px solid rgba(0,229,160,0.4)' }}>
                        Set to current balance (${Number(accountSummary?.balance ?? 0).toFixed(0)})
                      </button>
                      <label className="text-[9px] text-white/45">% of profit cushion riskable / trade
                        <input type="number" min={1} max={100} step={5} value={autoParams.tradableProfitPct}
                          onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) setAutoParams((p) => ({ ...p, tradableProfitPct: Math.max(1, Math.min(100, v)) })); }}
                          className="mt-0.5 block w-[70px] rounded bg-white/[0.06] px-1.5 py-1 font-mono text-[10px] text-white outline-none" style={{ border: '1px solid rgba(0,229,160,0.3)' }} />
                      </label>
                      <span className="text-[9px] text-white/40">Balance at/below the protected line → EMIL stops opening risk and only protects.</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                {([
                  ['Base lot (floor)', 'baseLot', 0.01, 5, 0.01],
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
                    if (!autoParams.selectAll && !autoParams.symbols.length) return;
                    if (autoParams.modeControl !== 'emil' && !autoParams.enabledModes.length) return;
                    saveEmilAutoParams(autoParams);
                    recordEmilAutoConsent(gateTyped.trim(), autoParams);
                    setGateOpen(false); setGateTyped('');
                    setMode('auto');
                    emilLog('mode', `AUTONOMOUS PILOT armed — ${autoParams.selectAll ? 'EMIL selects instruments (full universe)' : autoParams.symbols.join(', ')} · base lot ${autoParams.baseLot} · risk ${autoParams.riskPct}%/trade · max ${autoParams.maxPerDay}/day · stop after ${autoParams.stopAfterLosses} losses · loss stop $${autoParams.dailyLossStop}${autoParams.dailyProfitLock ? ` · profit lock $${autoParams.dailyProfitLock}` : ''}${autoParams.autoHedge ? ' · auto-hedge ON' : ''}${autoParams.smallSteady ? ' · Small&Steady' : ''}${autoParams.profitOnly ? ` · PROFIT-ONLY (capital $${autoParams.protectedCapital} protected, ${autoParams.tradableProfitPct}% of cushion/trade)` : ''} · setup ${autoParams.setupChoice === 'emil' ? 'Let EMIL Handle All' : autoParams.setupChoice === 'mine' ? 'My Parameters' : 'Guide EMIL'} · modes ${autoParams.modeControl === 'emil' ? 'EMIL managed (all)' : autoParams.enabledModes.join('/')} · learning always on`);
                    setLogTick((t) => t + 1);
                  }}
                  disabled={gateTyped.trim().toUpperCase() !== 'I AUTHORIZE EMIL' || (!autoParams.selectAll && !autoParams.symbols.length) || (autoParams.modeControl !== 'emil' && !autoParams.enabledModes.length)}
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

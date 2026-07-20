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
  emilConsentAcceptedAt,
  type EmilConsensus, type CouncilStance, type EmilAutoParams,
} from '@/lib/trading/emil-council';
import {
  objectiveEffects, loadObjectives, riskBudget, trackDayPeak,
  recordShadow, recordReplay, decisionScores,
} from '@/lib/trading/emil-governance';
import { loadLangPrefs, routeCommand, sarvamTranslate, sarvamHealth, sarvamSpeech, startVoiceCapture, langAudit, type VoiceCapture } from '@/lib/trading/emil-language';
import { getPipSize, calcPipValue } from '@/lib/trading/ticket-math';
import EmilGovernance from '@/components/trading/emil/EmilGovernance';
import EmilLanguagePanel from '@/components/trading/emil/EmilLanguagePanel';
import { findHedges } from '@/lib/trading/hedge-engine';
import { getLock, symbolCurrencies } from '@/lib/trading/protection';
import { emilLearnBonus } from '@/lib/trading/emil-council';
import { riskMood, uncertaintyScore, forecastScenarios, eventGuidance, marketMood, type RiskMood, type ForecastRead, type EventGuidance, type MoodRead } from '@/lib/trading/emil-macro';
import { parseMission, type MissionParse } from '@/lib/trading/emil-mission';
import { runScan, DEFAULT_FILTERS, assessOpportunity, type Opportunity } from '@/lib/trading/scanner-engine';
import { SCAN_TFS } from '@/lib/trading/scanner-engine';
import {
  ADAPT_TFS, EXTENDED_TFS, UNSUPPORTED_TF_NOTE, ADAPT_DISCLAIMER,
  loadAdaptPrefs, saveAdaptPrefs, effectiveAllowedTFs, tfRoles, suitabilityMatrix,
  stabilityCheck, recordModeSwitch, tradeChangeAllowed, recordTradeChange,
  ensureIdentity, appendIdentityChange, loadIdentities, currentManagedTf,
  type AdaptPrefs, type MatrixRow,
} from '@/lib/trading/emil-adapt';
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
import { highImpactWithin, upcomingHighImpact, fmtEta } from '@/lib/trading/news-guard';

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
  const [adaptPrefs, setAdaptPrefs] = useState<AdaptPrefs>(loadAdaptPrefs);
  const [adaptGate, setAdaptGate] = useState(false);
  const [matrixRows, setMatrixRows] = useState<MatrixRow[]>([]);
  const [sarvamOk, setSarvamOk] = useState<boolean | null>(null);
  const [recording, setRecording] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const voiceCapRef = useRef<VoiceCapture | null>(null);
  const givebackDayRef = useRef<string>('');
  const streakDayRef = useRef<string>('');
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
  useEffect(() => { sarvamHealth().then(setSarvamOk); }, []);
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
      // Mode × timeframe suitability matrix for the focused symbol (live, transparent).
      setMatrixRows(suitabilityMatrix({
        builder, symbol: activeSymbol, tick: prices[activeSymbol], calendar,
        allowed: effectiveAllowedTFs(loadAdaptPrefs()),
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

  const updateAdapt = useCallback((patch: Partial<AdaptPrefs>, readback: string) => {
    setAdaptPrefs((p) => { const next = { ...p, ...patch }; saveAdaptPrefs(next); return next; });
    emilLog('mode', `ADAPTATION: ${readback}`);
    setLogTick((t) => t + 1);
  }, []);

  // Mission parsing pipeline — shared by typed text AND voice transcripts.
  // §Language routing: English → rule parser directly; Indian/mixed text →
  // Sarvam translate (consented + configured) → the SAME rule parser +
  // read-back + explicit Apply. Never guessed; never executes on its own.
  const runMissionParse = useCallback(async (text: string) => {
    const pricesNow = useTradingStore.getState().prices;
    const universe = Object.keys(pricesNow).filter((s) => pricesNow[s]?.bid != null);
    const route = routeCommand(text, loadLangPrefs(), sarvamOk === true);
    let textToParse = text;
    const preRules: { label: string; detail: string }[] = [];
    if (route.engine === 'sarvam+rules') {
      const tr = await sarvamTranslate(text, route.detect.lang);
      if (tr.ok && tr.translated) {
        textToParse = tr.translated;
        preRules.push({ label: 'Sarvam translation', detail: `“${tr.translated}” — review the read-back below before applying` });
        langAudit({ original: text.slice(0, 200), detected: route.detect.label, engine: 'sarvam+rules', translated: tr.translated.slice(0, 200), action: 'mission parsed' });
      } else {
        preRules.push({ label: 'Language service', detail: `${tr.error} — parsed with the English rule engine instead` });
        langAudit({ original: text.slice(0, 200), detected: route.detect.label, engine: 'rules(fallback)', translated: null, action: 'sarvam unavailable' });
      }
    } else if (route.detect.lang !== 'en' || route.detect.mixed) {
      preRules.push({ label: 'Language routing', detail: route.reason });
    }
    const parsed = parseMission(textToParse, universe);
    parsed.rules.unshift(...preRules);
    setMissionParse(parsed);
  }, [sarvamOk]);

  // Voice command: mic → 16kHz WAV → Sarvam speech-to-text-translate →
  // English transcript → the same mission pipeline. Nothing executes from
  // voice alone — the read-back + Apply click are always required (§7).
  const handleVoice = useCallback(async () => {
    if (voiceCapRef.current) {
      setVoiceBusy(true);
      try {
        const cap = voiceCapRef.current;
        voiceCapRef.current = null;
        setRecording(false);
        const { base64, seconds } = await cap.stop();
        if (seconds < 1) { emilLog('mode', 'voice: recording too short — try again.'); setLogTick((t) => t + 1); return; }
        const res = await sarvamSpeech(base64);
        if (res.ok && res.transcript) {
          setMissionText(res.transcript);
          langAudit({ original: `[voice ${seconds}s]`, detected: res.language ?? 'unknown', engine: 'sarvam-stt-translate', translated: res.transcript.slice(0, 200), action: 'voice transcribed' });
          emilLog('mode', `voice heard (${res.language ?? 'language unknown'}): “${res.transcript.slice(0, 120)}” — read-back below; nothing applies without your click.`);
          setLogTick((t) => t + 1);
          await runMissionParse(res.transcript);
        } else {
          emilLog('mode', `voice: ${res.error} — type the command instead; nothing was executed.`);
          setLogTick((t) => t + 1);
        }
      } finally { setVoiceBusy(false); }
      return;
    }
    const prefs = loadLangPrefs();
    if (!prefs.sarvamEnabled || !prefs.consentAt) { emilLog('mode', 'voice needs Sarvam enabled + consent — see the Language & Voice panel below.'); setLogTick((t) => t + 1); return; }
    if (sarvamOk !== true) { emilLog('mode', 'voice: Sarvam is not configured on the server — voice stays off, honestly.'); setLogTick((t) => t + 1); return; }
    try {
      voiceCapRef.current = await startVoiceCapture();
      setRecording(true);
    } catch {
      emilLog('mode', 'voice: microphone unavailable or permission denied.');
      setLogTick((t) => t + 1);
    }
  }, [sarvamOk, runMissionParse]);

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

        // §26 Winning-streak control: streaks change NOTHING — say so once a day.
        let consecW = 0;
        for (const r of emilRows) { if (Number(r.realized_pnl ?? 0) > 0) consecW++; else break; }
        if (consecW >= 3 && streakDayRef.current !== new Date().toDateString()) {
          streakDayRef.current = new Date().toDateString();
          emilLog('mode', `winning-streak control: ${consecW} wins in a row — size, frequency, leverage and quality bars stay exactly the same. Streaks never loosen discipline; controlled compounding is a separate trader decision.`);
          setLogTick((x) => x + 1);
        }

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

          // Trade identity (§10): freeze the original setup facts at first
          // sighting — mode/TF changes later never rewrite this history.
          const r0Seed = pos.sl != null && pos.sl !== 0 ? (openPx - Number(pos.sl)) * dir : null;
          ensureIdentity(pos, r0Seed != null && r0Seed > 0 ? r0Seed : null);

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
                  appendIdentityChange(pos.id, { ts: Date.now(), kind: 'stop', from: String(pos.sl), to: String(newSl), note: targetLockR === 0 ? 'break-even' : `lock +${targetLockR}R` });
                  emilLog('breakeven', targetLockR === 0
                    ? `${pos.symbol}: +1R reached — stop to break-even (${newSl}). The trade can no longer lose.`
                    : `${pos.symbol}: +${Math.floor(profitR)}R reached — stop trailed to lock +${targetLockR}R (${newSl}).`);
                  setLogTick((x) => x + 1);
                } catch { /* may have closed */ }
              }
            }

            // §4 Dynamic timeframe expansion — only AFTER profit is protected:
            // stop at break-even or better, the next ladder timeframe confirms
            // the move, adaptation isn't paused, and the per-trade change cap
            // holds. Management relabels one step up (capped at H4 — overnight/
            // weekend authorisation controls beyond that aren't built, honestly).
            // The stop NEVER widens and risk never increases from this.
            if (risk0 && risk0 > 0 && pos.sl != null) {
              const profitRNow = (Number(cur) - openPx) * dir / risk0;
              const lockRNow = (Number(pos.sl) - openPx) * dir / risk0;
              const identNow = loadIdentities()[pos.id];
              if (identNow && profitRNow >= 1 && lockRNow >= 0 && !loadAdaptPrefs().pause && tradeChangeAllowed(pos.id)) {
                const curTf = currentManagedTf(identNow);
                const idx = ADAPT_TFS.findIndex((t) => t.label === curTf);
                const capIdx = ADAPT_TFS.findIndex((t) => t.label === 'H4');
                const nextTf = idx >= 0 && idx < capIdx ? ADAPT_TFS[idx + 1] : null;
                if (nextTf) {
                  const hs = classifyMarketState(builder.getAllBars(pos.symbol, nextTf.res));
                  const alignedUp = hs && ((dir > 0 && hs.state.includes('Uptrend')) || (dir < 0 && hs.state.includes('Downtrend'))) && hs.confidence >= 65;
                  if (alignedUp) {
                    appendIdentityChange(pos.id, { ts: Date.now(), kind: 'tf', from: curTf, to: nextTf.label, note: `expansion: ${hs.state} on ${nextTf.label} (${hs.confidence}%) with +${profitRNow.toFixed(1)}R running and the stop locked at ${lockRNow >= 0 ? '+' : ''}${lockRNow.toFixed(1)}R` });
                    recordTradeChange(pos.id);
                    emilLog('mode', `${pos.symbol}: the ${curTf} ${identNow.mode.toLowerCase()} trade developed into a confirmed ${nextTf.label} trend (${hs.confidence}%). Profit is protected — stop is at break-even or better with +${profitRNow.toFixed(1)}R running — so the remainder is now managed as ${nextTf.style}. Original risk unchanged; the stop never widens to justify a longer hold.`);
                    setLogTick((x) => x + 1);
                  }
                }
              }
            }
          }

          // Council read for this symbol (cheap: no hedge/exposure agents).
          const c = buildCouncil({ builder, symbol: pos.symbol, ticks, calendar, positions: [], history: [], specs: null, accountId: activeAccountId, balance: 0, isLiveData });
          const against = (pos.direction === 'BUY' && c.stance === 'BEARISH LEAN') || (pos.direction === 'SELL' && c.stance === 'BULLISH LEAN');
          if (against && c.confidence >= p.minCouncilConf) {
            try {
              await orderService.closePosition(pos.id, Number(cur));
              appendIdentityChange(pos.id, { ts: Date.now(), kind: 'exit', note: `council flipped ${c.stance} (${c.confidence}%) against the ${pos.direction}` });
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
                    appendIdentityChange(pos.id, { ts: Date.now(), kind: 'hedge', to: h.symbol, note: `${h.hedgeDirection} ${h.symbol} hedge leg at ${adverseR.toFixed(1)}R adverse` });
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

        // §19 Autonomous permission expiry — lapse to Prepare, keep managing.
        if (p.expiryMode === 'day' || p.expiryMode === 'week') {
          const t0 = emilConsentAcceptedAt();
          const ttl = p.expiryMode === 'day' ? 86_400_000 : 7 * 86_400_000;
          if (t0 && Date.now() - t0 > ttl) {
            emilLog('lock', `autonomous permission expired (${p.expiryMode} limit) — dropped to Prepare level. Existing positions keep their approved management; renew autonomy via the gate.`);
            wakeAlert('info', 'perm-expiry', 'EMIL autonomous permission expired — renew via the gate when ready.', 240);
            setMode('confirm');
            setLogTick((x) => x + 1);
            return;
          }
        }

        // §16 Profit-decay protection: day peak tracked, giveback bounded.
        let openPnl = 0;
        for (const pos of emilOpenPos) {
          const dir = pos.direction === 'BUY' ? 1 : -1;
          const tk = ticks[pos.symbol];
          const cp = dir > 0 ? tk?.bid : tk?.ask;
          if (cp != null) openPnl += (Number(cp) - Number(pos.open_price)) * dir / getPipSize(pos.symbol) * calcPipValue(pos.symbol, Number(pos.size));
        }
        const { peak, giveback } = trackDayPeak(realized + openPnl);
        if (p.maxGiveback > 0 && peak > 0 && giveback >= p.maxGiveback) {
          if (givebackDayRef.current !== new Date().toDateString()) {
            givebackDayRef.current = new Date().toDateString();
            emilLog('lock', `profit-decay protection: day peak +$${peak.toFixed(0)}, given back $${giveback.toFixed(0)} ≥ your $${p.maxGiveback} limit — Profit Protection Mode: no new entries today; existing positions still managed.`);
            setLogTick((x) => x + 1);
          }
          setEmilStatus('Protecting');
          return;
        }

        if (consec >= p.stopAfterLosses) { emilLog('lock', `${consec} EMIL losses in a row — pilot paused per your rule`); stopEverything('consecutive losses'); return; }
        // §2 Objective hierarchy: top-ranked objectives apply deterministic effects.
        const objEff = objectiveEffects(loadObjectives());
        const maxPerDayEff = objEff.maxPerDayCap != null ? Math.min(p.maxPerDay, objEff.maxPerDayCap) : p.maxPerDay;
        const entriesToday = loadEmilLog().filter((e) => e.kind === 'entry' && e.ts >= midnight.getTime()).length;
        if (entriesToday >= maxPerDayEff) { setEmilStatus('Managing'); return; } // manage-only for the rest of the day
        if (rs === 'Defensive' || rs === 'Capital Lock') { setEmilStatus('Protecting'); return; } // no new risk while defensive

        // Quality bar rises when cautious, in Small & Steady mode, or when
        // top-ranked objectives demand higher-confidence trades.
        const minScoreEff = p.minScore + (rs === 'Cautious' ? 10 : 0) + (p.smallSteady ? 10 : 0) + objEff.minScoreBonus;

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
        // Universal adaptation authority (§19): which timeframes/modes may trade now.
        const adapt = loadAdaptPrefs();
        const allowedTFsNow = effectiveAllowedTFs(adapt);
        const candidates: { c: EmilConsensus; opp: NonNullable<EmilConsensus['bestOpp']>; adj: number }[] = [];
        for (const symbol of scanUniverse) {
          if (emilOpenPos.some((x) => x.symbol === symbol)) continue; // one EMIL trade per symbol
          const c = buildCouncil({ builder, symbol, ticks, calendar, positions: [], history: [], specs: null, accountId: activeAccountId, balance: balanceNow, isLiveData });
          if (c.stance !== 'BULLISH LEAN' && c.stance !== 'BEARISH LEAN') continue;
          if (c.confidence < p.minCouncilConf) continue;
          // News buffer: no entries within 30 min of a red-flag event on the symbol.
          if (highImpactWithin(symbolCurrencies(symbol), calendar, 30).length) continue;
          // Uncertainty gate: EMIL refuses to enter markets he cannot read.
          const unc = uncertaintyScore(builder, symbol, ticks[symbol], calendar);
          if (unc.level === 'HIGH') continue;
          const consider = (opp: EmilConsensus['bestOpp']) => {
            if (!opp || opp.score < minScoreEff) return;
            if (!allowedTFsNow.includes(opp.tfLabel)) return;                 // timeframe authority
            if (adapt.lockedMode && opp.style !== adapt.lockedMode) return;   // locked mode
            // §17 Missed-entry discipline: stretched entries are never chased.
            const entryComp = opp.components.find((x) => x.name === 'Entry quality');
            if (entryComp && entryComp.score < 40) return;
            // §14 Execution-cost forecast: spread must not eat the expected move.
            if (opp.spreadPips != null && opp.expectedPips > 0 && opp.spreadPips > 0.25 * opp.expectedPips) return;
            if (emilShouldAvoid(symbol, opp.tfLabel)) return; // learned avoidance — losing buckets are benched
            const aligned = (c.stance === 'BULLISH LEAN' && opp.direction === 'BUY') || (c.stance === 'BEARISH LEAN' && opp.direction === 'SELL');
            if (!aligned) return;
            if (p.profitOnly && (opp.maxLossEstimate == null || opp.maxLossEstimate > maxRiskAllowed)) return; // slice of profits only
            // Trade Mode controller: only allowed modes may trade (trader/shared control).
            if (p.modeControl !== 'emil' && !p.enabledModes.includes(opp.style)) return;
            candidates.push({ c, opp, adj: opp.score + emilLearnBonus(symbol, opp.tfLabel) - (unc.level === 'ELEVATED' ? 8 : 0) });
          };
          consider(c.bestOpp);
          // Universal timeframe ladder (§2): extended TFs beyond the scanner's
          // six compete too — only when the authority settings allow them.
          for (const xtf of EXTENDED_TFS) {
            if (!allowedTFsNow.includes(xtf.label)) continue;
            consider(assessOpportunity({ builder, symbol, tf: xtf, tick: ticks[symbol], calendar, openPositionCurrencies: [], balance: balanceNow, isLiveData }));
          }
        }
        // ── Mode Confidence board: every allowed mode competes, and No-Trade
        // is a first-class contender that wins when nothing qualifies. ──
        const byCombo = new Map<string, number>();
        for (const cand of candidates) {
          const k = `${cand.opp.style} (${cand.opp.tfLabel})`;
          byCombo.set(k, Math.max(byCombo.get(k) ?? 0, cand.adj));
        }
        const board = ADAPT_TFS
          .filter((t) => allowedTFsNow.includes(t.label) && (p.modeControl === 'emil' || p.enabledModes.includes(t.style)))
          .map((t) => ({ mode: `${t.style} (${t.label})`, conf: Math.min(100, byCombo.get(`${t.style} (${t.label})`) ?? 0) }));
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
        // §8 Setups skipped by sleep become shadow records against real bars.
        if (sleepNoNewRef.current) {
          if (candidates.length) {
            const top = candidates.reduce((a, b) => (b.adj > a.adj ? b : a));
            recordShadow({ ts: Date.now(), symbol: top.opp.symbol, direction: top.opp.direction, tf: top.opp.tfLabel, entry: top.opp.zone.preferred, stop: top.opp.zone.stop, target: top.opp.zone.target1, reason: 'no-new-entries sleep mode' });
          }
          setEmilStatus('Managing'); return;
        }

        if (candidates.length) {
          setEmilStatus('Trading');
          candidates.sort((a, b) => b.adj - a.adj);
          // Conservative tie-break: among near-equal scores (±3), prefer the
          // HIGHER timeframe — never the more aggressive mode.
          const tfIdx = (s: string) => ADAPT_TFS.findIndex((t) => t.label === s);
          let bestPick = candidates[0];
          for (const cand of candidates.slice(1)) {
            if (bestPick.adj - cand.adj <= 3 && tfIdx(cand.opp.tfLabel) > tfIdx(bestPick.opp.tfLabel)) bestPick = cand;
          }
          let chosenMode = `${bestPick.opp.style} (${bestPick.opp.tfLabel})`;
          // §15 Adaptation Stability: switching modes needs evidence, not noise.
          // Risk-protection paths (exits, No-Trade, Defensive) never route here.
          if (chosenMode !== lastModeRef.current && lastModeRef.current !== 'No-Trade') {
            const inCurrent = candidates.filter((x) => `${x.opp.style} (${x.opp.tfLabel})` === lastModeRef.current);
            const improvement = inCurrent.length ? bestPick.adj - inCurrent[0].adj : Infinity;
            const stab = stabilityCheck({ pause: adapt.pause, improvement });
            if (!stab.ok) {
              if (inCurrent.length) {
                bestPick = inCurrent[0];
                chosenMode = lastModeRef.current;
                emilLog('mode', `stability: staying in ${lastModeRef.current} — ${stab.reason}. Switching costs spread and focus; the evidence must pay for it.`);
                setLogTick((x) => x + 1);
              } else if (adapt.pause) {
                emilLog('mode', `adaptation paused by you and no qualified setup remains in ${lastModeRef.current} — standing aside this cycle rather than switching modes.`);
                setCurrentMode(lastModeRef.current); setEmilStatus('Watching'); setLogTick((x) => x + 1);
                return;
              }
              // Cooldown with nothing left in the current mode: leaving a dry
              // mode is not flip-flopping — the switch proceeds.
            }
          }
          if (lastModeRef.current !== chosenMode) {
            recordModeSwitch();
            emilLog('mode', `mode switch: ${lastModeRef.current} → ${chosenMode} — reason: highest-confidence qualified setup (${bestPick.opp.symbol}, score ${bestPick.opp.score}, council ${bestPick.c.confidence}%); conservative tie-break favours higher timeframes; never switched to chase losses.`);
            prevModeRef.current = lastModeRef.current;
            lastModeRef.current = chosenMode;
            setLogTick((x) => x + 1);
          }
          setCurrentMode(chosenMode);

          // §6 Trade budget: reject entries beyond the remaining daily risk budget.
          if (p.dailyLossStop > 0 && bestPick.opp.maxLossEstimate != null) {
            const rb = riskBudget({ dailyLossStop: p.dailyLossStop, realizedToday: realized, openPositions: emilOpenPos, closedRows: [] });
            if (bestPick.opp.maxLossEstimate > rb.remaining) {
              emilLog('blocked', `${bestPick.opp.symbol}: entry risk $${bestPick.opp.maxLossEstimate.toFixed(0)} exceeds the remaining daily risk budget $${Number.isFinite(rb.remaining) ? rb.remaining.toFixed(0) : '∞'} (budget $${rb.budget}, loss used $${rb.realizedLoss.toFixed(0)}, open risk $${rb.openRisk.toFixed(0)}) — rejected.`);
              setLogTick((x) => x + 1);
              setEmilStatus('Watching');
              return;
            }
          }

          // §8 Shadow decisions: the best setup NOT taken is tracked against real bars.
          const runnerUp = candidates.find((x) => x !== bestPick);
          if (runnerUp) recordShadow({ ts: Date.now(), symbol: runnerUp.opp.symbol, direction: runnerUp.opp.direction, tf: runnerUp.opp.tfLabel, entry: runnerUp.opp.zone.preferred, stop: runnerUp.opp.zone.stop, target: runnerUp.opp.zone.target1, reason: 'ranked below the chosen entry' });

          const placed = await placeEmilOrder(bestPick.opp, `EMIL:AUTO:${bestPick.opp.tfLabel}`);
          if (placed) {
            // §22 Decision replay — the flight recorder for this entry.
            try {
              const snap = sessionSnapshot();
              const ev = upcomingHighImpact(symbolCurrencies(bestPick.opp.symbol), calendar, 24)[0] ?? null;
              recordReplay({
                ts: Date.now(), symbol: bestPick.opp.symbol, direction: bestPick.opp.direction,
                price: bestPick.opp.zone.preferred, tf: bestPick.opp.tfLabel, mode: chosenMode,
                sessionOpen: snap.sessions.filter((s) => s.open).map((s) => s.id),
                nextNews: ev ? `${ev.currency} ${ev.title} ${fmtEta(ev.timeMs)}` : null,
                votes: bestPick.c.votes.map((v) => ({ agent: v.agent, stance: v.stance, confidence: v.confidence })),
                scores: decisionScores({ builder, symbol: bestPick.opp.symbol, tick: ticks[bestPick.opp.symbol], calendar, council: bestPick.c }),
                riskChecks: ['envelope pass', 'Shield gate', 'Guardian watchdogs', 'news buffer clear', 'uncertainty gate pass', 'risk budget pass'],
                alternatives: candidates.filter((x) => x !== bestPick).slice(0, 3).map((x) => `${x.opp.symbol} ${x.opp.tfLabel} adj ${Math.round(x.adj)}`),
              });
            } catch { /* the flight recorder must never break the pilot */ }
          }
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
                <div className="mb-2 text-[10px] font-bold uppercase tracking-wide" style={{ color: '#FFD54F' }}>🎯 Mission Control — tell EMIL what you want, typed or spoken, in English or your language</div>
                <div className="flex gap-2">
                  <input value={missionText} onChange={(e) => setMissionText(e.target.value)}
                    placeholder='e.g. "Only trade gold and EURUSD. Risk no more than 0.5 percent. Stop after two losses. Lock the day at a $300 target."'
                    className="min-w-0 flex-1 rounded bg-white/[0.06] px-3 py-2.5 text-[13px] text-white placeholder:text-white/25 outline-none" style={{ border: '1px solid rgba(255,213,79,0.3)' }} />
                  <button onClick={handleVoice} disabled={voiceBusy}
                    title={recording ? 'Stop recording and transcribe' : 'Voice command via Sarvam — speak English or an Indian language; EMIL reads back before anything applies'}
                    className="shrink-0 rounded px-3 py-2.5 text-[12px] font-bold transition-all hover:brightness-110 disabled:opacity-40"
                    style={recording
                      ? { backgroundColor: 'rgba(255,82,82,0.2)', color: '#FF5252', border: '1px solid rgba(255,82,82,0.7)', boxShadow: '0 0 12px rgba(255,82,82,0.5)', animation: 'pulse 1.2s infinite' }
                      : { backgroundColor: 'rgba(255,138,101,0.12)', color: '#FF8A65', border: '1px solid rgba(255,138,101,0.4)' }}>
                    {voiceBusy ? '…' : recording ? '⏹ Stop' : '🎤'}
                  </button>
                  <button onClick={() => runMissionParse(missionText)}
                    disabled={!missionText.trim()}
                    className="shrink-0 rounded px-4 py-2.5 text-[12px] font-bold text-black transition-all hover:brightness-110 disabled:opacity-30"
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
                        if (missionParse.wakeMinConviction || missionParse.wakeSessions) {
                          const cur = loadWake();
                          const w = {
                            ...cur,
                            ...(missionParse.wakeMinConviction ? { minConviction: missionParse.wakeMinConviction } : {}),
                            ...(missionParse.wakeSessions ? { enabled: true, sessionLON: missionParse.wakeSessions.lon ?? cur.sessionLON, sessionNYC: missionParse.wakeSessions.nyc ?? cur.sessionNYC } : {}),
                          };
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

              {/* ── 🧭 Universal Adaptation Authority (§19) ── */}
              <div className="mt-3 rounded-lg border p-3" style={{ borderColor: 'rgba(0,229,255,0.3)' }}>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: '#00E5FF' }}>🧭 Universal Adaptation — who selects modes &amp; timeframes</span>
                  <div className="flex gap-1.5">
                    <button onClick={() => updateAdapt({ control: 'trader' }, 'authority → TRADER PREFERENCE. Your allowed timeframes, locks and pause govern; the Let-EMIL-Select-Everything switch is dormant.')}
                      className="rounded px-2.5 py-1 text-[10px] font-bold transition-all hover:brightness-125"
                      style={{
                        backgroundColor: adaptPrefs.control === 'trader' ? 'rgba(0,229,255,0.18)' : 'rgba(255,255,255,0.03)',
                        color: adaptPrefs.control === 'trader' ? '#00E5FF' : 'rgba(255,255,255,0.3)',
                        border: `1px solid ${adaptPrefs.control === 'trader' ? 'rgba(0,229,255,0.6)' : 'rgba(255,255,255,0.1)'}`,
                        opacity: adaptPrefs.control === 'trader' ? 1 : 0.55,
                      }}>
                      Trader preference {adaptPrefs.control === 'trader' ? '· ACTIVE' : '· dormant'}
                    </button>
                    <button onClick={() => {
                      if (!adaptPrefs.consentAt) { setAdaptGate(true); return; }
                      updateAdapt({ control: 'emil' }, 'authority → LET EMIL SELECT EVERYTHING (consent on record). Market, instrument, direction, mode, all ladder timeframes, entry/exit and management are EMIL-selected — always inside your risk envelope, Shield and the Guardian.');
                    }}
                      className="rounded px-2.5 py-1 text-[10px] font-bold transition-all hover:brightness-125"
                      style={{
                        backgroundColor: adaptPrefs.control === 'emil' ? 'rgba(255,213,79,0.18)' : 'rgba(255,255,255,0.03)',
                        color: adaptPrefs.control === 'emil' ? '#FFD54F' : 'rgba(255,255,255,0.3)',
                        border: `1px solid ${adaptPrefs.control === 'emil' ? 'rgba(255,213,79,0.6)' : 'rgba(255,255,255,0.1)'}`,
                        opacity: adaptPrefs.control === 'emil' ? 1 : 0.55,
                      }}>
                      🤖 Let EMIL Select Everything {adaptPrefs.control === 'emil' ? '· ACTIVE' : '· dormant'}
                    </button>
                  </div>
                </div>
                {/* Trader preference fields — dormant while EMIL holds authority */}
                <div className={adaptPrefs.control === 'emil' ? 'pointer-events-none opacity-30' : ''}>
                  <div className="mb-1 text-[9px] uppercase tracking-wide text-white/40">Allowed timeframes {adaptPrefs.control === 'emil' ? '(dormant — EMIL holds selection authority)' : '(EMIL trades only these)'}</div>
                  <div className="mb-2 flex flex-wrap gap-1">
                    {ADAPT_TFS.map((t) => (
                      <button key={t.label}
                        onClick={() => updateAdapt({ allowedTFs: adaptPrefs.allowedTFs.includes(t.label) ? adaptPrefs.allowedTFs.filter((x) => x !== t.label) : [...adaptPrefs.allowedTFs, t.label] }, `allowed timeframes → ${(adaptPrefs.allowedTFs.includes(t.label) ? adaptPrefs.allowedTFs.filter((x) => x !== t.label) : [...adaptPrefs.allowedTFs, t.label]).join(', ') || 'none'}`)}
                        className="rounded px-1.5 py-0.5 font-mono text-[9px] font-bold transition-all"
                        style={{
                          backgroundColor: adaptPrefs.allowedTFs.includes(t.label) ? 'rgba(0,229,255,0.2)' : 'rgba(255,255,255,0.04)',
                          color: adaptPrefs.allowedTFs.includes(t.label) ? '#00E5FF' : 'rgba(255,255,255,0.35)',
                          border: `1px solid ${adaptPrefs.allowedTFs.includes(t.label) ? 'rgba(0,229,255,0.55)' : 'rgba(255,255,255,0.1)'}`,
                        }}
                        title={`${t.style} · holding ${t.holding}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[9px] text-white/55">
                    <label className="flex items-center gap-1.5">Lock timeframe
                      <select value={adaptPrefs.lockedTF ?? ''} onChange={(e) => updateAdapt({ lockedTF: e.target.value || null }, e.target.value ? `timeframe LOCKED to ${e.target.value}` : 'timeframe lock removed')}
                        className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[9px] text-white outline-none" style={{ border: '1px solid rgba(0,229,255,0.3)' }}>
                        <option value="" style={{ backgroundColor: '#0A0F1A' }}>none</option>
                        {ADAPT_TFS.map((t) => <option key={t.label} value={t.label} style={{ backgroundColor: '#0A0F1A' }}>{t.label}</option>)}
                      </select>
                    </label>
                    <label className="flex items-center gap-1.5">Lock mode
                      <select value={adaptPrefs.lockedMode ?? ''} onChange={(e) => updateAdapt({ lockedMode: e.target.value || null }, e.target.value ? `mode LOCKED to ${e.target.value}` : 'mode lock removed')}
                        className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[9px] text-white outline-none" style={{ border: '1px solid rgba(0,229,255,0.3)' }}>
                        <option value="" style={{ backgroundColor: '#0A0F1A' }}>none</option>
                        {[...new Set(ADAPT_TFS.map((t) => t.style))].map((s) => <option key={s} value={s} style={{ backgroundColor: '#0A0F1A' }}>{s}</option>)}
                      </select>
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" checked={adaptPrefs.pause} onChange={(e) => updateAdapt({ pause: e.target.checked }, e.target.checked ? 'adaptation PAUSED — no mode/timeframe switching; risk-protection exits still run' : 'adaptation resumed')} className="accent-[#00E5FF]" />
                      Pause adaptation (risk-protection exits always keep running)
                    </label>
                  </div>
                </div>
                {adaptPrefs.control === 'emil' && (
                  <p className="mt-1.5 text-[9px]" style={{ color: 'rgba(255,213,79,0.75)' }}>
                    EMIL selects instrument, direction, mode, every ladder timeframe, entry, exit and management — bounded by your consent envelope
                    (risk %, base lot {String(autoParams.baseLot)}, daily stops), Shield and the independent Guardian. Consent recorded {adaptPrefs.consentAt ? new Date(adaptPrefs.consentAt).toLocaleString() : '—'}.
                    Switch back to Trader preference any time — it takes effect next cycle.
                  </p>
                )}
                <p className="mt-1.5 text-[8px] leading-relaxed text-white/25">{UNSUPPORTED_TF_NOTE}</p>
                <p className="text-[8px] text-white/25">A mode or timeframe change never changes sizing rules: base lot stays {String(autoParams.baseLot)} and every size is computed from your approved risk — adaptation is never an excuse to trade bigger, hold a failed position, or dodge a valid stop.</p>
              </div>

              {/* ── Mode × Timeframe suitability matrix (§6) ── */}
              {matrixRows.length > 0 && (
                <div className="mt-3 rounded-lg border p-3" style={{ borderColor: 'rgba(0,229,255,0.2)' }}>
                  <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-white/40">
                    Mode × timeframe suitability · {activeSymbol} · live, risk-adjusted — highest-quality wins, not highest raw profit
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-[9px]">
                      <thead>
                        <tr className="text-white/35">
                          <th className="pr-3 font-normal">Mode</th><th className="pr-3 font-normal">TF</th>
                          <th className="pr-3 font-normal">Suitability</th><th className="pr-3 font-normal">Confidence</th>
                          <th className="pr-3 font-normal">Risk</th><th className="font-normal">Expected duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matrixRows.slice(0, 9).map((r, i) => (
                          <tr key={`${r.mode}-${r.tf}`} title={r.note}
                            style={{ color: r.mode === 'No-Trade' ? '#FFB300' : i === 0 ? '#00E5FF' : 'rgba(255,255,255,0.55)' }}>
                            <td className="pr-3">{r.mode}</td>
                            <td className="pr-3">{r.tf}</td>
                            <td className="pr-3">
                              <span className="mr-1 inline-block h-1.5 w-14 rounded bg-white/[0.06] align-middle">
                                <span className="block h-full rounded" style={{ width: `${r.suitability}%`, backgroundColor: r.suitability >= 70 ? '#00C27A' : r.suitability >= 55 ? '#D4E157' : r.suitability >= 40 ? '#FFB300' : 'rgba(255,255,255,0.25)' }} />
                              </span>
                              {r.suitability}%
                            </td>
                            <td className="pr-3">{r.confidence}</td>
                            <td className="pr-3">{r.risk}</td>
                            <td>{r.duration}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {(() => {
                    const top = matrixRows.find((r) => r.mode !== 'No-Trade' && r.suitability > 0);
                    const roles = top ? tfRoles(top.tf) : null;
                    return roles ? (
                      <p className="mt-1.5 text-[8px] text-white/30">
                        Timeframe roles for the top pick ({top!.tf} entry): context {roles.context} · trend {roles.trend} · setup {roles.setup} · confirmation {roles.confirmation} · entry {roles.entry} · management {roles.management} · exit {roles.exit}. Roles shift as the trade evolves — recorded, never rewritten.
                      </p>
                    ) : null;
                  })()}
                  <p className="text-[8px] text-white/25">Updates every 20s from live bars. Range regimes read as observation-only — a range execution model is not built and is never faked.</p>
                </div>
              )}

              {/* ── Live Adaptation Panel (§20): trade identities, never rewritten ── */}
              {(() => {
                const idents = Object.values(loadIdentities()).sort((a, b) => b.firstSeen - a.firstSeen).slice(0, 4);
                if (!idents.length) return null;
                return (
                  <div className="mt-3 rounded-lg border p-3" style={{ borderColor: 'rgba(0,229,255,0.2)' }} data-logtick={logTick}>
                    <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-white/40">Live adaptation — trade identity records (original facts preserved)</div>
                    {idents.map((t) => {
                      const curTf = currentManagedTf(t);
                      const lastChange = t.changes[t.changes.length - 1];
                      return (
                        <div key={t.id} className="mb-1.5 border-b pb-1.5 text-[9px] last:mb-0 last:border-0 last:pb-0" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                          <span className="font-mono font-bold text-white/75">{t.symbol} {t.direction}</span>
                          <span className="text-white/45"> · opened as {t.mode} on {t.tf}{curTf !== t.tf ? ` → now managed on ${curTf}` : ''} · original SL {t.originalStop ?? '—'} · {t.changes.length} change(s){lastChange ? ` · last: ${lastChange.kind} ${new Date(lastChange.ts).toLocaleTimeString()}` : ''}</span>
                          {lastChange && <p className="text-white/35">↳ {lastChange.note}</p>}
                        </div>
                      );
                    })}
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <button onClick={() => updateAdapt({ pause: !adaptPrefs.pause }, adaptPrefs.pause ? 'adaptation resumed' : 'adaptation PAUSED from the live panel')}
                        className="rounded px-2 py-0.5 text-[8px] font-bold transition-all hover:brightness-125" style={{ color: '#00E5FF', border: '1px solid rgba(0,229,255,0.35)' }}>
                        {adaptPrefs.pause ? '▶ Resume adaptation' : '⏸ Pause adaptation'}
                      </button>
                      <button onClick={() => { setAutoParams((p) => { const next = { ...p, smallSteady: true }; saveEmilAutoParams(next); return next; }); emilLog('mode', 'RETURN TO CONSERVATIVE: Small & Steady ON — base lot only, quality bar +10.'); setLogTick((x) => x + 1); }}
                        className="rounded px-2 py-0.5 text-[8px] font-bold transition-all hover:brightness-125" style={{ color: '#9CCC65', border: '1px solid rgba(156,204,101,0.35)' }}>
                        🛡 Return to conservative
                      </button>
                      <button onClick={() => { setSleepNoNew(true); emilLog('mode', 'NO-TRADE MODE: no new entries; existing EMIL positions still managed.'); setLogTick((x) => x + 1); }}
                        className="rounded px-2 py-0.5 text-[8px] font-bold transition-all hover:brightness-125" style={{ color: '#FFB300', border: '1px solid rgba(255,179,0,0.35)' }}>
                        🚫 No-Trade mode
                      </button>
                      <button onClick={() => stopEverything('emergency stop from the adaptation panel')}
                        className="rounded px-2 py-0.5 text-[8px] font-bold transition-all hover:brightness-125" style={{ color: '#FF5252', border: '1px solid rgba(255,82,82,0.4)' }}>
                        ⛔ Emergency stop
                      </button>
                    </div>
                  </div>
                );
              })()}

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

              {/* ── Governance layer: Constitution, objectives, decision safety,
                     budgets, trust ladder, scorecard, shadow, health, replay ── */}
              <EmilGovernance
                builder={builderRef.current}
                council={council}
                prices={prices}
                calendar={calendar}
                autoParams={autoParams}
                mode={mode}
                sleepNoNew={sleepNoNew}
                adaptEmil={adaptPrefs.control === 'emil'}
                closedRows={history as unknown as Array<{ realized_pnl: number | null; closed_at: string | null; comment?: string | null }>}
                openPositions={positions as unknown as Array<{ symbol: string; direction: string; size: number; open_price: number; sl: number | null; comment?: string | null }>}
                logTick={logTick}
                onLog={(t) => { emilLog('mode', t); setLogTick((x) => x + 1); }}
                sarvamOk={sarvamOk === true}
              />

              {/* ── Language & Voice: Sarvam multilingual layer (additive) ── */}
              <EmilLanguagePanel onLog={(t) => { emilLog('mode', t); setLogTick((x) => x + 1); }} />

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
                          const blob = new Blob([JSON.stringify({ learning: loadEmilLearning(), log: loadEmilLog(), tradeIdentities: loadIdentities(), exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
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
            <div className="my-4 w-full max-w-[860px] rounded-xl border p-6 shadow-2xl" style={{ backgroundColor: '#0A0F1A', borderColor: 'rgba(206,147,216,0.5)' }}>
              <div className="mb-2 text-[17px] font-bold text-white">Arm the Autonomous Pilot — your limit envelope</div>
              <p className="mb-3 text-[11px] leading-relaxed text-white/55">
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
                  ['Max profit giveback $ (0=off)', 'maxGiveback', 0, 100000, 25],
                ] as const).map(([label, key, min, max, step]) => (
                  <label key={key} className="text-[10px] text-white/45">{label}
                    <input type="number" min={min} max={max} step={step} value={autoParams[key] as number}
                      onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) setAutoParams((p) => ({ ...p, [key]: Math.max(min, Math.min(max, v)) })); }}
                      className="mt-1 block w-full rounded bg-white/[0.06] px-2 py-1.5 font-mono text-[12px] text-white outline-none" style={{ border: '1px solid rgba(206,147,216,0.3)' }} />
                  </label>
                ))}
              </div>
              <label className="mb-2 flex items-center gap-2 text-[9px] text-white/45">
                Autonomous permission expiry (§19 — autonomy is granted for a period, not forever)
                <select value={autoParams.expiryMode}
                  onChange={(e) => setAutoParams((p) => ({ ...p, expiryMode: e.target.value as EmilAutoParams['expiryMode'] }))}
                  className="rounded bg-white/[0.06] px-1.5 py-1 font-mono text-[9px] text-white outline-none" style={{ border: '1px solid rgba(206,147,216,0.3)' }}>
                  <option value="session" style={{ backgroundColor: '#0A0F1A' }}>This session (default — resets when the console closes)</option>
                  <option value="day" style={{ backgroundColor: '#0A0F1A' }}>One day, then drop to Prepare</option>
                  <option value="week" style={{ backgroundColor: '#0A0F1A' }}>One week, then drop to Prepare</option>
                  <option value="manual" style={{ backgroundColor: '#0A0F1A' }}>Until I turn it off (explicit choice)</option>
                </select>
              </label>
              <p className="mb-2 rounded border px-3 py-2 text-[9px] leading-relaxed" style={{ borderColor: 'rgba(255,179,0,0.3)', backgroundColor: 'rgba(255,179,0,0.05)', color: 'rgba(255,213,120,0.9)' }}>
                {EMIL_DISCLAIMER}
              </p>
              <label className="mb-3 block text-[11px] text-white/60">
                Type <span className="font-mono font-bold text-white">I AUTHORIZE EMIL</span> to arm the pilot:
                <input value={gateTyped} onChange={(e) => setGateTyped(e.target.value)} placeholder="I AUTHORIZE EMIL"
                  className="mt-1.5 block w-full rounded bg-white/[0.06] px-3 py-2 font-mono text-[13px] text-white placeholder:text-white/20 outline-none" style={{ border: '1px solid rgba(206,147,216,0.4)' }} />
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

        {/* ── §24 consent gate: Let EMIL Select Everything ── */}
        {adaptGate && (
          <div className="fixed inset-0 z-[9600] flex items-center justify-center overflow-y-auto p-4" style={{ backgroundColor: 'rgba(3,7,12,0.85)' }} onMouseDown={(e) => { if (e.target === e.currentTarget) setAdaptGate(false); }}>
            <div className="my-4 w-full max-w-[520px] rounded-xl border p-5 shadow-2xl" style={{ backgroundColor: '#0A0F1A', borderColor: 'rgba(255,213,79,0.5)' }}>
              <div className="mb-2 text-[14px] font-bold text-white">Let EMIL Select Everything — read before enabling</div>
              <p className="mb-2 text-[10px] leading-relaxed text-white/55">
                With this authority EMIL independently selects the market, instrument, buy/sell direction, trading mode,
                primary/confirmation/entry/exit timeframes across the full supported ladder, entry type, stop and target
                methods, holding duration, trade management, hedge method and session — every choice still bounded by your
                consent envelope (risk %, base lot, daily stops), the Shield rules and the independent Guardian, which EMIL
                cannot silence. Position size is always computed from approved risk; a mode or timeframe change never
                increases it.
              </p>
              <p className="mb-3 rounded border px-3 py-2 text-[9px] leading-relaxed" style={{ borderColor: 'rgba(255,179,0,0.3)', backgroundColor: 'rgba(255,179,0,0.05)', color: 'rgba(255,213,120,0.9)' }}>
                {ADAPT_DISCLAIMER}
              </p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setAdaptGate(false)} className="rounded px-3 py-2 text-[11px] font-semibold" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.55)' }}>Cancel</button>
                <button
                  onClick={() => {
                    updateAdapt({ control: 'emil', consentAt: Date.now() }, 'CONSENT recorded — authority → LET EMIL SELECT EVERYTHING. Full ladder timeframes and all modes enabled inside the risk envelope; Guardian and Shield remain independent and final.');
                    setAdaptGate(false);
                  }}
                  className="rounded px-4 py-2 text-[11px] font-bold text-black transition-all hover:brightness-110"
                  style={{ background: 'linear-gradient(180deg,#FFD54F,#FFB300)', boxShadow: '0 0 14px rgba(255,213,79,0.5)' }}>
                  I ACCEPT — record consent
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

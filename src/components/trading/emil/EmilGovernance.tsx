'use client';

// EMIL Governance — Constitution, objectives, decision safety, budgets,
// trust ladder, scorecard, shadow stats, health and replay displays.
// Pure display + preference layer over the governance lib: it owns no
// execution and computes everything from real stores and live reads.

import { useEffect, useMemo, useState } from 'react';
import type { OHLCVBuilder } from '@/lib/trading/ohlcv-builder';
import type { NewsEvent } from '@/lib/trading/news-guard';
import { loadEmilLog, type EmilConsensus, type EmilAutoParams } from '@/lib/trading/emil-council';
import {
  EMIL_CONSTITUTION, CONSTITUTION_VERSION, GOVERNING_PRINCIPLE,
  OBJECTIVE_CATALOG, loadObjectives, saveObjectives, objectiveEffects,
  decisionScores, counterfactual, riskBudget, TRUST_LADDER, currentTrustLevel,
  scorecard, loadShadow, resolveShadows, loadReplays, healthChecks,
  type HealthStatus,
} from '@/lib/trading/emil-governance';

const HEALTH_COLORS: Record<HealthStatus, string> = {
  Healthy: '#00C27A', Degraded: '#FFB300', Warning: '#FF8A65', Critical: '#FF5252', Offline: '#8B93A7',
};

interface ClosedRowLite { realized_pnl: number | null; closed_at: string | null; comment?: string | null }
interface OpenPosLite { symbol: string; direction: string; size: number; open_price: number; sl: number | null; comment?: string | null }

export default function EmilGovernance({ builder, council, prices, calendar, autoParams, mode, sleepNoNew, adaptEmil, closedRows, openPositions, logTick, onLog, sarvamOk }: {
  builder: OHLCVBuilder | null;
  council: EmilConsensus | null;
  prices: Record<string, { bid?: number; ask?: number } | undefined>;
  calendar: NewsEvent[];
  autoParams: EmilAutoParams;
  mode: string;
  sleepNoNew: boolean;
  adaptEmil: boolean;
  closedRows: ClosedRowLite[];
  openPositions: OpenPosLite[];
  logTick: number;
  onLog: (text: string) => void;
  sarvamOk?: boolean;
}) {
  const [showConstitution, setShowConstitution] = useState(false);
  const [showReplays, setShowReplays] = useState(false);
  const [objectives, setObjectives] = useState<string[]>(loadObjectives);
  const [shadowStats, setShadowStats] = useState<{ wins: number; losses: number; open: number; expired: number } | null>(null);

  // Shadow resolution sweep — real bars decide, once a minute while open.
  useEffect(() => {
    const run = () => { if (builder) setShadowStats(resolveShadows(builder)); };
    run();
    const id = setInterval(run, 60_000);
    return () => clearInterval(id);
  }, [builder]);

  const emilClosed = useMemo(() => closedRows.filter((r) => String(r.comment ?? '').startsWith('EMIL')), [closedRows]);
  const emilOpen = useMemo(() => openPositions.filter((p) => String(p.comment ?? '').startsWith('EMIL')), [openPositions]);

  const card = useMemo(() => scorecard(emilClosed), [emilClosed]);
  const midnight = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }, []);
  const realizedToday = useMemo(
    () => emilClosed.filter((r) => r.closed_at && new Date(r.closed_at).getTime() >= midnight).reduce((a, r) => a + Number(r.realized_pnl ?? 0), 0),
    [emilClosed, midnight],
  );
  const budget = useMemo(
    () => riskBudget({ dailyLossStop: autoParams.dailyLossStop, realizedToday, openPositions: emilOpen, closedRows: emilClosed }),
    [autoParams.dailyLossStop, realizedToday, emilOpen, emilClosed],
  );

  const scores = useMemo(() => {
    if (!builder || !council) return null;
    try { return decisionScores({ builder, symbol: council.symbol, tick: prices[council.symbol], calendar, council }); } catch { return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [builder, council, calendar]);

  const cf = useMemo(() => (council?.bestOpp ? counterfactual(council.bestOpp, autoParams.autoHedge) : null), [council, autoParams.autoHedge]);

  const trust = currentTrustLevel(mode, sleepNoNew, autoParams.selectAll, adaptEmil);
  const objEff = objectiveEffects(objectives);

  const lastBlocked = useMemo(() => {
    const b = loadEmilLog().filter((e) => e.kind === 'blocked');
    return b.length ? b[b.length - 1].text : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logTick]);
  const health = useMemo(
    () => healthChecks({ prices, calendarCount: calendar.length, notificationPermission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported', lastBlockedText: lastBlocked, sarvamConfigured: sarvamOk }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [calendar.length, lastBlocked, logTick, sarvamOk],
  );

  const replays = loadReplays();
  const shadow = shadowStats ?? { wins: 0, losses: 0, open: 0, expired: 0 };
  const shadowResolved = shadow.wins + shadow.losses;

  const toggleObjective = (o: string) => {
    const next = objectives.includes(o) ? objectives.filter((x) => x !== o) : [...objectives, o];
    setObjectives(next); saveObjectives(next);
    onLog(`objectives → ${next.length ? next.map((x, i) => `${i + 1}.${x}`).join(' ') : 'cleared'}${objectiveEffects(next).notes.length ? ' · effects: ' + objectiveEffects(next).notes.join('; ') : ''}`);
  };
  // Bulk selection: keep the existing priority order, append the rest in
  // catalog order; All off clears the hierarchy entirely.
  const selectAllObjectives = () => {
    const next = [...objectives, ...OBJECTIVE_CATALOG.filter((o) => !objectives.includes(o))];
    setObjectives(next); saveObjectives(next);
    onLog(`objectives → ALL ${next.length} selected — existing priority kept, the rest appended in catalog order${objectiveEffects(next).notes.length ? ' · effects: ' + objectiveEffects(next).notes.join('; ') : ''}`);
  };
  const clearObjectives = () => {
    setObjectives([]); saveObjectives([]);
    onLog('objectives → ALL OFF — hierarchy cleared, the envelope parameters govern alone');
  };

  return (
    <>
      {/* 📜 Constitution + governing principle */}
      <div className="mt-3 rounded-lg border p-3" style={{ borderColor: 'rgba(255,213,79,0.3)' }}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: '#FFD54F' }}>📜 EMIL Constitution · {CONSTITUTION_VERSION}</span>
          <span className="text-[9px] text-white/35">18 rules above every strategy, agent, signal and EA — each mapped to its real enforcement point</span>
          <button onClick={() => setShowConstitution((s) => !s)} className="ml-auto rounded px-2 py-0.5 text-[9px] font-bold transition-all hover:brightness-125" style={{ color: '#FFD54F', border: '1px solid rgba(255,213,79,0.35)' }}>
            {showConstitution ? 'Collapse' : 'Read the 18 rules'}
          </button>
        </div>
        {showConstitution && (
          <div className="mt-2">
            {EMIL_CONSTITUTION.map((r) => (
              <p key={r.n} className="mb-1 text-[9px] leading-relaxed">
                <span className="font-bold text-white/75">{r.n}. {r.rule}</span>{' '}
                <span className="text-white/35">— {r.enforcement}</span>
              </p>
            ))}
          </div>
        )}
        <p className="mt-1.5 text-[9px] italic" style={{ color: 'rgba(255,213,120,0.8)' }}>“{GOVERNING_PRINCIPLE}”</p>
      </div>

      {/* 🎯 Objective hierarchy */}
      <div className="mt-3 rounded-lg border p-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-wide text-white/40">
            Objective hierarchy — click to rank (click order = priority; conflicts resolve top-down: a low-drawdown limit outranks aggressive growth)
          </span>
          <div className="ml-auto flex gap-1.5">
            <button onClick={selectAllObjectives}
              className="rounded px-2 py-0.5 text-[9px] font-bold transition-all hover:brightness-125"
              style={{ color: '#FFD54F', border: '1px solid rgba(255,213,79,0.35)' }}
              title="Select every objective — your current priority order is kept, the rest are appended in catalog order">
              Select all
            </button>
            <button onClick={clearObjectives}
              className="rounded px-2 py-0.5 text-[9px] font-bold text-white/50 transition-colors hover:text-white"
              style={{ border: '1px solid rgba(255,255,255,0.15)' }}
              title="Clear the hierarchy — the envelope parameters govern alone">
              All off
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {OBJECTIVE_CATALOG.map((o) => {
            const rank = objectives.indexOf(o);
            return (
              <button key={o} onClick={() => toggleObjective(o)}
                className="rounded px-1.5 py-0.5 text-[9px] font-bold transition-all"
                style={{
                  backgroundColor: rank >= 0 ? 'rgba(255,213,79,0.18)' : 'rgba(255,255,255,0.04)',
                  color: rank >= 0 ? '#FFD54F' : 'rgba(255,255,255,0.35)',
                  border: `1px solid ${rank >= 0 ? 'rgba(255,213,79,0.5)' : 'rgba(255,255,255,0.1)'}`,
                }}>
                {rank >= 0 ? `${rank + 1}. ` : ''}{o}
              </button>
            );
          })}
        </div>
        {objEff.notes.length > 0 && <p className="mt-1 text-[9px]" style={{ color: '#FFD54F' }}>Active pilot effects: {objEff.notes.join(' · ')}</p>}
        {objectives.length === 0 && <p className="mt-1 text-[8px] text-white/25">No hierarchy set — the envelope parameters govern alone. Top-3 objectives apply deterministic effects (quality bar, frequency cap); the rest are recorded guidance.</p>}
      </div>

      {/* ⚖️ Decision safety: uncertainty budget + counterfactuals */}
      {scores && council && (
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          <div className="rounded-lg border p-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-white/40">⚖️ Uncertainty budget · {council.symbol} — high confidence never overrides extreme uncertainty</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-[10px]">
              {([
                ['Confidence', scores.confidence, scores.confidence >= 65 ? '#00C27A' : '#FFB300'],
                ['Uncertainty', scores.uncertainty, scores.uncertainty >= 60 ? '#FF5252' : scores.uncertainty >= 35 ? '#FFB300' : '#00C27A'],
                ['Data quality', scores.dataQuality, scores.dataQuality >= 70 ? '#00C27A' : '#FFB300'],
                ['Execution quality', scores.executionQuality, scores.executionQuality >= 70 ? '#00C27A' : '#FFB300'],
                ['Regime stability', scores.regimeStability, scores.regimeStability >= 60 ? '#00C27A' : '#FFB300'],
                ['Agent agreement', scores.agentAgreement, scores.agentAgreement >= 50 ? '#00C27A' : '#FFB300'],
              ] as const).map(([label, v, color]) => (
                <span key={label} className="text-white/55">{label}: <span style={{ color }}>{v}</span></span>
              ))}
            </div>
            <p className="mt-1 text-[9px]" style={{ color: scores.uncertainty >= 60 ? '#FF5252' : 'rgba(255,255,255,0.4)' }}>{scores.verdictNote}</p>
            <p className="text-[8px] text-white/25">Execution quality is spread-derived on the sim feed — real fill/slippage statistics arrive with the real LP.</p>
          </div>
          <div className="rounded-lg border p-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-white/40">🧮 Counterfactuals — no trade without a valid adverse-case plan</div>
            {cf ? (
              <>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-[10px]">
                  <span className="text-white/55">Best case: <span style={{ color: '#00C27A' }}>+${cf.best}</span></span>
                  <span className="text-white/55">Base case: <span style={{ color: '#9CCC65' }}>+${cf.base}</span></span>
                  <span className="text-white/55">Adverse: <span style={{ color: '#FF8A65' }}>${cf.adverse}</span></span>
                  <span className="text-white/55">Extreme (gap 2×): <span style={{ color: '#FF5252' }}>${cf.extreme}</span></span>
                </div>
                <p className="mt-1 text-[8px] leading-relaxed text-white/35">
                  Escape: {cf.escape}. Hedge: {cf.hedge}. Emergency: {cf.emergency}. No-response: {cf.noResponse}.
                </p>
              </>
            ) : <p className="text-[9px] text-white/35">No prepared setup right now — counterfactuals attach to the council&apos;s best opportunity when one exists. No setup, no trade: that plan is always valid.</p>}
          </div>
        </div>
      )}

      {/* 💰 Risk budget + 🪜 Trust ladder */}
      <div className="mt-3 grid gap-2 lg:grid-cols-2">
        <div className="rounded-lg border p-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-white/40">💰 Trade risk budget — the daily loss stop is the day&apos;s budget</div>
          {autoParams.dailyLossStop > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-[10px] text-white/55">
                <span>Daily budget: ${budget.budget}</span>
                <span>Realized loss used: ${budget.realizedLoss.toFixed(0)}</span>
                <span>Open risk (at stops): ${budget.openRisk.toFixed(0)}</span>
                <span style={{ color: budget.remaining < budget.budget * 0.25 ? '#FF8A65' : '#00C27A' }}>Remaining: ${Number.isFinite(budget.remaining) ? budget.remaining.toFixed(0) : '—'}</span>
              </div>
              <p className="mt-1 text-[8px] text-white/30">New entries whose stop-loss risk exceeds the remaining budget are rejected. 7d realized: {budget.weekRealized >= 0 ? '+' : ''}${budget.weekRealized} · 30d: {budget.monthRealized >= 0 ? '+' : ''}${budget.monthRealized}.</p>
            </>
          ) : <p className="text-[9px] text-white/35">Daily loss stop is 0 — set it in the pilot gate to activate budget tracking and the budget rejection gate.</p>}
          {autoParams.maxGiveback > 0 && <p className="mt-1 text-[9px]" style={{ color: '#00E5A0' }}>Profit-decay protection armed: max ${autoParams.maxGiveback} of the day&apos;s peak may be given back before new entries pause.</p>}
        </div>
        <div className="rounded-lg border p-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-white/40">🪜 Trust ladder — autonomy is granted, never assumed</div>
          {TRUST_LADDER.map((l) => (
            <p key={l.level} className="text-[9px] leading-relaxed" style={{ color: l.level === trust ? '#FFD54F' : 'rgba(255,255,255,0.35)' }}>
              {l.level === trust ? '▶ ' : ''}L{l.level} {l.name} — {l.desc}
            </p>
          ))}
          <p className="mt-1 text-[8px] text-white/25">Current level follows your mode + universe + adaptation authority. Autonomous permission expiry: {autoParams.expiryMode} (set in the gate). Progression is your call, informed by the scorecard below.</p>
        </div>
      </div>

      {/* 📊 Scorecard + 🕶 Shadow decisions */}
      <div className="mt-3 grid gap-2 lg:grid-cols-2">
        <div className="rounded-lg border p-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-white/40">📊 Performance scorecard — no hidden criteria, no self-grading</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-[10px] text-white/55">
            <span>Closed EMIL trades: {card.trades}</span>
            <span>Net: <span style={{ color: card.net >= 0 ? '#00C27A' : '#FF5252' }}>{card.net >= 0 ? '+' : ''}${card.net}</span></span>
            <span>Win rate: {card.winRate != null ? `${card.winRate}%` : '—'}</span>
            <span>Profit factor: {card.profitFactor ?? '—'}</span>
            <span>Max closed-curve DD: ${card.maxDrawdown}</span>
            <span>Trader overrides: {loadEmilLog().filter((e) => e.text.includes('override')).length}</span>
          </div>
          {card.unmeasured.length > 0 && <p className="mt-1 text-[8px] text-white/30">Not yet measurable (honestly): {card.unmeasured.join(' · ')}.</p>}
        </div>
        <div className="rounded-lg border p-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-white/40">🕶 Shadow decisions — do EMIL&apos;s rejections actually help?</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-[10px] text-white/55">
            <span>Shadow setups tracked: {loadShadow().length}</span>
            <span>Resolved: {shadowResolved}</span>
            <span>Would-have-won: {shadow.wins}</span>
            <span>Would-have-lost: {shadow.losses}</span>
            <span>Still open: {shadow.open}</span>
            <span>Expired (48h): {shadow.expired}</span>
          </div>
          <p className="mt-1 text-[8px] text-white/30">
            Skipped/runner-up setups are tracked against real bars afterwards (stop-first = loss, conservative on ambiguous bars).
            {shadowResolved >= 10 ? ` Rejections look ${shadow.losses >= shadow.wins ? 'justified — most rejected setups would have lost or done no better' : 'costly — several rejected setups would have won; review the quality bars'}.` : ' Verdicts need ≥10 resolved samples — patience over false precision.'}
          </p>
        </div>
      </div>

      {/* 🩺 Health panel */}
      <div className="mt-3 rounded-lg border p-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-white/40">🩺 System health — fail-safe: any Critical component blocks new entries by the existing gates</div>
        <div className="flex flex-wrap gap-1.5">
          {health.map((h) => (
            <span key={h.name} className="rounded px-1.5 py-0.5 text-[9px]" title={h.note}
              style={{ border: `1px solid ${HEALTH_COLORS[h.status]}55`, color: HEALTH_COLORS[h.status], backgroundColor: `${HEALTH_COLORS[h.status]}10` }}>
              {h.name}: {h.status}
            </span>
          ))}
        </div>
      </div>

      {/* 🎞 Decision replay */}
      {replays.length > 0 && (
        <div className="mt-3 rounded-lg border p-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold uppercase tracking-wide text-white/40">🎞 Decision replay — flight recorder ({replays.length} records)</span>
            <button onClick={() => setShowReplays((s) => !s)} className="ml-auto rounded px-2 py-0.5 text-[9px] font-bold text-white/50 transition-colors hover:text-white" style={{ border: '1px solid rgba(255,255,255,0.15)' }}>
              {showReplays ? 'Collapse' : 'Replay last 3'}
            </button>
          </div>
          {showReplays && replays.slice(-3).reverse().map((r) => (
            <div key={r.ts} className="mt-1.5 border-t pt-1.5 text-[9px] text-white/45" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              <p className="font-mono font-bold text-white/70">{new Date(r.ts).toLocaleString()} · {r.direction} {r.symbol} @ {r.price} · {r.mode}</p>
              <p>Sessions open: {r.sessionOpen.join('/') || 'none'} · next news: {r.nextNews ?? 'none inside 24h'} · conf {r.scores.confidence} / unc {r.scores.uncertainty} / data {r.scores.dataQuality}</p>
              <p>Council: {r.votes.map((v) => `${v.agent} ${v.stance}(${v.confidence})`).join(' · ')}</p>
              <p>Checks: {r.riskChecks.join(' · ')} · alternatives considered: {r.alternatives.length ? r.alternatives.join(' · ') : 'none qualified'}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

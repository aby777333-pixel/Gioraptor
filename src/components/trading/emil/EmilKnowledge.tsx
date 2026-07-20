'use client';

// EMIL Always Learning — the Autonomous Global Trading Knowledge console.
// Owns the 30-second learning sweep (spread profiles, correlation edges,
// event-reaction measurement, forecast scoring, freshness expiry) over the
// sources the platform GENUINELY has. Everything displayed is measured and
// versioned; unconnected source categories say so; and nothing here can
// reach live trading except through the Knowledge-to-Trading Firewall.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { OHLCVBuilder } from '@/lib/trading/ohlcv-builder';
import type { NewsEvent } from '@/lib/trading/news-guard';
import { fmtEta } from '@/lib/trading/news-guard';
import { classifyMarketState } from '@/lib/nexus/market-state';
import { forecastScenarios } from '@/lib/trading/emil-macro';
import { loadEmilLearning } from '@/lib/trading/emil-council';
import {
  loadKnowPrefs, saveKnowPrefs, allLearningOn, allLearningOff, KNOWLEDGE_DISCLAIMER,
  sourceRegistry, FIREWALL_GATES, loadKnowledge, upsertFact, expireStaleFacts,
  sampleSpreads, loadSpreadProfiles, updateCorrelationEdges, measureEventReactions,
  preEventBriefing, snapshotForecast, scoreDueForecasts, calibrationSummary,
  buildAutoWatchlists, learningPriorities, learningHealth, recordSweep, dailySummary,
  type KnowPrefs, type AutoWatchlist, type LearningTask, type EventBriefing,
} from '@/lib/trading/emil-knowledge';

const PRIO_COLOR: Record<string, string> = {
  Critical: '#FF5252', Urgent: '#FF8A65', Important: '#FFB300', Useful: '#D4E157', Background: '#8B93A7',
};

export default function EmilKnowledge({ builder, prices, calendar, openSymbols, sarvamOk, onLog }: {
  builder: OHLCVBuilder | null;
  prices: Record<string, { bid?: number; ask?: number } | undefined>;
  calendar: NewsEvent[];
  openSymbols: string[];
  sarvamOk: boolean;
  onLog: (text: string) => void;
}) {
  const [prefs, setPrefs] = useState<KnowPrefs>(loadKnowPrefs);
  const [gate, setGate] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [showFirewall, setShowFirewall] = useState(false);
  const [showFeed, setShowFeed] = useState(false);
  const [sweepTick, setSweepTick] = useState(0);
  const [briefing, setBriefing] = useState<EventBriefing | null>(null);
  const [watchlists, setWatchlists] = useState<AutoWatchlist[]>([]);
  const [tasks, setTasks] = useState<LearningTask[]>([]);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const builderRef = useRef(builder);
  builderRef.current = builder;
  const pricesRef = useRef(prices);
  pricesRef.current = prices;
  const calRef = useRef(calendar);
  calRef.current = calendar;
  const openRef = useRef(openSymbols);
  openRef.current = openSymbols;

  const update = useCallback((next: KnowPrefs, readback: string) => {
    setPrefs(next); saveKnowPrefs(next);
    onLog(`LEARNING: ${readback}`);
  }, [onLog]);

  // ── The learning sweep: every 30s while a console is open ──
  useEffect(() => {
    const sweep = () => {
      const p = prefsRef.current;
      const b = builderRef.current;
      if (!p.enabled || !b) return;
      try {
        const px = pricesRef.current;
        const cal = calRef.current;
        const universe = Object.keys(px).filter((s) => px[s]?.bid != null);
        const notable: string[] = [];

        // §26 execution behaviour: spread samples per symbol × session.
        sampleSpreads(px);

        // §9 correlation edges + breakdown alerts (open symbols + majors).
        const watchSet = [...new Set([...openRef.current, ...universe])].slice(0, 8);
        const corr = updateCorrelationEdges(b, watchSet);
        notable.push(...corr.learned.slice(0, 1));
        if (p.materialAlerts) for (const alert of corr.breakdowns.slice(0, 1)) {
          onLog(`MATERIAL CHANGE: ${alert}. No automatic action outside your approved management rules.`);
        }

        // §22 measure real event reactions once releases pass.
        notable.push(...measureEventReactions(b, cal, universe).slice(0, 1));

        // §23 forecast snapshots (rotating symbols) + honest scoring.
        const rot = universe[(Math.floor(Date.now() / 30_000)) % Math.max(1, universe.length)];
        if (rot) {
          const f = forecastScenarios(b, rot, px[rot], cal);
          if (f && f.scenarios.length) snapshotForecast(rot, f.scenarios[0].name, f.scenarios[0].probability, px[rot]?.bid ?? 0);
        }
        notable.push(...scoreDueForecasts(px).slice(0, 1));

        // §regime facts for open-position symbols (session-level knowledge).
        for (const sym of openRef.current.slice(0, 3)) {
          const st = classifyMarketState(b.getAllBars(sym, '60'));
          if (st) upsertFact({
            id: `regime:${sym}`, kind: 'measurement', level: 'session', subject: `${sym} regime`,
            statement: `${st.state} (confidence ${st.confidence}%) · ${st.volatility}`,
            evidence: 'live H1 classifier', confidence: st.confidence,
            freshUntil: Date.now() + 2 * 3_600_000, reason: 'regime re-read',
          });
        }

        // §18 freshness expiry — outdated knowledge never stays active.
        const expired = expireStaleFacts();
        if (expired > 0) notable.push(`${expired} stale fact(s) expired — outdated knowledge retired, history kept`);

        // Derived boards.
        setBriefing(preEventBriefing(cal, universe));
        setWatchlists(p.autoWatchlists ? buildAutoWatchlists(cal, universe) : []);
        setTasks(learningPriorities({
          calendar: cal, universe,
          benchedCount: loadEmilLearning().filter((l) => l.avoided).length,
          calib: calibrationSummary(), openSymbols: openRef.current,
        }));
        recordSweep();
        setSweepTick((t) => t + 1);
        for (const n of notable.filter(Boolean).slice(0, 2)) onLog(`learned: ${n}`);
      } catch { /* learning must never break the console */ }
    };
    sweep();
    const id = setInterval(sweep, 30_000);
    return () => clearInterval(id);
  }, [onLog]);

  const sources = useMemo(
    () => sourceRegistry(sarvamOk, calendar.length, Object.keys(prices).filter((s) => prices[s]?.bid != null).length),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sarvamOk, calendar.length, sweepTick],
  );
  const health = useMemo(() => learningHealth(prefs.enabled, sources), [prefs.enabled, sources]);
  const calib = useMemo(() => calibrationSummary(), [sweepTick]); // eslint-disable-line react-hooks/exhaustive-deps
  const facts = useMemo(() => loadKnowledge().filter((f) => f.status === 'active').sort((a, b) => b.lastVerified - a.lastVerified), [sweepTick]); // eslint-disable-line react-hooks/exhaustive-deps
  const spreads = useMemo(() => loadSpreadProfiles(), [sweepTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (key: keyof KnowPrefs, label: string) => (
    <label key={key} className="flex items-center gap-1.5">
      <input type="checkbox" checked={prefs[key] as boolean}
        onChange={(e) => update({ ...prefs, [key]: e.target.checked }, `${label} ${e.target.checked ? 'ON' : 'OFF'}`)} className="accent-[#4DD0E1]" />
      {label}
    </label>
  );

  return (
    <div className="mt-3 rounded-lg border p-3" style={{ borderColor: 'rgba(77,208,225,0.3)' }}>
      {/* Header + master controls */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: '#4DD0E1' }}>
          🌍 EMIL Always Learning — autonomous global knowledge engine
        </span>
        <span className="rounded px-1.5 py-0.5 font-mono text-[8px] font-bold"
          style={{ color: prefs.enabled ? '#00C27A' : '#8B93A7', border: `1px solid ${prefs.enabled ? '#00C27A' : '#8B93A7'}55` }}>
          {health.status} · {health.facts} active facts ({health.freshPct}% fresh) · {health.sourcesConnected} sources connected · {health.storageKB}KB
        </span>
        <div className="ml-auto flex gap-1.5">
          <button onClick={() => {
            if (!prefs.enabled && !prefs.consentAt) { setGate(true); return; }
            update({ ...prefs, enabled: !prefs.enabled }, prefs.enabled ? 'Always Learning PAUSED — nothing collected while paused' : 'Always Learning resumed');
          }}
            className="rounded px-2.5 py-1 text-[10px] font-bold transition-all hover:brightness-125"
            style={{
              backgroundColor: prefs.enabled ? 'rgba(0,194,122,0.15)' : 'rgba(255,255,255,0.04)',
              color: prefs.enabled ? '#00C27A' : 'rgba(255,255,255,0.4)',
              border: `1px solid ${prefs.enabled ? 'rgba(0,194,122,0.5)' : 'rgba(255,255,255,0.15)'}`,
            }}>
            {prefs.enabled ? '● Always Learning ON' : 'Always Learning OFF'}
          </button>
          <button onClick={() => { if (!prefs.consentAt) { setGate(true); return; } update(allLearningOn(prefs), 'ALL learning switches ON'); }}
            className="rounded px-2 py-1 text-[9px] font-bold text-white/50 transition-colors hover:text-white" style={{ border: '1px solid rgba(255,255,255,0.15)' }}>All on</button>
          <button onClick={() => update(allLearningOff(prefs), 'ALL learning switches OFF — collection stopped')}
            className="rounded px-2 py-1 text-[9px] font-bold text-white/50 transition-colors hover:text-white" style={{ border: '1px solid rgba(255,255,255,0.15)' }}>All off</button>
        </div>
      </div>

      {/* Sub-toggles (§38) */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] text-white/55">
        {toggle('learnTrades', 'Learn from my trades')}
        {toggle('learnOverrides', 'Learn from my overrides')}
        {toggle('summaries', 'Learning summaries')}
        {toggle('materialAlerts', 'Material-change alerts')}
        {toggle('autoWatchlists', 'Auto watchlists')}
        <button onClick={() => {
          const blob = new Blob([JSON.stringify({ knowledge: loadKnowledge(), spreads: loadSpreadProfiles(), calibration: calib, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
          a.download = `emil-global-knowledge-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(a.href);
        }} className="rounded px-2 py-0.5 text-[8px] font-bold text-white/45 transition-colors hover:text-white" style={{ border: '1px solid rgba(255,255,255,0.12)' }}>Export</button>
        <button onClick={() => {
          if (!window.confirm('Delete EMIL’s learned global knowledge (facts, spread profiles, event memory, calibration)? This cannot be undone.')) return;
          for (const k of ['raptor_emil_know_v1', 'raptor_emil_spreads_v1', 'raptor_emil_eventmem_v1', 'raptor_emil_calib_v1', 'raptor_emil_eventseen_v1']) { try { localStorage.removeItem(k); } catch { /* ignore */ } }
          onLog('LEARNING: knowledge base DELETED by trader — EMIL starts observing fresh.');
          setSweepTick((t) => t + 1);
        }} className="rounded px-2 py-0.5 text-[8px] font-bold transition-colors hover:brightness-125" style={{ color: '#FF8A65', border: '1px solid rgba(255,138,101,0.3)' }}>Delete history</button>
      </div>

      {/* §21 Pre-event briefing */}
      {prefs.enabled && briefing && (
        <div className="mt-2 rounded border p-2" style={{ borderColor: 'rgba(255,179,0,0.3)', backgroundColor: 'rgba(255,179,0,0.04)' }}>
          <p className="text-[9px] font-bold" style={{ color: '#FFB300' }}>
            📋 Pre-event briefing (unprompted): {briefing.ev.currency} “{briefing.ev.title}” {fmtEta(briefing.ev.timeMs)}
          </p>
          <p className="text-[9px] text-white/50">Affected: {briefing.affectedSymbols.join(' · ') || 'none in the universe'} · {briefing.history}. Plan: {briefing.plan}.</p>
        </div>
      )}

      {/* §20 Auto watchlists */}
      {prefs.enabled && watchlists.length > 0 && (
        <div className="mt-2">
          {watchlists.map((w) => (
            <p key={w.id} className="text-[9px] text-white/50">
              🗂 <b className="text-white/70">Auto watchlist:</b> {w.reason} → {w.symbols.join(', ')} · {w.risk} · expires {new Date(w.expiresAt).toLocaleString()}
            </p>
          ))}
        </div>
      )}

      {/* §16/§17 Learning priorities */}
      {prefs.enabled && tasks.length > 0 && (
        <div className="mt-2">
          <span className="text-[8px] font-bold uppercase tracking-wide text-white/35">Self-directed curriculum (real gaps, ranked): </span>
          {tasks.slice(0, 4).map((t, i) => (
            <p key={i} className="text-[9px]" style={{ color: PRIO_COLOR[t.priority] }}>▸ [{t.priority}] <span className="text-white/50">{t.task}</span></p>
          ))}
        </div>
      )}

      {/* §23 calibration + §26 spreads */}
      {prefs.enabled && (
        <div className="mt-2 grid gap-2 lg:grid-cols-2">
          <div className="rounded border p-2 text-[9px] text-white/50" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <b className="text-white/65">🎯 Forecast calibration (honest self-scoring):</b> {calib.scored} scored · {calib.right} right / {calib.wrong} wrong / {calib.flat} flat. {calib.note}
          </div>
          <div className="rounded border p-2 text-[9px] text-white/50" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <b className="text-white/65">📏 Execution knowledge (measured spreads by session):</b>{' '}
            {Object.keys(spreads).length
              ? Object.entries(spreads).slice(0, 4).map(([sym, cells]) => `${sym}: ${Object.entries(cells).map(([b, c]) => `${b} ${c.median}p`).join(' ')}`).join(' · ')
              : 'sampling in progress — profiles appear as sessions are observed'}
          </div>
        </div>
      )}

      {/* Collapsible: knowledge feed / sources / firewall */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button onClick={() => setShowFeed((s) => !s)} className="rounded px-2 py-0.5 text-[9px] font-bold text-white/50 transition-colors hover:text-white" style={{ border: '1px solid rgba(255,255,255,0.15)' }}>
          {showFeed ? 'Hide' : 'Knowledge graph & feed'} ({facts.length})
        </button>
        <button onClick={() => setShowSources((s) => !s)} className="rounded px-2 py-0.5 text-[9px] font-bold text-white/50 transition-colors hover:text-white" style={{ border: '1px solid rgba(255,255,255,0.15)' }}>
          {showSources ? 'Hide' : 'Source connectors'} ({sources.filter((s) => s.status === 'Connected').length}/{sources.length})
        </button>
        <button onClick={() => setShowFirewall((s) => !s)} className="rounded px-2 py-0.5 text-[9px] font-bold transition-all hover:brightness-125" style={{ color: '#FF8A65', border: '1px solid rgba(255,138,101,0.35)' }}>
          {showFirewall ? 'Hide' : '🧱 Knowledge-to-Trading Firewall'}
        </button>
        {prefs.summaries && prefs.enabled && (
          <button onClick={() => onLog(`DAILY LEARNING SUMMARY — ${dailySummary()}`)}
            className="rounded px-2 py-0.5 text-[9px] font-bold transition-all hover:brightness-125" style={{ color: '#4DD0E1', border: '1px solid rgba(77,208,225,0.35)' }}>
            Generate summary now
          </button>
        )}
      </div>

      {showFeed && (
        <div className="mt-2 max-h-56 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          {facts.slice(0, 20).map((f) => (
            <p key={f.id} className="mb-1 text-[9px] leading-relaxed">
              <span className="rounded px-1 py-0.5 font-mono text-[7px] font-bold uppercase" style={{ border: '1px solid rgba(77,208,225,0.4)', color: '#4DD0E1' }}>{f.kind}</span>{' '}
              <b className="text-white/70">{f.subject}:</b> <span className="text-white/50">{f.statement}</span>{' '}
              <span className="text-white/30">· conf {f.confidence} · {f.evidence} · verified {new Date(f.lastVerified).toLocaleTimeString()}{f.history.length ? ` · ${f.history.length} prior version(s) kept` : ''}</span>
            </p>
          ))}
          {!facts.length && <p className="text-[9px] text-white/35">No facts yet — enable Always Learning and knowledge accumulates from live measurement.</p>}
        </div>
      )}

      {showSources && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left font-mono text-[8px] text-white/50">
            <thead><tr className="text-white/30"><th className="pr-2 font-normal">Source</th><th className="pr-2 font-normal">Category</th><th className="pr-2 font-normal">Reliability</th><th className="pr-2 font-normal">Status</th><th className="font-normal">Note</th></tr></thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.name}>
                  <td className="pr-2 text-white/65">{s.name}</td><td className="pr-2">{s.category}</td><td className="pr-2">{s.reliability}</td>
                  <td className="pr-2" style={{ color: s.status === 'Connected' ? '#00C27A' : s.status === 'Degraded' ? '#FFB300' : '#8B93A7' }}>{s.status}</td>
                  <td>{s.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[8px] text-white/25">Unconnected categories are framework slots awaiting licensed sources — EMIL never simulates a feed it does not have. Rumour-class sources, if ever connected, are monitored for sentiment only and never treated as fact.</p>
        </div>
      )}

      {showFirewall && (
        <div className="mt-2">
          {FIREWALL_GATES.map((g) => (
            <p key={g.gate} className="text-[9px] leading-relaxed"><b className="text-white/65">{g.gate}</b> <span className="text-white/40">— {g.enforcement}</span></p>
          ))}
          <p className="mt-1 text-[8px]" style={{ color: '#FF8A65' }}>
            No headline, translation, research output, learned relationship or AI conclusion can bypass these gates. Learning may only ever
            suggest, alert, or REDUCE risk — risk-raising changes always require your explicit action.
          </p>
        </div>
      )}

      <p className="mt-2 text-[8px] leading-relaxed text-white/25">
        Sweeps run every 30s while an EMIL console/window is open; tick-level data is absorbed continuously through the bar builders.
        Every fact carries its evidence, confidence, freshness window and version history; conflicts supersede with the prior version kept (§29).
        Server-side 24/7 learning is a future phase — not claimed before it exists.
      </p>

      {/* §40 consent gate */}
      {gate && (
        <div className="fixed inset-0 z-[9600] flex items-center justify-center overflow-y-auto p-4" style={{ backgroundColor: 'rgba(3,7,12,0.85)' }} onMouseDown={(e) => { if (e.target === e.currentTarget) setGate(false); }}>
          <div className="my-4 w-full max-w-[560px] rounded-xl border p-5 shadow-2xl" style={{ backgroundColor: '#0A0F1A', borderColor: 'rgba(77,208,225,0.5)' }}>
            <div className="mb-2 text-[15px] font-bold text-white">Enable EMIL Always Learning</div>
            <p className="mb-2 text-[10px] leading-relaxed text-white/55">
              EMIL will continuously measure and learn from the platform’s connected sources: live pricing (spread profiles,
              correlation edges, regimes), the real economic calendar (event-reaction memory, pre-event briefings, auto
              watchlists), and its own trade/veto/forecast history (calibration, no-trade review). Unconnected source
              categories stay visible as honest gaps. All knowledge is versioned, expiring, exportable and deletable — and
              firewalled from live trading.
            </p>
            <p className="mb-3 rounded border px-3 py-2 text-[9px] leading-relaxed" style={{ borderColor: 'rgba(255,179,0,0.3)', backgroundColor: 'rgba(255,179,0,0.05)', color: 'rgba(255,213,120,0.9)' }}>
              {KNOWLEDGE_DISCLAIMER}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setGate(false)} className="rounded px-3 py-2 text-[11px] font-semibold" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.55)' }}>Cancel</button>
              <button onClick={() => { update({ ...allLearningOn(prefs), consentAt: Date.now() }, 'ALWAYS LEARNING enabled with consent — sweeps every 30s over connected sources; firewall between knowledge and live trading stands.'); setGate(false); }}
                className="rounded px-4 py-2 text-[11px] font-bold text-black transition-all hover:brightness-110"
                style={{ background: 'linear-gradient(180deg,#4DD0E1,#00ACC1)', boxShadow: '0 0 14px rgba(77,208,225,0.5)' }}>
                I ACCEPT — start learning
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

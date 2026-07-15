'use client';

// Chart source switcher: TradingView live data (default) ⇄ native RAPTOR
// chart. Also the single owner of the EA attach lifecycle so Expert
// Advisors can be added to EITHER chart:
//  - drops on the RAPTOR chart bubble up to this wrapper
//  - on the TradingView tab a transparent overlay catches the drop
//    (the cross-origin iframe would otherwise swallow drag events)
//  - an EAs/Robots menu is shown in the tab bar on the TradingView tab
//    (the RAPTOR tab keeps its own menu inside ChartToolbar)
// Attached EAs persist to ea_instances and render as chips on both tabs.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, ChevronDown, GripVertical, Star } from 'lucide-react';
import ChartPanel from './ChartPanel';
import TradingViewPanel from './TradingViewPanel';
import { EA_LIBRARY, type EAConfig } from './ChartToolbar';
import { useTradingStore } from '@/stores/trading';
import { createClient } from '@/lib/supabase/client';
import { EARuntime, type EAStats } from '@/lib/trading/ea-engine';
import type { OHLCVBuilder } from '@/lib/trading/ohlcv-builder';
import type { Resolution } from '@/lib/trading/ohlcv-builder';

type ChartSource = 'tradingview' | 'raptor';

interface AttachedEA {
  instanceId: string | null;
  strategyId: string;
  name: string;
  symbol: string;
}

export default function ChartSourceSwitcher({
  ohlcvBuilder,
  isLiveData = false,
  onSourceChange,
}: {
  ohlcvBuilder: OHLCVBuilder | null;
  isLiveData?: boolean;
  onSourceChange?: (source: 'tradingview' | 'raptor') => void;
}) {
  const [source, setSource] = useState<ChartSource>('tradingview');
  const { activeSymbol, prices, activeAccountId, triggerRefresh } = useTradingStore();

  useEffect(() => {
    onSourceChange?.(source);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  // ── EA attach lifecycle ─────────────────────────
  const [attachedEAs, setAttachedEAs] = useState<AttachedEA[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [eaMenuOpen, setEaMenuOpen] = useState(false);
  const [eaStats, setEaStats] = useState<Record<string, EAStats>>({});
  const eaMenuRef = useRef<HTMLDivElement>(null);

  // ── EA runtime: strategies evaluate on platform bars and trade
  //    through place_market_order, regardless of which chart is shown ──
  const ohlcvRef = useRef<OHLCVBuilder | null>(ohlcvBuilder);
  ohlcvRef.current = ohlcvBuilder;
  const pricesRef = useRef(prices);
  pricesRef.current = prices;
  const accountRef = useRef(activeAccountId);
  accountRef.current = activeAccountId;

  const runtimeRef = useRef<EARuntime | null>(null);
  if (!runtimeRef.current) {
    runtimeRef.current = new EARuntime({
      getBars: (symbol: string, resolution: Resolution) =>
        ohlcvRef.current ? ohlcvRef.current.getAllBars(symbol, resolution) : [],
      getTick: (symbol: string) => {
        const t = pricesRef.current[symbol];
        return t ? { bid: t.bid, ask: t.ask } : undefined;
      },
      getAccountId: () => accountRef.current ?? null,
      onStats: (key, stats) => setEaStats((prev) => ({ ...prev, [key]: stats })),
      onRefresh: () => triggerRefresh(),
    });
  }

  // Keep runtime instances in sync with the attached EA list.
  useEffect(() => {
    const runtime = runtimeRef.current!;
    const wanted = new Map(attachedEAs.map((a) => [`${a.strategyId}-${a.symbol}`, a]));
    for (const [key, a] of wanted) {
      if (!runtime.has(key)) {
        const lib = EA_LIBRARY.find((e) => e.id === a.strategyId);
        runtime.attach(key, a.strategyId, a.name, a.symbol, lib?.timeframes ?? ['15m']);
      }
    }
    // Detach removed instances (position stays open for the trader to manage).
    for (const key of runtime.keys()) {
      if (!wanted.has(key)) runtime.detach(key);
    }
  }, [attachedEAs]);

  // Evaluate on every price tick (bar-close gated inside the runtime).
  useEffect(() => {
    runtimeRef.current?.onTick();
  }, [prices]);

  useEffect(() => () => runtimeRef.current?.detachAll(), []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('ea_instances')
          .select('id, strategy_id, name, parameters, status')
          .eq('status', 'running');
        if (active && data) {
          setAttachedEAs(
            data.map((r) => ({
              instanceId: r.id as string,
              strategyId: r.strategy_id as string,
              name: (r.name as string) ?? 'EA',
              symbol: ((r.parameters as Record<string, unknown> | null)?.symbol as string) ?? '',
            }))
          );
        }
      } catch { /* signed-out — chart still works, attachments stay local */ }
    })();
    return () => { active = false; };
  }, []);

  // Close the TV-tab EA menu on outside click.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (eaMenuRef.current && !eaMenuRef.current.contains(e.target as Node)) setEaMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // Clear the drop overlay whenever any drag session ends.
  useEffect(() => {
    const clear = () => setDragActive(false);
    window.addEventListener('dragend', clear);
    window.addEventListener('drop', clear);
    return () => {
      window.removeEventListener('dragend', clear);
      window.removeEventListener('drop', clear);
    };
  }, []);

  const showEAToast = useCallback((text: string) => {
    const div = document.createElement('div');
    div.className = 'fixed top-20 right-4 z-[9999] px-4 py-3 rounded-lg text-sm font-semibold';
    div.style.cssText = 'background:#0091D5;color:#fff;box-shadow:0 8px 32px rgba(0,0,0,0.4)';
    div.textContent = text;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
  }, []);

  const attachInFlightRef = useRef<Set<string>>(new Set());

  const attachEA = useCallback(async (ea: { id?: string; name?: string; pairs?: string[]; timeframes?: string[] }) => {
    if (!ea?.name || !ea?.id) return;
    const key = `${ea.id}-${activeSymbol}`;
    if (attachInFlightRef.current.has(key)) return;
    if (attachedEAs.some((a) => a.strategyId === ea.id && a.symbol === activeSymbol)) {
      showEAToast(`EA "${ea.name}" is already running on ${activeSymbol}`);
      return;
    }
    attachInFlightRef.current.add(key);
    setTimeout(() => attachInFlightRef.current.delete(key), 3000);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('no session');
      const { data: accts } = await supabase
        .from('trading_accounts')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1);
      const accountId = accts?.[0]?.id as string | undefined;
      if (!accountId) throw new Error('no account');
      const { data: inst, error } = await supabase
        .from('ea_instances')
        .insert({
          account_id: accountId,
          strategy_id: ea.id,
          name: ea.name,
          parameters: { symbol: activeSymbol, pairs: ea.pairs ?? [], timeframes: ea.timeframes ?? [] },
          status: 'running',
          mode: 'live',
        })
        .select('id')
        .single();
      if (error) throw error;
      setAttachedEAs((prev) => [...prev, { instanceId: inst.id as string, strategyId: ea.id!, name: ea.name!, symbol: activeSymbol }]);
      showEAToast(`EA "${ea.name}" attached to ${activeSymbol} — running`);
    } catch {
      // Signed-out / no account: keep the attachment local so the UI still works.
      setAttachedEAs((prev) => [...prev, { instanceId: null, strategyId: ea.id!, name: ea.name!, symbol: activeSymbol }]);
      showEAToast(`EA "${ea.name}" attached to ${activeSymbol}`);
    }
  }, [attachedEAs, activeSymbol, showEAToast]);

  const handleEADrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    let ea: { id?: string; name?: string; pairs?: string[]; timeframes?: string[] };
    try { ea = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { return; }
    void attachEA(ea);
  }, [attachEA]);

  const detachEA = useCallback(async (a: AttachedEA) => {
    setAttachedEAs((prev) => prev.filter((x) => !(x.strategyId === a.strategyId && x.symbol === a.symbol)));
    if (a.instanceId) {
      try { await createClient().from('ea_instances').delete().eq('id', a.instanceId); } catch { /* noop */ }
    }
  }, []);

  const symbolEAs = attachedEAs.filter((a) => a.symbol === activeSymbol);

  return (
    <div
      className="flex h-full w-full flex-col"
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDragEnter={() => setDragActive(true)}
      onDrop={handleEADrop}
    >
      {/* Source tabs + TV-tab EA menu */}
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

        {source === 'tradingview' && (
          <div className="relative ml-auto" ref={eaMenuRef}>
            <button
              onClick={() => setEaMenuOpen(!eaMenuOpen)}
              className="flex items-center gap-1 rounded px-2.5 py-1 font-mono text-[11px] transition-colors"
              style={{
                backgroundColor: eaMenuOpen ? 'rgba(41,171,226,0.15)' : 'transparent',
                color: eaMenuOpen ? '#0091D5' : 'rgba(255,255,255,0.45)',
              }}
            >
              <Bot size={12} /> EAs / Robots <ChevronDown size={10} />
            </button>
            {eaMenuOpen && (
              <div
                className="absolute right-0 top-full z-50 mt-1 w-[340px] overflow-y-auto rounded-lg border shadow-2xl"
                style={{ maxHeight: 420, backgroundColor: '#0A0F1A', borderColor: 'rgba(255,255,255,0.08)' }}
              >
                <div className="border-b px-3 py-2" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <span className="text-[10px] text-white/40">
                    Drag onto the chart or click Attach — runs on {activeSymbol}
                  </span>
                </div>
                {EA_LIBRARY.map((ea: EAConfig) => (
                  <div
                    key={ea.id}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData('text/plain', JSON.stringify(ea)); e.dataTransfer.effectAllowed = 'copy'; }}
                    className="flex items-start gap-2 border-b px-3 py-2 hover:bg-white/[0.03]"
                    style={{ borderColor: 'rgba(255,255,255,0.04)', cursor: 'grab' }}
                  >
                    <GripVertical size={12} className="mt-0.5 shrink-0 text-white/20" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[11px] font-bold text-white">{ea.name}</span>
                        <span className="flex items-center gap-0.5 text-[9px] text-white/40">
                          <Star size={8} fill="currentColor" /> {ea.rating}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[9px] leading-relaxed text-white/40">{ea.description}</p>
                    </div>
                    <button
                      onClick={() => { void attachEA(ea); setEaMenuOpen(false); }}
                      className="shrink-0 rounded px-2 py-1 text-[9px] font-bold uppercase tracking-wide transition-colors"
                      style={{ backgroundColor: 'rgba(0,194,122,0.15)', color: '#00C27A', border: '1px solid rgba(0,194,122,0.3)' }}
                    >
                      Attach
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Active chart + shared EA overlays */}
      <div className="relative min-h-0 flex-1">
        {source === 'tradingview' ? (
          <TradingViewPanel />
        ) : (
          <ChartPanel ohlcvBuilder={ohlcvBuilder} isLiveData={isLiveData} />
        )}

        {/* Drop-catch overlay: keeps the drop out of the TV iframe */}
        {dragActive && source === 'tradingview' && (
          <div
            className="absolute inset-0 z-40 flex items-center justify-center"
            style={{ backgroundColor: 'rgba(6,13,22,0.45)', border: '2px dashed rgba(0,194,122,0.5)' }}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
            onDrop={(e) => { e.stopPropagation(); handleEADrop(e); }}
            onDragLeave={() => setDragActive(false)}
          >
            <span className="rounded px-3 py-1.5 font-mono text-xs" style={{ backgroundColor: 'rgba(17,17,24,0.9)', color: '#00C27A', border: '1px solid rgba(0,194,122,0.4)' }}>
              Drop EA to attach to {activeSymbol}
            </span>
          </div>
        )}

        {/* Attached EA chips (rendered on both chart sources) */}
        {symbolEAs.length > 0 && (
          <div className="absolute left-2 z-30 flex max-w-[60%] flex-wrap gap-1.5" style={{ top: source === 'tradingview' ? 34 : 76 }}>
            {symbolEAs.map((a) => (
              <div
                key={`${a.instanceId ?? a.strategyId}-${a.symbol}`}
                className="flex items-center gap-1.5 rounded px-2 py-1 text-[10px] font-mono"
                style={{ backgroundColor: 'rgba(17,17,24,0.85)', border: '1px solid rgba(0,194,122,0.3)', color: '#00C27A' }}
              >
                <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ backgroundColor: '#00C27A' }} />
                {a.name}
                {(() => {
                  const s = eaStats[`${a.strategyId}-${a.symbol}`];
                  if (!s || s.trades === 0) return <span className="text-white/30">· scanning</span>;
                  return (
                    <span style={{ color: s.direction === 'SELL' ? '#FF5252' : '#00C27A' }}>
                      · {s.direction} · {s.trades} trade{s.trades > 1 ? 's' : ''}
                    </span>
                  );
                })()}
                <button
                  onClick={() => detachEA(a)}
                  className="ml-0.5 opacity-60 transition-opacity hover:opacity-100"
                  title="Detach EA"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

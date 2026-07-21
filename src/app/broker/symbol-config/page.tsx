'use client';

// Broker Symbol / Group Configuration console — the pricing & routing
// contract for the live LP (owner spec 2026-07-21):
//   · Groups (Forex Majors/Minors, Metals, Energies, Indices, Crypto)
//     each carry ONE STANDARD: Trading · Commission/lot · Swap long ·
//     Swap short · Min lot · Max lot · Spread markup · Sessions ·
//     Routing (A-Book / B-Book / Hybrid).
//   · Expand a group to edit any symbol INDIVIDUALLY — an edited
//     symbol becomes an override and stops following the standard
//     until reset.
// effectiveConfigFor(symbol) is what the execution layer reads when
// the real liquidity connects — configure now, live later.

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Download, Upload, RotateCcw } from 'lucide-react';
import { useTradingStore } from '@/stores/trading';
import {
  SYMBOL_GROUPS, groupOfSymbol, groupStandard, setGroupStandard,
  symbolOverride, setSymbolOverride, clearSymbolOverride, effectiveConfigFor,
  exportConfig, importConfig, overrideCount, configUpdatedAt,
  type SymbolSettings, type BookRouting,
} from '@/lib/broker/symbol-config';

const ROUTES: BookRouting[] = ['A-Book', 'B-Book', 'Hybrid'];
const ROUTE_COLOR: Record<BookRouting, string> = { 'A-Book': '#29ABE2', 'B-Book': '#FFB300', 'Hybrid': '#CE93D8' };

const FIELDS: Array<{ key: keyof SymbolSettings; label: string; step?: number; type: 'number' | 'text' }> = [
  { key: 'commissionPerLot', label: 'Commission /lot', step: 0.5, type: 'number' },
  { key: 'swapLongPerLotDay', label: 'Swap long /lot/day', step: 0.5, type: 'number' },
  { key: 'swapShortPerLotDay', label: 'Swap short /lot/day', step: 0.5, type: 'number' },
  { key: 'minLot', label: 'Min lot', step: 0.01, type: 'number' },
  { key: 'maxLot', label: 'Max lot', step: 1, type: 'number' },
  { key: 'spreadMarkupPoints', label: 'Spread markup (pts)', step: 1, type: 'number' },
  { key: 'sessions', label: 'Sessions', type: 'text' },
];

function SettingsRow({ value, onChange, compact }: { value: SymbolSettings; onChange: (s: SymbolSettings) => void; compact?: boolean }) {
  const set = <K extends keyof SymbolSettings>(k: K, v: SymbolSettings[K]) => onChange({ ...value, [k]: v });
  return (
    <div className={`grid items-center gap-2 ${compact ? '' : 'py-1'}`} style={{ gridTemplateColumns: '70px repeat(7, minmax(90px, 1fr)) 110px' }}>
      <button onClick={() => set('trading', !value.trading)}
        className="rounded px-1.5 py-0.5 text-[9px] font-bold transition-all"
        style={{ backgroundColor: value.trading ? 'rgba(0,229,160,0.15)' : 'rgba(255,82,82,0.12)', color: value.trading ? '#00E5A0' : '#FF5252', border: `1px solid ${value.trading ? 'rgba(0,229,160,0.45)' : 'rgba(255,82,82,0.4)'}` }}>
        {value.trading ? 'TRADING' : 'DISABLED'}
      </button>
      {FIELDS.map((f) => (
        f.type === 'number' ? (
          <input key={f.key} type="number" step={f.step} value={value[f.key] as number}
            onChange={(e) => set(f.key, Number(e.target.value) as never)}
            className="rounded bg-white/[0.05] px-1.5 py-0.5 text-right font-mono text-[10px] text-white outline-none"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }} />
        ) : (
          <input key={f.key} value={value[f.key] as string}
            onChange={(e) => set(f.key, e.target.value as never)}
            className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[9px] text-white outline-none"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }} />
        )
      ))}
      <select value={value.routing} onChange={(e) => set('routing', e.target.value as BookRouting)}
        className="rounded bg-white/[0.05] px-1 py-0.5 text-[9px] font-bold outline-none"
        style={{ color: ROUTE_COLOR[value.routing], border: `1px solid ${ROUTE_COLOR[value.routing]}55` }}>
        {ROUTES.map((r) => <option key={r} value={r} style={{ backgroundColor: '#0A0F1A', color: ROUTE_COLOR[r] }}>{r}</option>)}
      </select>
    </div>
  );
}

export default function SymbolConfigPage() {
  const { prices } = useTradingStore();
  const [tick, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);
  const say = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 4000); };

  const universe = useMemo(() => Object.keys(prices).filter((s) => prices[s]?.bid != null).sort(), [prices]);
  const symbolsByGroup = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const s of universe) (map[groupOfSymbol(s)] ??= []).push(s);
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universe.length]);

  const toggleExpand = (id: string) => setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const doExport = () => {
    const blob = new Blob([exportConfig()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `raptor-symbol-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(a.href);
  };
  const doImport = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = async () => {
      const f = input.files?.[0]; if (!f) return;
      const res = importConfig(await f.text());
      say(res.ok ? 'Configuration imported.' : `Import failed: ${res.error}`);
      bump();
    };
    input.click();
  };

  return (
    <div className="p-6" data-tick={tick}>
      <div className="mb-1 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-white">SYMBOL &amp; GROUP CONFIGURATION</h1>
        <span className="rounded px-2 py-0.5 text-[10px] font-bold" style={{ color: '#00E5A0', border: '1px solid rgba(0,229,160,0.4)' }}>LP-READY</span>
        <span className="text-[10px] text-white/35">{universe.length} instruments · {overrideCount()} symbol override(s) · saved {configUpdatedAt() ? new Date(configUpdatedAt()!).toLocaleString() : '—'}</span>
        <div className="ml-auto flex gap-2">
          <button onClick={doExport} className="flex items-center gap-1 rounded px-2.5 py-1.5 text-[10px] font-bold text-white/60 transition-colors hover:text-white" style={{ border: '1px solid rgba(255,255,255,0.15)' }}><Download size={12} /> Export</button>
          <button onClick={doImport} className="flex items-center gap-1 rounded px-2.5 py-1.5 text-[10px] font-bold text-white/60 transition-colors hover:text-white" style={{ border: '1px solid rgba(255,255,255,0.15)' }}><Upload size={12} /> Import</button>
        </div>
      </div>
      <p className="mb-4 text-[11px] text-white/40">
        One standard per group — edit it and every symbol in the group follows. Expand a group to edit any symbol individually; an edited symbol
        becomes an <b className="text-white/70">override</b> and stops following the standard until reset. <span style={{ color: '#00E5A0' }}>This configuration
        is the pricing &amp; routing contract the execution layer reads the moment the live LP connects.</span>
      </p>
      {msg && <p className="mb-3 rounded border px-3 py-1.5 text-[10px]" style={{ borderColor: 'rgba(0,229,160,0.4)', color: '#00E5A0' }}>{msg}</p>}

      {/* Column headers */}
      <div className="mb-1 grid gap-2 px-3 text-[8px] font-bold uppercase tracking-wider text-white/30" style={{ gridTemplateColumns: '160px 70px repeat(7, minmax(90px, 1fr)) 110px' }}>
        <span>Group / Symbol</span><span>Trading</span>
        {FIELDS.map((f) => <span key={f.key} className={f.type === 'number' ? 'text-right' : ''}>{f.label}</span>)}
        <span>Routing</span>
      </div>

      {SYMBOL_GROUPS.map((g) => {
        const syms = symbolsByGroup[g.id] ?? [];
        if (!syms.length) return null;
        const std = groupStandard(g.id);
        const open = expanded.has(g.id);
        const ovCount = syms.filter((s) => symbolOverride(s)).length;
        return (
          <div key={g.id} className="mb-2 rounded-lg border" style={{ borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.015)' }}>
            {/* Group standard row */}
            <div className="grid items-center gap-2 px-3 py-2" style={{ gridTemplateColumns: '160px 1fr' }}>
              <button onClick={() => toggleExpand(g.id)} className="flex items-center gap-1.5 text-left text-[12px] font-bold text-white transition-colors hover:text-[#00E5A0]">
                {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {g.label}
                <span className="text-[9px] font-normal text-white/35">({syms.length}{ovCount ? ` · ${ovCount} override` : ''})</span>
              </button>
              <SettingsRow value={std} onChange={(s) => { setGroupStandard(g.id, s); bump(); }} compact />
            </div>
            {/* Expanded per-symbol rows */}
            {open && (
              <div className="border-t px-3 py-1.5" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                {syms.map((sym) => {
                  const eff = effectiveConfigFor(sym);
                  const isOv = eff.source === 'override';
                  return (
                    <div key={sym} className="grid items-center gap-2 py-0.5" style={{ gridTemplateColumns: '160px 1fr' }}>
                      <span className="flex items-center gap-1.5 pl-5 font-mono text-[11px]" style={{ color: isOv ? '#FFB300' : 'rgba(255,255,255,0.65)' }}>
                        {sym}
                        {isOv ? (
                          <button onClick={() => { clearSymbolOverride(sym); bump(); }} title="Reset to the group standard"
                            className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[7px] font-bold uppercase transition-all hover:brightness-125" style={{ color: '#FFB300', border: '1px solid rgba(255,179,0,0.4)' }}>
                            <RotateCcw size={8} /> override
                          </button>
                        ) : (
                          <span className="text-[7px] font-bold uppercase text-white/25">standard</span>
                        )}
                      </span>
                      <SettingsRow value={{ trading: eff.trading, commissionPerLot: eff.commissionPerLot, swapLongPerLotDay: eff.swapLongPerLotDay, swapShortPerLotDay: eff.swapShortPerLotDay, minLot: eff.minLot, maxLot: eff.maxLot, spreadMarkupPoints: eff.spreadMarkupPoints, sessions: eff.sessions, routing: eff.routing }}
                        onChange={(s) => { setSymbolOverride(sym, s); bump(); }} compact />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <p className="mt-4 text-[9px] leading-relaxed text-white/25">
        Routing: <b style={{ color: '#29ABE2' }}>A-Book</b> passes flow to the liquidity provider · <b style={{ color: '#FFB300' }}>B-Book</b> internalizes it ·
        <b style={{ color: '#CE93D8' }}> Hybrid</b> routes by size/risk rules (configured on the dealing desk). Every change is stored with a timestamp and can be
        exported for audit. Server-side enforcement of this table plugs in with the LP integration — the effective-config lookup is already the single source the
        execution layer reads.
      </p>
    </div>
  );
}

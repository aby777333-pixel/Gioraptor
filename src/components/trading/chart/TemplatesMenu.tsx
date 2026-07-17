'use client';

// Chart Templates / Layouts (super-prompt §1 / §11). A shared-header menu that
// saves and restores a full chart context: symbol + timeframe (which drive BOTH
// the TradingView and RAPTOR charts) plus the RAPTOR chart-type and indicator
// set. Templates persist in localStorage. Loading a template updates the shared
// store (symbol/TF) and pushes the chart-type + indicators to the RAPTOR chart
// via the raptor-apply-template event.

import { useEffect, useRef, useState } from 'react';
import { LayoutTemplate, Plus, Trash2, ChevronDown, Download, Check } from 'lucide-react';
import { useTradingStore } from '@/stores/trading';

interface ChartTemplate {
  id: string;
  name: string;
  symbol: string;
  timeframe: string;
  chartType: string;
  indicators: string[];
  createdAt: number;
}

const KEY = 'raptor_chart_templates';

function load(): ChartTemplate[] {
  try { const a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a : []; }
  catch { return []; }
}

export default function TemplatesMenu({ onToast }: { onToast: (msg: string) => void }) {
  const activeSymbol = useTradingStore((s) => s.activeSymbol);
  const activeTimeframe = useTradingStore((s) => s.activeTimeframe);
  const raptorChartType = useTradingStore((s) => s.raptorChartType);
  const raptorIndicators = useTradingStore((s) => s.raptorIndicators);
  const setActiveSymbol = useTradingStore((s) => s.setActiveSymbol);
  const setActiveTimeframe = useTradingStore((s) => s.setActiveTimeframe);

  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<ChartTemplate[]>([]);
  const [name, setName] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setTemplates(load()); }, []);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const persist = (next: ChartTemplate[]) => {
    setTemplates(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const saveCurrent = () => {
    const nm = name.trim() || `${activeSymbol} ${activeTimeframe}`;
    const t: ChartTemplate = {
      id: `${Date.now()}-${templates.length}`,
      name: nm,
      symbol: activeSymbol,
      timeframe: activeTimeframe,
      chartType: raptorChartType,
      indicators: [...raptorIndicators],
      createdAt: Date.now(),
    };
    persist([t, ...templates]);
    setName('');
    onToast(`Template saved: ${nm}`);
  };

  const apply = (t: ChartTemplate) => {
    setActiveSymbol(t.symbol);
    setActiveTimeframe(t.timeframe);
    try {
      window.dispatchEvent(new CustomEvent('raptor-timeframe-change', { detail: t.timeframe }));
      window.dispatchEvent(new CustomEvent('raptor-apply-template', { detail: { chartType: t.chartType, indicators: t.indicators } }));
    } catch { /* ignore */ }
    onToast(`Template loaded: ${t.name} (${t.symbol} · ${t.timeframe})`);
    setOpen(false);
  };

  const remove = (id: string) => persist(templates.filter((t) => t.id !== id));

  return (
    <div className="relative ml-1" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Chart templates & layouts"
        className="flex items-center gap-1 rounded px-2.5 py-1 font-mono text-[11px] transition-colors"
        style={{ backgroundColor: open ? 'rgba(41,171,226,0.15)' : 'transparent', color: open ? '#0091D5' : 'rgba(255,255,255,0.45)' }}
      >
        <LayoutTemplate size={12} /> <span className="hidden 2xl:inline">Templates</span> <ChevronDown size={10} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-[300px] rounded-lg border shadow-2xl" style={{ backgroundColor: '#0A0F1A', borderColor: 'rgba(255,255,255,0.1)' }}>
          {/* Save current */}
          <div className="border-b p-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <div className="mb-1.5 text-[10px] uppercase tracking-wide text-white/35">Save current view</div>
            <div className="mb-2 flex items-center gap-2 text-[10px] text-white/50">
              <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-white/70">{activeSymbol}</span>
              <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-white/70">{activeTimeframe}</span>
              <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-white/70 capitalize">{raptorChartType}</span>
              <span className="text-white/35">{raptorIndicators.length} ind.</span>
            </div>
            <div className="flex gap-1.5">
              <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveCurrent(); }}
                placeholder="Template name (optional)"
                className="flex-1 rounded bg-white/[0.06] px-2 py-1 text-[11px] text-white placeholder:text-white/25 outline-none" />
              <button onClick={saveCurrent} className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold text-black" style={{ backgroundColor: '#0091D5' }}>
                <Plus size={11} /> Save
              </button>
            </div>
          </div>

          {/* Saved templates */}
          <div className="max-h-[260px] overflow-y-auto">
            {templates.length === 0 && (
              <div className="px-3 py-4 text-center text-[10px] text-white/30">
                No templates yet. Set your symbol, timeframe, chart type and indicators, then Save.
              </div>
            )}
            {templates.map((t) => {
              const isCurrent = t.symbol === activeSymbol && t.timeframe === activeTimeframe;
              return (
                <div key={t.id} className="group flex items-center gap-2 border-t px-3 py-2 hover:bg-white/[0.03]" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[11px] font-semibold text-white">{t.name}</span>
                      {isCurrent && <Check size={10} className="shrink-0 text-[#00C27A]" />}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[9px] text-white/40">
                      <span className="font-mono">{t.symbol}</span>·<span className="font-mono">{t.timeframe}</span>·
                      <span className="capitalize">{t.chartType}</span>·<span>{t.indicators.length} ind.</span>
                    </div>
                  </div>
                  <button onClick={() => apply(t)} className="shrink-0 rounded px-2 py-1 text-[9px] font-bold uppercase tracking-wide transition-colors"
                    style={{ backgroundColor: 'rgba(0,194,122,0.15)', color: '#00C27A', border: '1px solid rgba(0,194,122,0.3)' }}>
                    <Download size={10} className="mr-0.5 inline" />Load
                  </button>
                  <button onClick={() => remove(t.id)} className="shrink-0 text-white/30 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400">
                    <Trash2 size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

// Watchlist (super-prompt §13). Shared-header symbol list with live bid/ask/
// spread and up/down tick colouring. Clicking a row switches the active symbol,
// which drives BOTH the TradingView and RAPTOR charts. Symbols persist in
// localStorage; add/remove supported.

import { useEffect, useMemo, useRef, useState } from 'react';
import { List, Plus, Trash2, ChevronDown, TrendingUp, TrendingDown } from 'lucide-react';

interface Tick { bid: number; ask: number; mid: number; spread: number }

const KEY = 'raptor_watchlist_symbols';
const DEFAULTS = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSD', 'US30', 'NAS100', 'USOIL'];

function load(): string[] {
  try { const a = JSON.parse(localStorage.getItem(KEY) || 'null'); return Array.isArray(a) && a.length ? a : DEFAULTS; }
  catch { return DEFAULTS; }
}

function digits(v: number) { return v < 20 ? 5 : v < 500 ? 3 : 2; }

export default function WatchlistMenu({
  activeSymbol, prices, setActiveSymbol,
}: {
  activeSymbol: string;
  prices: Record<string, Tick | undefined>;
  setActiveSymbol: (s: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const prevMid = useRef<Record<string, number>>({});

  useEffect(() => { setSymbols(load()); }, []);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const persist = (next: string[]) => { setSymbols(next); try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ } };
  const add = () => {
    const s = input.trim().toUpperCase();
    if (!s || symbols.includes(s)) { setInput(''); return; }
    persist([...symbols, s]);
    setInput('');
  };
  const remove = (s: string) => persist(symbols.filter((x) => x !== s));

  // Tick-direction colour vs the previous render's mid.
  const rows = useMemo(() => symbols.map((s) => {
    const t = prices[s];
    const mid = t?.mid;
    const prev = prevMid.current[s];
    const dir = mid != null && prev != null ? (mid > prev ? 1 : mid < prev ? -1 : 0) : 0;
    if (mid != null) prevMid.current[s] = mid;
    return { symbol: s, t, dir };
  }), [symbols, prices]);

  return (
    <div className="relative ml-1" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Watchlist"
        className="flex items-center gap-1 rounded px-2.5 py-1 font-mono text-[11px] transition-colors"
        style={{ backgroundColor: open ? 'rgba(41,171,226,0.15)' : 'transparent', color: open ? '#0091D5' : 'rgba(255,255,255,0.45)' }}
      >
        <List size={12} /> <span className="hidden xl:inline">Watchlist</span> <ChevronDown size={10} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-[300px] rounded-lg border shadow-2xl" style={{ backgroundColor: '#0A0F1A', borderColor: 'rgba(255,255,255,0.1)' }}>
          <div className="flex items-center gap-1.5 border-b p-2" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
              placeholder="Add symbol (e.g. GBPJPY)" className="flex-1 rounded bg-white/[0.06] px-2 py-1 text-[11px] uppercase text-white placeholder:text-white/25 outline-none" />
            <button onClick={add} className="rounded px-2 py-1 text-[10px] font-bold text-black" style={{ backgroundColor: '#0091D5' }}><Plus size={12} /></button>
          </div>
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 px-3 py-1 text-[8px] uppercase tracking-wide text-white/30">
            <span>Symbol</span><span className="text-right">Bid</span><span className="text-right">Ask</span><span className="text-right">Sprd</span>
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {rows.map(({ symbol, t, dir }) => {
              const isActive = symbol === activeSymbol;
              const d = t ? digits(t.mid) : 2;
              const color = dir > 0 ? '#00C27A' : dir < 0 ? '#FF5252' : 'rgba(255,255,255,0.75)';
              return (
                <div key={symbol}
                  onClick={() => { setActiveSymbol(symbol); setOpen(false); }}
                  className="group grid cursor-pointer grid-cols-[1fr_auto_auto_auto] items-center gap-x-2 border-t px-3 py-1.5 text-[11px] transition-colors hover:bg-white/[0.03]"
                  style={{ borderColor: 'rgba(255,255,255,0.04)', backgroundColor: isActive ? 'rgba(41,171,226,0.08)' : 'transparent' }}>
                  <span className="flex items-center gap-1 font-mono font-semibold" style={{ color: isActive ? '#0091D5' : '#fff' }}>
                    {dir > 0 && <TrendingUp size={9} className="text-[#00C27A]" />}
                    {dir < 0 && <TrendingDown size={9} className="text-[#FF5252]" />}
                    {symbol}
                  </span>
                  <span className="text-right font-mono" style={{ color }}>{t ? t.bid.toFixed(d) : '—'}</span>
                  <span className="text-right font-mono" style={{ color }}>{t ? t.ask.toFixed(d) : '—'}</span>
                  <span className="flex items-center justify-end gap-1 text-right font-mono text-white/35">
                    {t ? (t.spread).toFixed(d) : '—'}
                    <button onClick={(e) => { e.stopPropagation(); remove(symbol); }} className="opacity-0 transition-opacity group-hover:opacity-60 hover:!opacity-100 hover:text-red-400"><Trash2 size={10} /></button>
                  </span>
                </div>
              );
            })}
            {rows.length === 0 && <div className="py-3 text-center text-[10px] text-white/30">Watchlist empty — add a symbol above.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

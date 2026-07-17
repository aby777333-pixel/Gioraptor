'use client';

// Price Alerts engine (super-prompt §10). Lives in the shared chart header, so
// it works over BOTH the TradingView and RAPTOR charts. Alerts are evaluated
// live against streaming prices and fire an in-app (and optional desktop)
// notification once. Persisted in localStorage so they survive reloads.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Plus, Trash2, ChevronDown, Check } from 'lucide-react';

export interface PriceAlert {
  id: string;
  symbol: string;
  condition: 'above' | 'below';
  price: number;
  note?: string;
  createdAt: number;
  triggered: boolean;
  triggeredAt?: number;
}

const KEY = 'raptor_price_alerts';

function load(): PriceAlert[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
function save(a: PriceAlert[]) {
  try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* ignore */ }
}

export default function AlertsMenu({
  activeSymbol, prices, onToast,
}: {
  activeSymbol: string;
  prices: Record<string, { bid: number; ask: number } | undefined>;
  onToast: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [condition, setCondition] = useState<'above' | 'below'>('above');
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const alertsRef = useRef<PriceAlert[]>([]);
  alertsRef.current = alerts;

  useEffect(() => { setAlerts(load()); }, []);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const persist = useCallback((next: PriceAlert[]) => { setAlerts(next); save(next); }, []);

  // Prefill the price field with the live mid when opening / switching symbol.
  useEffect(() => {
    const t = prices[activeSymbol];
    if (open && t && !price) setPrice(((t.bid + t.ask) / 2).toFixed(t.bid < 20 ? 5 : 2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeSymbol]);

  // ── Live trigger engine ───────────────────────────────
  useEffect(() => {
    const list = alertsRef.current;
    const active = list.filter((a) => !a.triggered);
    if (!active.length) return;
    let changed = false;
    for (const a of active) {
      const t = prices[a.symbol];
      if (!t) continue;
      const mid = (t.bid + t.ask) / 2;
      const hit = a.condition === 'above' ? mid >= a.price : mid <= a.price;
      if (hit) {
        a.triggered = true; a.triggeredAt = Date.now(); changed = true;
        onToast(`🔔 ${a.symbol} ${a.condition} ${a.price} (now ${mid.toFixed(a.price < 20 ? 5 : 2)})`);
        try {
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification('RAPTOR price alert', { body: `${a.symbol} ${a.condition} ${a.price}` });
          }
        } catch { /* ignore */ }
      }
    }
    if (changed) persist([...list]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prices]);

  const add = () => {
    const p = parseFloat(price);
    if (!(p > 0)) { onToast('Enter a valid alert price'); return; }
    const a: PriceAlert = {
      id: `${activeSymbol}-${p}-${condition}-${alerts.length}-${Math.floor(p * 1000)}`,
      symbol: activeSymbol, condition, price: p, note: note.trim() || undefined,
      createdAt: Date.now(), triggered: false,
    };
    persist([a, ...alerts]);
    setNote('');
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
    onToast(`Alert set: ${activeSymbol} ${condition} ${p}`);
  };
  const remove = (id: string) => persist(alerts.filter((a) => a.id !== id));
  const activeCount = alerts.filter((a) => !a.triggered).length;

  return (
    <div className="relative ml-1" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Price alerts"
        className="flex items-center gap-1 rounded px-2.5 py-1 font-mono text-[11px] transition-colors"
        style={{ backgroundColor: open ? 'rgba(41,171,226,0.15)' : 'transparent', color: open ? '#0091D5' : 'rgba(255,255,255,0.45)' }}
      >
        <Bell size={12} /> Alerts{activeCount > 0 ? ` (${activeCount})` : ''} <ChevronDown size={10} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-[280px] rounded-lg border p-3 shadow-2xl" style={{ backgroundColor: '#0A0F1A', borderColor: 'rgba(255,255,255,0.1)' }}>
          <div className="mb-2 text-[11px] font-bold text-white">New alert · {activeSymbol}</div>
          <div className="mb-2 flex gap-1.5">
            {(['above', 'below'] as const).map((c) => (
              <button key={c} onClick={() => setCondition(c)}
                className="flex-1 rounded-md py-1.5 text-[11px] font-semibold capitalize transition-colors"
                style={{ backgroundColor: condition === c ? 'rgba(41,171,226,0.15)' : 'rgba(255,255,255,0.04)', color: condition === c ? '#0091D5' : 'rgba(255,255,255,0.5)', border: `1px solid ${condition === c ? 'rgba(41,171,226,0.4)' : 'rgba(255,255,255,0.08)'}` }}>
                {c}
              </button>
            ))}
          </div>
          <div className="mb-2 flex items-center gap-1.5">
            <label className="w-10 text-[10px] text-white/45">Price</label>
            <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="level"
              className="flex-1 rounded bg-white/[0.06] px-2 py-1 font-mono text-[11px] text-white outline-none" />
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="note (optional)"
            className="mb-2 w-full rounded bg-white/[0.06] px-2 py-1 text-[11px] text-white placeholder:text-white/25 outline-none" />
          <button onClick={add} className="mb-3 flex w-full items-center justify-center gap-1 rounded-md py-1.5 text-[11px] font-bold text-black" style={{ backgroundColor: '#0091D5' }}>
            <Plus size={12} /> Add alert
          </button>

          <div className="max-h-[180px] overflow-y-auto">
            {alerts.length === 0 && <div className="py-2 text-center text-[10px] text-white/30">No alerts yet.</div>}
            {alerts.map((a) => (
              <div key={a.id} className="flex items-center gap-2 border-t py-1.5 text-[10px]" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                {a.triggered
                  ? <Check size={11} className="shrink-0 text-[#00C27A]" />
                  : <Bell size={11} className="shrink-0 text-white/40" />}
                <span className="font-mono text-white/80">{a.symbol}</span>
                <span className="text-white/40">{a.condition}</span>
                <span className="font-mono text-white/80">{a.price}</span>
                <span className="ml-auto text-[9px] text-white/30">{a.triggered ? 'fired' : 'active'}</span>
                <button onClick={() => remove(a.id)} className="shrink-0 text-white/30 hover:text-red-400"><Trash2 size={11} /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

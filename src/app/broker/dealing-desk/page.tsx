'use client';

import { useState, useEffect, useRef } from 'react';
import { Download, Upload, Plus, Lock, BarChart3, ChevronRight } from 'lucide-react';

/* ───────────── Types ───────────── */
interface TradeEvent {
  id: string;
  action: 'Close Buy' | 'Close Sell' | 'Open Buy' | 'Open Sell';
  server: 'MT5' | 'MT4';
  account: string;
  orderId: string;
  volume: string;
  symbol: string;
  pnl: number | null;
  time: string;
}

/* ───────────── Mock Data ───────────── */
const SYMBOLS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'BTCUSD', 'USDJPY', 'NZDCAD', 'AUDCAD', 'US30', 'GBPJPY'];
const ACTIONS: TradeEvent['action'][] = ['Close Buy', 'Close Sell', 'Open Buy', 'Open Sell'];

function mockTrade(i: number): TradeEvent {
  const action = ACTIONS[i % 4];
  const sym = SYMBOLS[i % SYMBOLS.length];
  const isClose = action.startsWith('Close');
  const vol = [0.01, 0.02, 0.05, 0.10, 0.25, 0.50, 1, 2, 5, 8][i % 10];
  const pnl = isClose ? (Math.random() > 0.4 ? parseFloat((Math.random() * 800 + 0.08).toFixed(2)) : -parseFloat((Math.random() * 700 + 1).toFixed(2))) : null;
  const h = 15, m = 49, s = 22 - i * 4;
  return {
    id: `t${i}`,
    action,
    server: i % 3 === 0 ? 'MT4' : 'MT5',
    account: `${6200000 + Math.floor(Math.random() * 10000)}`,
    orderId: `${23171730 - i * 3 + Math.floor(Math.random() * 5)}`,
    volume: `${vol} lots ${sym}`,
    symbol: sym,
    pnl,
    time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(Math.max(0, s)).padStart(2, '0')}`,
  };
}

const INITIAL_TRADES: TradeEvent[] = Array.from({ length: 15 }, (_, i) => mockTrade(i));

/* ───────────── Mock candles ───────────── */
function generateCandles(count: number) {
  let price = 1.04950;
  return Array.from({ length: count }, (_, i) => {
    const open = price;
    const close = open + (Math.random() - 0.48) * 0.003;
    const high = Math.max(open, close) + Math.random() * 0.0015;
    const low = Math.min(open, close) - Math.random() * 0.0015;
    price = close;
    return { open, close, high, low, bullish: close >= open, x: i };
  });
}

/* ───────────── Action Badge ───────────── */
function ActionBadge({ action }: { action: TradeEvent['action'] }) {
  const isBuy = action.includes('Buy');
  const isClose = action.startsWith('Close');
  const color = isBuy ? 'var(--profit)' : 'var(--loss)';
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
      style={
        isClose
          ? { background: isBuy ? 'rgba(0,200,150,0.18)' : 'rgba(255,69,96,0.18)', color }
          : { border: `1px solid ${color}`, color, background: 'transparent' }
      }
    >
      {action}
    </span>
  );
}

/* ═══════════════════════════════════════════ */
/*         Dealing Stream — Executor          */
/* ═══════════════════════════════════════════ */
export default function DealingDeskPage() {
  const [trades, setTrades] = useState<TradeEvent[]>(INITIAL_TRADES);
  const [activeSymbol, setActiveSymbol] = useState<'EURUSD' | 'XAUUSD' | 'BTCUSD'>('EURUSD');
  const [candles] = useState(() => generateCandles(20));
  const listRef = useRef<HTMLDivElement>(null);

  /* Simulated live feed — new trade every 3s */
  useEffect(() => {
    let counter = 15;
    const iv = setInterval(() => {
      setTrades(prev => [mockTrade(counter++), ...prev].slice(0, 50));
    }, 3000);
    return () => clearInterval(iv);
  }, []);

  /* ── SVG Candlestick chart ── */
  const chartW = 520, chartH = 260, padL = 10, padR = 60, padT = 30, padB = 20;
  const bodyW = chartW - padL - padR;
  const bodyH = chartH - padT - padB;
  const allPrices = candles.flatMap(c => [c.high, c.low]);
  const minP = Math.min(...allPrices), maxP = Math.max(...allPrices);
  const range = maxP - minP || 0.001;
  const yOf = (p: number) => padT + bodyH - ((p - minP) / range) * bodyH;
  const candleW = bodyW / candles.length;
  const lastC = candles[candles.length - 1];

  return (
    <div className="p-4 min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">
          Trading <ChevronRight className="inline w-3 h-3" /> Dealing Desk
        </p>
        <h1 className="text-lg font-bold text-white tracking-wide">DEALING STREAM &mdash; Executor</h1>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4">
        {[
          { icon: <Upload className="w-3.5 h-3.5" />, label: 'Import' },
          { icon: <Download className="w-3.5 h-3.5" />, label: 'Export' },
          { icon: <Plus className="w-3.5 h-3.5" />, label: 'Add Widget' },
        ].map(b => (
          <button
            key={b.label}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium border transition-colors"
            style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)', background: 'var(--bg-surface)' }}
          >
            {b.icon} {b.label}
          </button>
        ))}
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-[1fr_40%] gap-4">
        {/* ─── LEFT: Last Trades stream ─── */}
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
          <div className="px-4 py-2 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">Last Trades</span>
            <span className="text-[10px] text-white/30">{trades.length} events</span>
          </div>
          <div ref={listRef} className="overflow-y-auto" style={{ maxHeight: 540 }}>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-white/30 uppercase text-[10px] tracking-wider" style={{ background: 'var(--bg-elevated)' }}>
                  <th className="px-3 py-2 text-left w-6"></th>
                  <th className="px-2 py-2 text-left">Action</th>
                  <th className="px-2 py-2 text-left">Server</th>
                  <th className="px-2 py-2 text-left">Account</th>
                  <th className="px-2 py-2 text-left">Order ID</th>
                  <th className="px-2 py-2 text-left">Volume</th>
                  <th className="px-2 py-2 text-right">PnL</th>
                  <th className="px-2 py-2 text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t, idx) => (
                  <tr
                    key={t.id + '-' + idx}
                    className="border-b transition-colors hover:bg-white/[0.02]"
                    style={{
                      borderColor: 'var(--border)',
                      animation: idx === 0 ? 'slideInTop 0.3s ease-out' : undefined,
                    }}
                  >
                    <td className="px-3 py-1.5 text-center">
                      {t.action.startsWith('Close') ? (
                        <Lock className="w-3 h-3 text-white/25" />
                      ) : (
                        <BarChart3 className="w-3 h-3 text-white/25" />
                      )}
                    </td>
                    <td className="px-2 py-1.5"><ActionBadge action={t.action} /></td>
                    <td className="px-2 py-1.5 text-white/60">{t.server}</td>
                    <td className="px-2 py-1.5 mono text-white/70">{t.account}</td>
                    <td className="px-2 py-1.5 mono text-white/50">{t.orderId}</td>
                    <td className="px-2 py-1.5 text-white/70">{t.volume}</td>
                    <td className="px-2 py-1.5 text-right mono font-semibold" style={{ color: t.pnl === null ? 'var(--text-muted)' : t.pnl >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
                      {t.pnl === null ? '\u2014' : `${t.pnl >= 0 ? '+' : ''}$${t.pnl.toFixed(2)}`}
                    </td>
                    <td className="px-2 py-1.5 text-right mono text-white/40">{t.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── RIGHT: Chart + Last Trade Event ─── */}
        <div className="flex flex-col gap-4">
          {/* Symbol Chart */}
          <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
            {/* Symbol tabs */}
            <div className="px-3 py-2 flex items-center gap-3 border-b" style={{ borderColor: 'var(--border)' }}>
              {(['EURUSD', 'XAUUSD', 'BTCUSD'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setActiveSymbol(s)}
                  className="text-[11px] font-semibold px-2 py-0.5 rounded transition-colors"
                  style={{
                    color: activeSymbol === s ? 'var(--accent)' : 'var(--text-secondary)',
                    background: activeSymbol === s ? 'rgba(0,180,216,0.1)' : 'transparent',
                  }}
                >
                  {s}
                </button>
              ))}
              <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(0,180,216,0.12)', color: 'var(--accent)' }}>1h</span>
            </div>

            {/* Drawing tools */}
            <div className="px-3 py-1 flex items-center gap-2 border-b" style={{ borderColor: 'var(--border)' }}>
              {['\u2014', '\u2571', '\u25CB', '\u25A1', '\u2193', 'T', '\u2630'].map((icon, i) => (
                <button key={i} className="w-5 h-5 flex items-center justify-center text-[10px] text-white/30 hover:text-white/60 transition-colors rounded hover:bg-white/5">
                  {icon}
                </button>
              ))}
            </div>

            {/* Chart SVG */}
            <div className="px-2 py-1">
              <div className="text-[9px] text-white/30 px-1 mb-1">
                Euro vs US Dollar, 60 &nbsp; O {lastC.open.toFixed(5)} H {lastC.high.toFixed(5)} L {lastC.low.toFixed(5)} C {lastC.close.toFixed(5)}
              </div>
              <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" style={{ height: 260 }}>
                {/* Grid lines */}
                {Array.from({ length: 5 }, (_, i) => {
                  const y = padT + (bodyH / 4) * i;
                  const price = maxP - (range / 4) * i;
                  return (
                    <g key={i}>
                      <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="rgba(255,255,255,0.04)" />
                      <text x={chartW - padR + 4} y={y + 3} fill="rgba(255,255,255,0.25)" fontSize="8" fontFamily="monospace">{price.toFixed(5)}</text>
                    </g>
                  );
                })}
                {/* Candles */}
                {candles.map((c, i) => {
                  const x = padL + i * candleW + candleW / 2;
                  const color = c.bullish ? 'var(--profit)' : 'var(--loss)';
                  const bodyTop = yOf(Math.max(c.open, c.close));
                  const bodyBot = yOf(Math.min(c.open, c.close));
                  const bodyHeight = Math.max(bodyBot - bodyTop, 1);
                  return (
                    <g key={i}>
                      <line x1={x} y1={yOf(c.high)} x2={x} y2={yOf(c.low)} stroke={color} strokeWidth={1} />
                      <rect x={x - candleW * 0.35} y={bodyTop} width={candleW * 0.7} height={bodyHeight} fill={c.bullish ? color : color} rx={1} />
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Last Trade Event */}
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">Last Trade Event</span>
            </div>
            <div className="text-sm font-bold text-white mb-1">EURUSD</div>
            <div className="text-[10px] text-white/30 mb-3">MT5dev &nbsp; Mt5 &nbsp; 04.10.2023 15:49:22</div>

            <div className="flex items-center gap-4 mb-3">
              <div>
                <span className="mono text-sm font-semibold" style={{ color: 'var(--profit)' }}>1.05332</span>
                <span className="text-[10px] ml-1" style={{ color: 'var(--profit)' }}>&uarr;</span>
              </div>
              <div>
                <span className="mono text-sm font-semibold" style={{ color: 'var(--loss)' }}>1.04953</span>
                <span className="text-[10px] ml-1" style={{ color: 'var(--loss)' }}>&darr;</span>
              </div>
            </div>

            <div className="text-[11px] text-white/50 space-y-1 mb-4">
              <div>Bid: <span className="mono text-white/70">1.05309</span> &harr; Ask: <span className="mono text-white/70">1.05328</span></div>
              <div>Spread: <span className="mono text-white/70">1.9</span></div>
            </div>

            {/* Execution Semaphore */}
            <div className="rounded border p-2 text-center" style={{ borderColor: 'rgba(0,200,150,0.2)', background: 'rgba(0,200,150,0.06)' }}>
              <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Execution Semaphore</div>
              <div className="flex items-center justify-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: 'var(--profit)', boxShadow: '0 0 6px var(--profit)' }} />
                <span className="text-[11px] font-medium" style={{ color: 'var(--profit)' }}>Trades execution is okay</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Slide-in animation */}
      <style>{`
        @keyframes slideInTop {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

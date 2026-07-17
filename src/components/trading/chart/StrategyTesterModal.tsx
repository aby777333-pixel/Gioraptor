'use client';

// Strategy Tester (super-prompt §11). Runs a bar-level backtest of the EA's
// strategy over the loaded history (reusing the live runtime's strategy logic)
// and shows metrics, an equity curve, and the trade list. Honestly labelled as
// a simplified bar-level simulation.

import { useMemo, useState } from 'react';
import { X, TrendingUp, TrendingDown } from 'lucide-react';
import { backtestStrategy, type BacktestResult, type EASettings, type StrategyKind } from '@/lib/trading/ea-engine';
import type { OHLCVBar } from '@/types/trading';

type Tab = 'overview' | 'trades';

export default function StrategyTesterModal({
  eaName, symbol, timeframe, bars, strategyId, strategyKind, settings, onClose,
}: {
  eaName: string; symbol: string; timeframe: string; bars: OHLCVBar[];
  strategyId: string; strategyKind: StrategyKind | undefined; settings: EASettings;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>('overview');
  const result: BacktestResult | null = useMemo(
    () => (bars.length >= 80 ? backtestStrategy(bars, strategyId, strategyKind, settings) : null),
    [bars, strategyId, strategyKind, settings],
  );

  const net = result?.netProfit ?? 0;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onMouseDown={onClose}>
      <div
        className="flex max-h-[88vh] w-[600px] flex-col overflow-hidden rounded-xl border shadow-2xl"
        style={{ backgroundColor: '#0A0F1A', borderColor: 'rgba(255,255,255,0.1)' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div>
            <div className="text-[13px] font-bold text-white">Strategy Tester — {eaName}</div>
            <div className="text-[10px] text-white/40">{symbol} · {timeframe} · {result?.barsTested ?? bars.length} bars · bar-level simulation</div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={16} /></button>
        </div>

        {!result ? (
          <div className="p-8 text-center text-[12px] text-white/50">
            Not enough history loaded to backtest ({bars.length} bars). Let the chart stream more data and try again.
          </div>
        ) : (
          <>
            <div className="flex gap-0.5 border-b px-2 pt-2" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              {(['overview', 'trades'] as Tab[]).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className="rounded-t px-3 py-1.5 text-[11px] font-medium capitalize transition-colors"
                  style={{ backgroundColor: tab === t ? 'rgba(41,171,226,0.12)' : 'transparent', color: tab === t ? '#0091D5' : 'rgba(255,255,255,0.45)' }}>
                  {t === 'trades' ? `Trades (${result.numTrades})` : 'Overview'}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {tab === 'overview' && (
                <>
                  <div className="mb-3 grid grid-cols-4 gap-2">
                    <Metric label="Net P&L" value={`$${net.toLocaleString()}`} color={net >= 0 ? '#00C27A' : '#FF5252'} />
                    <Metric label="Profit factor" value={result.profitFactor.toFixed(2)} />
                    <Metric label="Win rate" value={`${result.winRate}%`} />
                    <Metric label="Max DD" value={`${result.maxDrawdownPct}%`} color="#FF5252" />
                    <Metric label="Trades" value={String(result.numTrades)} />
                    <Metric label="Sharpe" value={result.sharpe.toFixed(2)} />
                    <Metric label="Avg trade" value={`${result.avgTradePct}%`} />
                    <Metric label="Expectancy" value={`$${result.expectancy}`} />
                    <Metric label="Gross profit" value={`$${result.grossProfit.toLocaleString()}`} color="#00C27A" />
                    <Metric label="Gross loss" value={`$${result.grossLoss.toLocaleString()}`} color="#FF5252" />
                    <Metric label="Largest win" value={`${result.largestWinPct}%`} color="#00C27A" />
                    <Metric label="Largest loss" value={`${result.largestLossPct}%`} color="#FF5252" />
                  </div>
                  <div className="mb-1 text-[10px] uppercase tracking-wide text-white/35">Equity curve</div>
                  <EquityCurve equity={result.equity} />
                  <p className="mt-2 text-[9px] text-white/25">
                    Bar-level model: entries flip on opposite signals; ATR-scaled SL/TP close intrabar; fixed
                    ${BT_NOTIONAL_LABEL} notional per trade, no spread/commission/swap. Results are illustrative, not a guarantee.
                  </p>
                </>
              )}

              {tab === 'trades' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead className="text-white/35">
                      <tr className="text-left">
                        <th className="py-1 pr-2">#</th><th className="pr-2">Dir</th>
                        <th className="pr-2 text-right">Entry</th><th className="pr-2 text-right">Exit</th>
                        <th className="pr-2 text-right">Return</th><th className="pr-2 text-right">P&L</th><th>Exit</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {result.trades.slice(-100).map((t, i) => (
                        <tr key={i} className="border-t border-white/[0.04]">
                          <td className="py-1 pr-2 text-white/30">{i + 1}</td>
                          <td className="pr-2" style={{ color: t.direction === 'BUY' ? '#00C27A' : '#FF5252' }}>
                            {t.direction === 'BUY' ? <TrendingUp size={10} className="inline" /> : <TrendingDown size={10} className="inline" />} {t.direction}
                          </td>
                          <td className="pr-2 text-right text-white/60">{t.entry.toFixed(t.entry < 20 ? 5 : 2)}</td>
                          <td className="pr-2 text-right text-white/60">{t.exit.toFixed(t.exit < 20 ? 5 : 2)}</td>
                          <td className="pr-2 text-right" style={{ color: t.retPct >= 0 ? '#00C27A' : '#FF5252' }}>{t.retPct >= 0 ? '+' : ''}{t.retPct.toFixed(2)}%</td>
                          <td className="pr-2 text-right" style={{ color: t.pnl >= 0 ? '#00C27A' : '#FF5252' }}>{t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(0)}</td>
                          <td className="text-white/30">{t.reason}</td>
                        </tr>
                      ))}
                      {result.trades.length === 0 && <tr><td colSpan={7} className="py-4 text-center text-white/30">No trades generated over this history.</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const BT_NOTIONAL_LABEL = '10,000';

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-md border p-2" style={{ borderColor: 'rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
      <div className="text-[8px] uppercase tracking-wide text-white/35">{label}</div>
      <div className="font-mono text-[13px] font-bold" style={{ color: color ?? '#fff' }}>{value}</div>
    </div>
  );
}

function EquityCurve({ equity }: { equity: number[] }) {
  const w = 552, h = 120, pad = 4;
  if (equity.length < 2) return <div className="text-[10px] text-white/30">No equity data.</div>;
  const min = Math.min(...equity), max = Math.max(...equity);
  const range = max - min || 1;
  const pts = equity.map((e, i) => {
    const x = pad + (i / (equity.length - 1)) * (w - 2 * pad);
    const y = pad + (1 - (e - min) / range) * (h - 2 * pad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const up = equity[equity.length - 1] >= equity[0];
  const stroke = up ? '#00C27A' : '#FF5252';
  const baselineY = pad + (1 - (equity[0] - min) / range) * (h - 2 * pad);
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
      <line x1={pad} y1={baselineY} x2={w - pad} y2={baselineY} stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth={1.5} />
    </svg>
  );
}

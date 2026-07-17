import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Modal, Badge, SectionTitle, fmtMoney, pnlColor } from './ui';
import {
  EquityCurveChart,
  DrawdownChart,
  TradeScatter,
  MonthlyHeatmap,
  MetricsTable,
} from './BacktestCharts';
import { VotePanel } from './AgentVotes';
import { EaViewer } from './EaViewer';
import { useStrategy } from '../hooks/useApi';
import type { Strategy } from '../types';

type Tab = 'overview' | 'backtest' | 'code' | 'agents';

export function StrategyDetail({
  strategy,
  onClose,
}: {
  strategy: Strategy | null;
  onClose: () => void;
}) {
  const { data: full } = useStrategy(strategy?.id ?? null);
  const [tab, setTab] = useState<Tab>('overview');
  const s = full || strategy;

  const equity = s?.backtest?.equity_curve || [];
  const trades = s?.backtest?.trades || [];
  const metrics = s?.backtest?.metrics || {};

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'backtest', label: 'Backtest' },
    { key: 'code', label: 'EA Code' },
    { key: 'agents', label: 'Agent Reasoning' },
  ];

  if (!s) return null;

  return (
    <Modal open={!!strategy} onClose={onClose} wide title={
      <div className="flex items-center gap-3">
        <span>{s.name}</span>
        <Badge status={s.status as string}>{s.status}</Badge>
      </div>
    }>
      <div className="flex gap-1 mb-4 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === t.key
                ? 'bg-primary/15 text-primary border border-primary/40'
                : 'text-subtext border border-border hover:text-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-subtext leading-relaxed">{s.description}</p>
          <div className="flex flex-wrap gap-1.5">
            {(s.config?.markets || []).map((m) => (
              <span key={m} className="badge border border-border text-text bg-bg">
                {m}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Stat label="Expected Return" value={s.config?.expected_return != null ? `${s.config.expected_return}%` : '—'} />
            <Stat label="Risk Level" value={String(s.config?.risk_level || '—')} />
            <Stat label="Best Regime" value={String(s.config?.best_regime || '—')} color="#00ff88" />
            <Stat label="Worst Regime" value={String(s.config?.worst_regime || '—')} color="#ff4444" />
            <Stat label="Sharpe" value={metrics.sharpe != null ? String(metrics.sharpe) : '—'} />
            <Stat label="Max DD" value={metrics.max_drawdown_pct != null ? `${metrics.max_drawdown_pct}%` : '—'} color="#ff4444" />
          </div>
          {s.config?.explanation && (
            <div className="glass !rounded-lg p-3 border-l-2 border-primary/60">
              <div className="text-xs font-semibold text-primary mb-1">🧠 Why this may work</div>
              <p className="text-xs text-subtext leading-relaxed">{s.config.explanation}</p>
            </div>
          )}
          {equity.length > 0 && <EquityCurveChart data={equity} />}
        </div>
      )}

      {tab === 'backtest' && (
        <div className="flex flex-col gap-5">
          {equity.length ? (
            <>
              <MetricsTable metrics={metrics} />
              <EquityCurveChart data={equity} />
              <DrawdownChart data={equity} />
              <MonthlyHeatmap equity={equity} />
              {trades.length > 0 && <TradeScatter trades={trades} />}
              <TradeList trades={trades} />
            </>
          ) : (
            <div className="text-subtext text-sm text-center py-8">No backtest data available.</div>
          )}
        </div>
      )}

      {tab === 'code' && <EaViewer strategyId={s.id} strategyName={s.name} />}

      {tab === 'agents' && <VotePanel votes={s.votes || []} />}
    </Modal>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="glass !rounded-lg p-2.5 border border-border">
      <div className="text-[10px] text-subtext uppercase tracking-wide">{label}</div>
      <div className="text-sm font-bold font-mono" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function TradeList({ trades }: { trades: any[] }) {
  const shown = useMemo(() => trades.slice(0, 30), [trades]);
  if (!shown.length) return null;
  return (
    <div>
      <SectionTitle>Trades ({trades.length})</SectionTitle>
      <div className="overflow-x-auto max-h-64 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="text-subtext sticky top-0 bg-card">
            <tr className="text-left">
              <th className="py-1.5 pr-2">Entry</th>
              <th className="pr-2">Side</th>
              <th className="pr-2 text-right">Entry Px</th>
              <th className="pr-2 text-right">Exit Px</th>
              <th className="text-right">P&L</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {shown.map((t, i) => (
              <tr key={i} className="border-t border-border/40">
                <td className="py-1.5 pr-2 text-subtext">
                  {t.entry_time ? format(new Date(t.entry_time), 'MMM d HH:mm') : '—'}
                </td>
                <td className="pr-2">
                  <span className={t.side === 'buy' ? 'text-success' : 'text-danger'}>{t.side || '—'}</span>
                </td>
                <td className="pr-2 text-right">{t.entry != null ? fmtMoney(t.entry) : '—'}</td>
                <td className="pr-2 text-right">{t.exit != null ? fmtMoney(t.exit) : '—'}</td>
                <td className={`text-right font-semibold ${pnlColor(t.pnl)}`}>
                  {t.pnl >= 0 ? '+' : ''}
                  {fmtMoney(t.pnl)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

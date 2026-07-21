'use client';

// RAPTOR Trader Utility Widget Suite — Phase 1 hub. An ACTIONABLE
// trading layer, not information cards: each widget answers "should I
// trade / what / which way / where / how much / should I hedge or
// reduce?" and carries the common Trade · Auto Hedge · Exit All
// controls. Every read reuses the platform's real engines and is an
// estimate — never a profit promise. Opens as an overlay board and as
// a standalone window; the default set matches the recommended
// twelve-widget dashboard.

import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useTradingStore } from '@/stores/trading';
import type { OHLCVBuilder } from '@/lib/trading/ohlcv-builder';
import { getInstrumentSpecs, type InstrumentSpec } from '@/lib/insights/risk';
import { correlationMatrix, currencyExposureMap, findHedges } from '@/lib/trading/hedge-engine';
import {
  buySellPressure, mtfTrendAlignment, volumeFlow, supportResistance, breakoutReversal,
  currencyStrength, riskReward, positionSize, sessionClock,
} from '@/lib/trading/widget-engines';
import WidgetControls, { type TradeContext } from '@/components/trading/widgets/WidgetControls';

const ACC = '#4DD0E1';

function Card({ title, tag, tagColor, children, ctx, accent = ACC }: {
  title: string; tag?: string; tagColor?: string; children: React.ReactNode; ctx: TradeContext; accent?: string;
}) {
  return (
    <div className="flex flex-col rounded-lg border p-2.5" style={{ borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.015)' }}>
      <div className="mb-1 flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: accent }}>{title}</span>
        {tag && <span className="ml-auto rounded px-1.5 py-0.5 text-[8px] font-bold uppercase" style={{ color: tagColor ?? '#fff', border: `1px solid ${tagColor ?? '#fff'}55` }}>{tag}</span>}
      </div>
      <div className="flex-1 text-[10px] leading-relaxed text-white/60">{children}</div>
      <WidgetControls ctx={ctx} accent={accent} />
    </div>
  );
}

const Row = ({ k, v, c }: { k: string; v: string; c?: string }) => (
  <div className="flex items-center justify-between"><span className="text-white/40">{k}</span><span className="font-mono" style={{ color: c ?? 'rgba(255,255,255,0.75)' }}>{v}</span></div>
);

export default function WidgetHub({ open, onClose, ohlcvBuilder, standalone = false }: {
  open: boolean; onClose: () => void; ohlcvBuilder: OHLCVBuilder | null; standalone?: boolean;
}) {
  const { activeSymbol, prices, positions, accountSummary } = useTradingStore();
  const [specs, setSpecs] = useState<Record<string, InstrumentSpec> | null>(null);
  const [tick, setTick] = useState(0);
  const [riskPct, setRiskPct] = useState(0.5);
  const builderRef = useRef(ohlcvBuilder);
  builderRef.current = ohlcvBuilder;

  useEffect(() => { getInstrumentSpecs().then(setSpecs).catch(() => {}); }, []);
  useEffect(() => { if (!open && !standalone) return; const id = setInterval(() => setTick((t) => t + 1), 5000); return () => clearInterval(id); }, [open, standalone]);

  const universe = useMemo(() => Object.keys(prices).filter((s) => prices[s]?.bid != null), [prices]);
  const balance = Number(accountSummary?.balance ?? 0);

  const reads = useMemo(() => {
    const b = builderRef.current;
    if (!b) return null;
    const sym = activeSymbol;
    const spec = specs?.[sym];
    const sr = supportResistance(b, sym);
    const buyDir = sr ? (Math.abs((sr.price - sr.immediateSupport)) < Math.abs(sr.immediateResistance - sr.price) ? 'BUY' : 'SELL') : 'BUY';
    const entry = sr?.price ?? (prices[sym]?.bid ?? 0);
    const stop = sr ? (buyDir === 'BUY' ? sr.immediateSupport : sr.immediateResistance) : entry;
    const target = sr ? (buyDir === 'BUY' ? sr.immediateResistance : sr.immediateSupport) : entry;
    const t = prices[sym];
    const spreadPips = t?.bid != null && t?.ask != null ? (t.ask - t.bid) * (spec?.pricescale ?? 100000) : null;
    return {
      sym, spec, sr, entry, stop, target, buyDir: buyDir as 'BUY' | 'SELL',
      pressure: buySellPressure(b, sym, '60', t),
      mtf: mtfTrendAlignment(b, sym),
      vol: volumeFlow(b, sym, '60'),
      brk: breakoutReversal(b, sym),
      strength: currencyStrength(b, universe),
      rr: riskReward({ symbol: sym, entry, stop, target, lots: 0.01, spec, spreadPips }),
      size: positionSize({ balance, riskPct, entry, stop, spec }),
      corr: correlationMatrix(b, universe.slice(0, 10)),
      hedges: specs ? findHedges(b, { primary: sym, direction: buyDir as 'BUY' | 'SELL', lots: 0.1, hedgePct: 0.5 }, universe, specs, prices) : { viable: [], rejected: [] },
      exposure: specs ? currencyExposureMap(positions, specs) : [],
      session: sessionClock(Date.now()),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSymbol, specs, universe.length, tick, riskPct, balance]);

  if (!open && !standalone) return null;

  const body = (
    <div className={`w-full ${standalone ? '' : 'my-4 max-w-[1180px]'} rounded-xl border shadow-2xl`} style={{ backgroundColor: '#080D16', borderColor: 'rgba(77,208,225,0.35)' }}>
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <span className="flex items-center gap-2 text-[15px] font-bold text-white">🧩 Trader Widget Suite</span>
        <span className="rounded px-2 py-0.5 font-mono text-[10px] font-bold" style={{ backgroundColor: 'rgba(77,208,225,0.12)', color: ACC, border: '1px solid rgba(77,208,225,0.4)' }}>{activeSymbol} · {universe.length} instruments</span>
        <span className="text-[9px] text-white/40">Actionable reads over live engines — estimates, never a profit promise. Every widget carries Trade · Auto Hedge · Exit All.</span>
        <label className="ml-auto flex items-center gap-1 text-[9px] text-white/45">risk %
          <input type="number" step={0.25} value={riskPct} onChange={(e) => setRiskPct(Math.max(0.1, Number(e.target.value) || 0.1))} className="w-14 rounded bg-white/[0.06] px-1.5 py-0.5 text-right font-mono text-[10px] text-white outline-none" />
        </label>
        {!standalone && (
          <button onClick={() => window.open('/terminal/widget-suite', '_blank')} title="Open the widget board as a standalone window (new tab) — ideal for a second monitor"
            className="rounded px-2.5 py-1.5 text-[10px] font-bold transition-all hover:brightness-125" style={{ backgroundColor: 'rgba(77,208,225,0.12)', color: ACC, border: '1px solid rgba(77,208,225,0.4)' }}>⧉ Window</button>
        )}
        <button onClick={onClose} className="rounded p-1.5 text-white/40 transition-colors hover:text-white"><X size={16} /></button>
      </div>

      {!reads ? (
        <div className="p-8 text-center text-[11px] text-white/40">Collecting bar history…</div>
      ) : (
        <div className="grid gap-2.5 p-3 md:grid-cols-2 lg:grid-cols-3" style={{ maxHeight: standalone ? undefined : '78vh', overflowY: 'auto' }}>

          {/* 1 · Buy & Sell Pressure */}
          <Card title="Buy / Sell Pressure" tag={reads.pressure?.signal} tagColor={reads.pressure?.signal === 'Buy' ? '#00E5A0' : reads.pressure?.signal === 'Sell' ? '#FF5252' : '#FFB300'}
            ctx={{ symbol: reads.sym, direction: reads.pressure?.bias === 'Bullish' ? 'BUY' : reads.pressure?.bias === 'Bearish' ? 'SELL' : undefined, source: 'BuySellPressure' }}>
            {reads.pressure ? (<>
              <div className="mb-1 h-2 w-full overflow-hidden rounded" style={{ backgroundColor: 'rgba(255,82,82,0.3)' }}>
                <div className="h-full rounded" style={{ width: `${reads.pressure.buyPct}%`, backgroundColor: '#00E5A0' }} />
              </div>
              <Row k="Buy / Sell" v={`${reads.pressure.buyPct}% / ${reads.pressure.sellPct}%`} />
              <Row k="Bias · strength" v={`${reads.pressure.bias} · ${reads.pressure.strength}`} />
              <Row k="Momentum" v={`${reads.pressure.momentum > 0 ? '+' : ''}${reads.pressure.momentum}`} />
              <Row k="Spread · confidence" v={`${reads.pressure.spreadPips != null ? reads.pressure.spreadPips.toFixed(1) + 'p' : '—'} · ${reads.pressure.confidence}%`} />
            </>) : 'collecting…'}
          </Card>

          {/* 2 · Multi-TF Trend Alignment */}
          <Card title="Trend Alignment (MTF)" tag={`${reads.mtf.aligned}/5 ${reads.mtf.dominant}`} tagColor={reads.mtf.dominant === 'Bullish' ? '#00E5A0' : reads.mtf.dominant === 'Bearish' ? '#FF5252' : '#FFB300'}
            ctx={{ symbol: reads.sym, direction: reads.mtf.dominant === 'Bullish' ? 'BUY' : reads.mtf.dominant === 'Bearish' ? 'SELL' : undefined, source: 'TrendAlignment' }}>
            {reads.mtf.rows.map((r) => (
              <div key={r.tf} className="flex items-center justify-between">
                <span className="font-mono text-white/45">{r.tf}</span>
                <span style={{ color: r.direction === 'Bullish' ? '#00E5A0' : r.direction === 'Bearish' ? '#FF5252' : '#8B93A7' }}>{r.direction} · {r.strength}%</span>
                <span className="font-mono text-white/35">{r.signal}</span>
              </div>
            ))}
            {reads.mtf.conflict && <p className="mt-0.5 text-[8px]" style={{ color: '#FFB300' }}>⚠ timeframes conflict — trend trades carry extra risk</p>}
          </Card>

          {/* 3 · Volume Flow */}
          <Card title="Volume Flow" tag={reads.vol?.signal} tagColor={reads.vol?.signal.startsWith('Buy') ? '#00E5A0' : reads.vol?.signal.startsWith('Sell') ? '#FF5252' : '#FFB300'}
            ctx={{ symbol: reads.sym, source: 'VolumeFlow' }}>
            {reads.vol ? (<>
              <Row k="Relative volume" v={`${reads.vol.relative}×`} c={reads.vol.relative >= 1.5 ? '#FFB300' : undefined} />
              <Row k="Buy / Sell vol" v={`${reads.vol.buyVol} / ${reads.vol.sellVol}`} />
              <Row k="Delta · accel" v={`${reads.vol.delta > 0 ? '+' : ''}${reads.vol.delta} · ${reads.vol.acceleration > 0 ? '+' : ''}${reads.vol.acceleration}%`} />
              <p className="mt-0.5 text-[8px] text-white/35">{reads.vol.note}</p>
            </>) : 'collecting…'}
          </Card>

          {/* 4 · Support & Resistance */}
          <Card title="Support / Resistance" ctx={{ symbol: reads.sym, direction: reads.buyDir, entry: reads.entry, stop: reads.stop, target: reads.target, source: 'SupportResistance' }}>
            {reads.sr ? (<>
              <Row k="Resistance" v={`${reads.sr.immediateResistance.toFixed(5)} (+${reads.sr.distResistancePips}p)`} c="#FF5252" />
              <Row k="Price" v={reads.sr.price.toFixed(5)} c="#fff" />
              <Row k="Support" v={`${reads.sr.immediateSupport.toFixed(5)} (-${reads.sr.distSupportPips}p)`} c="#00E5A0" />
              <Row k="Pivot · prev close" v={`${reads.sr.pivot.toFixed(5)} · ${reads.sr.prevClose.toFixed(5)}`} />
              <Row k="Day H / L" v={`${reads.sr.dayHigh.toFixed(5)} / ${reads.sr.dayLow.toFixed(5)}`} />
            </>) : 'collecting…'}
          </Card>

          {/* 5 · Breakout / Reversal Probability */}
          <Card title="Breakout / Reversal" tag={reads.brk?.bias} tagColor={reads.brk?.bias === 'Bullish' ? '#00E5A0' : reads.brk?.bias === 'Bearish' ? '#FF5252' : '#FFB300'}
            ctx={{ symbol: reads.sym, direction: reads.brk?.bias === 'Bullish' ? 'BUY' : reads.brk?.bias === 'Bearish' ? 'SELL' : undefined, source: 'BreakoutReversal' }}>
            {reads.brk ? (<>
              <Row k="Breakout / hold" v={`${reads.brk.breakoutProb}% / ${reads.brk.rangeHoldProb}%`} />
              <Row k="False breakout" v={`${reads.brk.falseBreakoutProb}%`} c="#FFB300" />
              <Row k="Continuation / reversal" v={`${reads.brk.continuationProb}% / ${reads.brk.reversalProb}%`} />
              <Row k="Compression" v={`${reads.brk.compression}%`} />
              <p className="mt-0.5 text-[8px] text-white/35">{reads.brk.note}</p>
            </>) : 'collecting…'}
          </Card>

          {/* 6 · Correlation Matrix */}
          <Card title="Correlation Matrix" ctx={{ symbol: reads.sym, source: 'Correlation' }}>
            {reads.corr.symbols.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-[7px]">
                  <thead><tr className="text-white/30"><th className="pr-1"></th>{reads.corr.symbols.map((s) => <th key={s} className="px-0.5">{s.slice(0, 3)}</th>)}</tr></thead>
                  <tbody>
                    {reads.corr.symbols.map((s, i) => (
                      <tr key={s}><td className="pr-1 text-white/45">{s.slice(0, 6)}</td>
                        {reads.corr.cells[i].map((c, j) => (
                          <td key={j} className="px-0.5 text-center font-mono" style={{ color: c == null ? 'rgba(255,255,255,0.15)' : c > 0.5 ? '#00E5A0' : c < -0.5 ? '#FF5252' : 'rgba(255,255,255,0.4)' }}>
                            {c == null ? '·' : Math.round(c * 100)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : 'collecting…'}
          </Card>

          {/* 7 · Hedge Opportunity */}
          <Card title="Hedge Opportunity" tag={reads.hedges.viable.length ? 'available' : 'none'} tagColor={reads.hedges.viable.length ? '#CE93D8' : '#8B93A7'}
            ctx={{ symbol: reads.hedges.viable[0]?.symbol ?? reads.sym, direction: reads.hedges.viable[0]?.hedgeDirection, source: 'HedgeOpportunity' }} accent="#CE93D8">
            {reads.hedges.viable.length ? (() => { const h = reads.hedges.viable[0]; return (<>
              <Row k="Hedge" v={`${h.hedgeDirection} ${h.symbol}`} c="#CE93D8" />
              <Row k="Correlation" v={`${(h.corr.avg ?? 0).toFixed(2)}`} />
              <Row k="Est. exposure cut" v={`${h.reductionPct.toFixed(0)}%`} />
              <Row k="Est. cost · margin" v={`$${h.spreadCost.toFixed(2)} · $${h.marginEstimate.toFixed(0)}`} />
              <p className="mt-0.5 text-[8px] text-white/35">Fails if the correlation weakens, reverses or gaps. Never guaranteed.</p>
            </>); })() : <p className="text-[9px] text-white/40">No reliable hedge on the current correlations — the engine refuses to force a weak or costly one.</p>}
          </Card>

          {/* 8 · Risk-to-Reward */}
          <Card title="Risk-to-Reward (net)" ctx={{ symbol: reads.sym, direction: reads.buyDir, entry: reads.entry, stop: reads.stop, target: reads.target, source: 'RiskReward' }}>
            {reads.rr ? (<>
              <Row k="Entry / stop / target" v={`${reads.entry.toFixed(4)} / ${reads.stop.toFixed(4)} / ${reads.target.toFixed(4)}`} />
              <Row k="Gross R:R" v={`1:${reads.rr.grossRR}`} />
              <Row k="Net R:R (after costs)" v={`1:${reads.rr.netRR}`} c={reads.rr.netRR >= 1.5 ? '#00E5A0' : reads.rr.netRR >= 1 ? '#FFB300' : '#FF5252'} />
              <Row k="Cost estimate" v={`$${reads.rr.costCash.toFixed(2)}`} />
              <p className="mt-0.5 text-[8px] text-white/35">R:R uses live S/R levels; edit any field in the trade ticket.</p>
            </>) : 'need a valid stop distance'}
          </Card>

          {/* 9 · Position Size Calculator */}
          <Card title="Position Size" ctx={{ symbol: reads.sym, direction: reads.buyDir, entry: reads.entry, stop: reads.stop, lots: reads.size?.lot, source: 'PositionSize' }}>
            {reads.size ? (<>
              <Row k="Balance · risk" v={`$${balance.toFixed(0)} · ${riskPct}%`} />
              <Row k="Risk amount" v={`$${reads.size.riskAmount.toFixed(2)}`} />
              <Row k="Suggested lot" v={`${reads.size.lot}`} c="#00E5A0" />
              <Row k="Margin · max lot" v={`$${reads.size.margin.toFixed(0)} · ${reads.size.maxLot}`} />
              <p className="mt-0.5 text-[8px] text-white/35">{reads.size.note}. Click Trade to load this lot.</p>
            </>) : 'select an account with a balance'}
          </Card>

          {/* 10 · Portfolio Exposure */}
          <Card title="Portfolio Exposure" ctx={{ symbol: reads.sym, source: 'PortfolioExposure' }}>
            {reads.exposure.length ? reads.exposure.slice(0, 6).map((e) => (
              <Row key={e.ccy} k={e.ccy} v={`net ${e.net >= 0 ? '+' : ''}$${Math.abs(e.net).toFixed(0)} ${e.net >= 0 ? 'long' : 'short'}`} c={Math.abs(e.net) > 0 ? (e.net >= 0 ? '#00E5A0' : '#FF5252') : undefined} />
            )) : <p className="text-[9px] text-white/40">No open positions — no concentration risk.</p>}
          </Card>

          {/* 11 · Currency Strength */}
          <Card title="Currency Strength" ctx={{ symbol: reads.sym, source: 'CurrencyStrength' }}>
            {reads.strength.map((s, i) => (
              <div key={s.ccy} className="flex items-center gap-1.5">
                <span className="w-8 font-mono text-white/50">{s.ccy}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                  <div className="h-full rounded" style={{ width: `${s.strengthPct}%`, backgroundColor: i < 2 ? '#00E5A0' : i >= reads.strength.length - 2 ? '#FF5252' : 'rgba(255,255,255,0.35)' }} />
                </div>
                <span className="w-16 text-right font-mono text-white/40">{s.strengthPct}% {s.momentum === 'Rising' ? '↑' : s.momentum === 'Falling' ? '↓' : '·'}</span>
              </div>
            ))}
            <p className="mt-0.5 text-[8px] text-white/35">Strongest vs weakest = cleanest trend pair.</p>
          </Card>

          {/* 12 · Session Clock + Daily Guard */}
          <Card title="Session · Daily Guard" tag={reads.session.liquidity} tagColor={reads.session.liquidity.startsWith('Peak') ? '#00E5A0' : reads.session.liquidity === 'High' ? '#4DD0E1' : '#FFB300'}
            ctx={{ symbol: reads.sym, source: 'SessionGuard' }}>
            {reads.session.sessions.map((s) => (
              <Row key={s.name} k={s.name} v={s.open ? `open · ${Math.floor(s.minsLeft / 60)}h ${s.minsLeft % 60}m left` : 'closed'} c={s.open ? '#00E5A0' : 'rgba(255,255,255,0.3)'} />
            ))}
            <div className="mt-1 border-t pt-1" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <Row k="Equity · balance" v={`$${Number(accountSummary?.equity ?? 0).toFixed(0)} · $${balance.toFixed(0)}`} />
              <Row k="Free margin" v={`$${Number(accountSummary?.free_margin ?? 0).toFixed(0)}`} />
            </div>
          </Card>

        </div>
      )}
      <p className="border-t px-4 py-2 text-[8px] leading-relaxed text-white/25" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        Phase 1 of the widget suite (the recommended 12-widget dashboard). Every widget is actionable and routes trades through Shield → Guardian → the
        account Risk Governor; Auto Hedge is always a toggle with disclaimer + consent and never activates silently. Reads are estimates over
        {universe.length ? ' live' : ' loading'} platform data — never a profit promise. More widgets from the suite arrive in later phases into this same board.
      </p>
    </div>
  );

  if (standalone) return body;

  return (
    <div className="fixed inset-0 z-[9500] flex items-start justify-center overflow-y-auto p-4" style={{ backgroundColor: 'rgba(3,7,12,0.88)', backdropFilter: 'blur(3px)' }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      {body}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// RAPTOR Widget Engines — pure compute for the Trader Utility Widget
// Suite. Every function reuses the platform's EXISTING engines
// (market-state, entry-exit, indicators, hedge-engine, scanner) so a
// widget never invents data it doesn't have. All reads are estimates
// over live/simulated bars — never certainty, never a profit promise.
//
// No side effects, no execution — widgets read from here and the
// shared controls (WidgetControls) route any action through the
// normal order path (Shield → Guardian → account Risk Governor).
// ═══════════════════════════════════════════════════════════════

import type { OHLCVBuilder, Resolution } from '@/lib/trading/ohlcv-builder';
import type { OHLCVBar } from '@/types/trading';
import { classifyMarketState } from '@/lib/nexus/market-state';
import { atr } from '@/lib/trading/indicators';
import { getPipSize } from '@/lib/trading/ticket-math';
import { valuePerUnitPerLot, type InstrumentSpec } from '@/lib/insights/risk';

export interface Tick { bid?: number; ask?: number }
export type Ticks = Record<string, Tick | undefined>;

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

// ── 1 · Buy / Sell Pressure ─────────────────────────────────────

export interface PressureRead {
  buyPct: number; sellPct: number;
  bias: 'Bullish' | 'Bearish' | 'Neutral';
  strength: 'Weak' | 'Moderate' | 'Strong';
  buyVol: number; sellVol: number; imbalance: number;
  momentum: number;            // -100..100
  spreadPips: number | null;
  confidence: number;          // 0-100
  signal: 'Buy' | 'Sell' | 'Wait';
}

export function buySellPressure(builder: OHLCVBuilder, symbol: string, res: Resolution, tick?: Tick): PressureRead | null {
  const bars = builder.getAllBars(symbol, res);
  if (bars.length < 20) return null;
  const recent = bars.slice(-30);
  let buyVol = 0, sellVol = 0, bodyMom = 0;
  for (const b of recent) {
    const body = b.close - b.open;
    const range = Math.max(1e-9, b.high - b.low);
    const w = b.volume > 0 ? b.volume : 1;
    if (b.close >= b.open) buyVol += w; else sellVol += w;
    bodyMom += (body / range) * w;
  }
  const total = buyVol + sellVol || 1;
  const buyPct = Math.round((buyVol / total) * 100);
  const sellPct = 100 - buyPct;
  const imbalance = buyVol - sellVol;
  const momentum = clamp(Math.round((bodyMom / total) * 200), -100, 100);
  const bias = buyPct >= 58 ? 'Bullish' : buyPct <= 42 ? 'Bearish' : 'Neutral';
  const spread = tick?.bid != null && tick?.ask != null ? (tick.ask - tick.bid) / getPipSize(symbol) : null;
  const dist = Math.abs(buyPct - 50);
  const strength = dist >= 18 ? 'Strong' : dist >= 8 ? 'Moderate' : 'Weak';
  const confidence = clamp(40 + dist * 2 + Math.abs(momentum) * 0.2);
  const signal: PressureRead['signal'] = bias === 'Bullish' && strength !== 'Weak' ? 'Buy'
    : bias === 'Bearish' && strength !== 'Weak' ? 'Sell' : 'Wait';
  return { buyPct, sellPct, bias, strength, buyVol: Math.round(buyVol), sellVol: Math.round(sellVol), imbalance: Math.round(imbalance), momentum, spreadPips: spread, confidence, signal };
}

// ── 2 · Multi-Timeframe Trend Alignment ─────────────────────────

export interface MtfRow { tf: string; res: Resolution; direction: 'Bullish' | 'Bearish' | 'Neutral'; strength: number; momentum: string; volatility: string; signal: 'Buy' | 'Sell' | 'Wait' }
export interface MtfRead { rows: MtfRow[]; aligned: number; dominant: 'Bullish' | 'Bearish' | 'Mixed'; conflict: boolean }

const MTF_TFS: { tf: string; res: Resolution }[] = [
  { tf: '1m', res: '1' }, { tf: '5m', res: '5' }, { tf: '15m', res: '15' }, { tf: '1h', res: '60' }, { tf: '4h', res: '240' },
];

export function mtfTrendAlignment(builder: OHLCVBuilder, symbol: string): MtfRead {
  const rows: MtfRow[] = [];
  for (const t of MTF_TFS) {
    const st = classifyMarketState(builder.getAllBars(symbol, t.res));
    const direction: MtfRow['direction'] = !st ? 'Neutral' : st.state.includes('Uptrend') ? 'Bullish' : st.state.includes('Downtrend') ? 'Bearish' : 'Neutral';
    rows.push({
      tf: t.tf, res: t.res, direction,
      strength: st?.confidence ?? 0,
      momentum: st ? (st.state.includes('Strong') ? 'Strong' : direction === 'Neutral' ? 'Weak' : 'Rising') : '—',
      volatility: st?.volatility?.replace(' Volatility', '') ?? '—',
      signal: direction === 'Bullish' ? 'Buy' : direction === 'Bearish' ? 'Sell' : 'Wait',
    });
  }
  const bulls = rows.filter((r) => r.direction === 'Bullish').length;
  const bears = rows.filter((r) => r.direction === 'Bearish').length;
  const dominant = bulls > bears ? 'Bullish' : bears > bulls ? 'Bearish' : 'Mixed';
  const aligned = Math.max(bulls, bears);
  return { rows, aligned, dominant, conflict: bulls > 0 && bears > 0 };
}

// ── 3 · Volume Flow ─────────────────────────────────────────────

export interface VolumeRead {
  current: number; average: number; relative: number;
  buyVol: number; sellVol: number; delta: number;
  spike: boolean; acceleration: number;
  signal: 'Buy on flow' | 'Sell on flow' | 'Wait';
  note: string;
}

export function volumeFlow(builder: OHLCVBuilder, symbol: string, res: Resolution): VolumeRead | null {
  const bars = builder.getAllBars(symbol, res);
  if (bars.length < 25) return null;
  const window = bars.slice(-20);
  const avg = window.reduce((a, b) => a + (b.volume || 1), 0) / window.length;
  const current = bars[bars.length - 1].volume || 1;
  const relative = avg > 0 ? current / avg : 1;
  let buyVol = 0, sellVol = 0;
  for (const b of window) { if (b.close >= b.open) buyVol += b.volume || 1; else sellVol += b.volume || 1; }
  const delta = buyVol - sellVol;
  const prev = bars.slice(-6, -3).reduce((a, b) => a + (b.volume || 1), 0) / 3;
  const last3 = bars.slice(-3).reduce((a, b) => a + (b.volume || 1), 0) / 3;
  const acceleration = prev > 0 ? Math.round(((last3 - prev) / prev) * 100) : 0;
  const spike = relative >= 1.8;
  const signal: VolumeRead['signal'] = delta > 0 && relative >= 1.2 ? 'Buy on flow' : delta < 0 && relative >= 1.2 ? 'Sell on flow' : 'Wait';
  const note = spike ? 'volume spike — confirm direction before chasing' : relative < 0.7 ? 'thin volume — moves lack conviction' : 'volume within normal range';
  return { current: Math.round(current), average: Math.round(avg), relative: Math.round(relative * 100) / 100, buyVol: Math.round(buyVol), sellVol: Math.round(sellVol), delta: Math.round(delta), spike, acceleration, signal, note };
}

// ── 4 · Support & Resistance ────────────────────────────────────

export interface SRRead {
  price: number;
  immediateSupport: number; strongSupport: number;
  immediateResistance: number; strongResistance: number;
  dayHigh: number; dayLow: number; prevClose: number; pivot: number;
  distSupportPips: number; distResistancePips: number;
}

function swings(bars: OHLCVBar[], lookback: number): { highs: number[]; lows: number[] } {
  const highs: number[] = [], lows: number[] = [];
  const w = bars.slice(-lookback);
  for (let i = 2; i < w.length - 2; i++) {
    if (w[i].high > w[i - 1].high && w[i].high > w[i - 2].high && w[i].high > w[i + 1].high && w[i].high > w[i + 2].high) highs.push(w[i].high);
    if (w[i].low < w[i - 1].low && w[i].low < w[i - 2].low && w[i].low < w[i + 1].low && w[i].low < w[i + 2].low) lows.push(w[i].low);
  }
  return { highs, lows };
}

export function supportResistance(builder: OHLCVBuilder, symbol: string): SRRead | null {
  const h1 = builder.getAllBars(symbol, '60');
  const d1 = builder.getAllBars(symbol, '1D');
  if (h1.length < 30 || d1.length < 2) return null;
  const price = h1[h1.length - 1].close;
  const pip = getPipSize(symbol);
  const { highs, lows } = swings(h1, 120);
  const resAbove = highs.filter((x) => x > price).sort((a, b) => a - b);
  const supBelow = lows.filter((x) => x < price).sort((a, b) => b - a);
  const day = d1[d1.length - 1]; const prevDay = d1[d1.length - 2];
  const pivot = (prevDay.high + prevDay.low + prevDay.close) / 3;
  const immediateResistance = resAbove[0] ?? day.high;
  const strongResistance = resAbove[1] ?? day.high;
  const immediateSupport = supBelow[0] ?? day.low;
  const strongSupport = supBelow[1] ?? day.low;
  return {
    price, immediateSupport, strongSupport, immediateResistance, strongResistance,
    dayHigh: day.high, dayLow: day.low, prevClose: prevDay.close, pivot,
    distSupportPips: Math.round(Math.abs(price - immediateSupport) / pip),
    distResistancePips: Math.round(Math.abs(immediateResistance - price) / pip),
  };
}

// ── 5 · Breakout / Reversal Probability ─────────────────────────

export interface BreakoutRead {
  breakoutProb: number; falseBreakoutProb: number; rangeHoldProb: number;
  reversalProb: number; continuationProb: number;
  bias: 'Bullish' | 'Bearish' | 'Neutral';
  compression: number;         // 0-100 (higher = tighter coil)
  note: string;
}

export function breakoutReversal(builder: OHLCVBuilder, symbol: string): BreakoutRead | null {
  const bars = builder.getAllBars(symbol, '60');
  if (bars.length < 60) return null;
  const st = classifyMarketState(bars);
  const highs = bars.map((b) => b.high), lows = bars.map((b) => b.low), closes = bars.map((b) => b.close);
  const atrSeries = atr(highs, lows, closes, 14);
  const a = Number(atrSeries[atrSeries.length - 1] ?? 0);
  const recentRange = Math.max(...highs.slice(-20)) - Math.min(...lows.slice(-20));
  const priorRange = Math.max(...highs.slice(-50, -20)) - Math.min(...lows.slice(-50, -20));
  const compression = clamp(Math.round((1 - recentRange / Math.max(1e-9, priorRange)) * 100 + 50));
  const trending = !!st && (st.state.includes('Uptrend') || st.state.includes('Downtrend'));
  const bias: BreakoutRead['bias'] = st?.state.includes('Uptrend') ? 'Bullish' : st?.state.includes('Downtrend') ? 'Bearish' : 'Neutral';
  const breakoutProb = clamp(Math.round((trending ? 55 : 40) + compression * 0.25));
  const rangeHoldProb = clamp(100 - breakoutProb - 10);
  const falseBreakoutProb = clamp(Math.round((trending ? 25 : 40)));
  const continuationProb = clamp(trending ? (st!.confidence * 0.7 + 20) : 40);
  const reversalProb = clamp(100 - continuationProb);
  const note = compression >= 70 ? `${a > 0 ? 'coiled' : 'quiet'} — expansion likely; wait for a confirmed close beyond the range`
    : trending ? 'trending — continuation favoured over reversal' : 'no clean edge — range-hold most likely';
  return { breakoutProb, falseBreakoutProb, rangeHoldProb, reversalProb, continuationProb, bias, compression, note };
}

// ── 6 · Currency Strength ───────────────────────────────────────

const G8 = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD'];

export interface StrengthRow { ccy: string; strengthPct: number; momentum: 'Rising' | 'Falling' | 'Stable' }

export function currencyStrength(builder: OHLCVBuilder, universe: string[]): StrengthRow[] {
  const raw: Record<string, number[]> = {};
  for (const c of G8) raw[c] = [];
  for (const sym of universe) {
    const bars = builder.getAllBars(sym, '60');
    if (bars.length < 25) continue;
    const [base, quote] = [sym.slice(0, 3), sym.slice(3, 6)];
    if (!G8.includes(base) || !G8.includes(quote)) continue;
    const older = bars[bars.length - 24].close, now = bars[bars.length - 1].close;
    if (!(older > 0)) continue;
    const chg = (now - older) / older * 100;
    raw[base].push(chg);
    raw[quote].push(-chg);
  }
  const scores = G8.map((c) => ({ ccy: c, avg: raw[c].length ? raw[c].reduce((a, b) => a + b, 0) / raw[c].length : 0 }));
  const vals = scores.map((s) => s.avg);
  const min = Math.min(...vals), max = Math.max(...vals), span = Math.max(1e-9, max - min);
  return scores
    .map((s) => ({ ccy: s.ccy, strengthPct: Math.round(((s.avg - min) / span) * 100), momentum: (s.avg > 0.05 ? 'Rising' : s.avg < -0.05 ? 'Falling' : 'Stable') as StrengthRow['momentum'] }))
    .sort((a, b) => b.strengthPct - a.strengthPct);
}

// ── 7 · Risk-to-Reward (after costs) ────────────────────────────

export interface RRRead { grossRR: number; netRR: number; riskCash: number; rewardCash: number; costCash: number }

export function riskReward(params: { symbol: string; entry: number; stop: number; target: number; lots: number; spec: InstrumentSpec | undefined; spreadPips: number | null; commissionPerLot?: number }): RRRead | null {
  const { symbol, entry, stop, target, lots, spec, spreadPips } = params;
  if (!spec || !(entry > 0) || !(Math.abs(entry - stop) > 0)) return null;
  const vpu = valuePerUnitPerLot(spec);
  const riskCash = Math.abs(entry - stop) * lots * vpu;
  const rewardCash = Math.abs(target - entry) * lots * vpu;
  const pip = getPipSize(symbol);
  const spreadCash = (spreadPips ?? 1) * pip * lots * vpu;
  const commission = (params.commissionPerLot ?? 3.5) * lots;
  const costCash = spreadCash + commission;
  const grossRR = riskCash > 0 ? rewardCash / riskCash : 0;
  const netRR = riskCash > 0 ? Math.max(0, (rewardCash - costCash) / (riskCash + costCash)) : 0;
  return { grossRR: Math.round(grossRR * 100) / 100, netRR: Math.round(netRR * 100) / 100, riskCash, rewardCash, costCash };
}

// ── 8 · Position Size Calculator ────────────────────────────────

export interface SizeRead { lot: number; riskAmount: number; stopDistance: number; margin: number; maxLot: number; note: string }

export function positionSize(params: { balance: number; riskPct: number; entry: number; stop: number; spec: InstrumentSpec | undefined; leverage?: number }): SizeRead | null {
  const { balance, riskPct, entry, stop, spec } = params;
  if (!spec || !(balance > 0) || !(Math.abs(entry - stop) > 0)) return null;
  const vpu = valuePerUnitPerLot(spec);
  const stopDistance = Math.abs(entry - stop);
  const riskAmount = balance * riskPct / 100;
  const lossPerLot = stopDistance * vpu;
  let lot = lossPerLot > 0 ? riskAmount / lossPerLot : 0.01;
  lot = Math.floor(lot * 100) / 100;                        // always round DOWN
  const maxLot = Math.floor((balance / 200) * 100) / 100;   // rough exposure ceiling
  lot = Math.max(0.01, Math.min(lot, maxLot));
  const leverage = params.leverage ?? 500;
  const margin = (lot * spec.contractSize * entry) / leverage;
  return { lot, riskAmount: Math.round(riskAmount * 100) / 100, stopDistance, margin: Math.round(margin * 100) / 100, maxLot, note: 'lot always rounded down to protect the risk budget' };
}

// ── 12 · Session Clock ──────────────────────────────────────────

export interface SessionRead { active: string[]; sessions: { name: string; open: boolean; minsLeft: number }[]; liquidity: string }

// Server/UTC session windows (approx.): Sydney 21-06, Tokyo 00-09, London 07-16, New York 12-21 UTC.
const SESSIONS = [
  { name: 'Sydney', start: 21, end: 6 },
  { name: 'Tokyo', start: 0, end: 9 },
  { name: 'London', start: 7, end: 16 },
  { name: 'New York', start: 12, end: 21 },
];

export function sessionClock(nowMs: number): SessionRead {
  const h = new Date(nowMs).getUTCHours() + new Date(nowMs).getUTCMinutes() / 60;
  const inWindow = (s: number, e: number) => s < e ? (h >= s && h < e) : (h >= s || h < e);
  const sessions = SESSIONS.map((s) => {
    const open = inWindow(s.start, s.end);
    const endH = s.end;
    let minsLeft = 0;
    if (open) { const untilEnd = ((endH - h) + 24) % 24; minsLeft = Math.round(untilEnd * 60); }
    return { name: s.name, open, minsLeft };
  });
  const active = sessions.filter((s) => s.open).map((s) => s.name);
  const overlap = active.includes('London') && active.includes('New York');
  const liquidity = overlap ? 'Peak (London–NY overlap)' : active.includes('London') || active.includes('New York') ? 'High' : active.includes('Tokyo') ? 'Moderate' : 'Thin';
  return { active, sessions, liquidity };
}

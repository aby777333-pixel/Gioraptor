// ═══════════════════════════════════════════════════════════════
// Raptor AI Correlation Hedging Engine — the math core.
// Pure functions over REAL platform bars and the trader's live positions.
// Nothing is hard-coded: every correlation is computed from aligned bar
// returns at multiple timeframes, with stability/confidence scoring and an
// honest "no reliable hedge" verdict when the data doesn't support one.
//
// Honesty contract (§17): a hedge is never risk-free. Correlations weaken,
// reverse and break; hedging adds spread/commission/swap/margin/execution
// risk. All outputs are ESTIMATES and are labelled as such in the UI.
// ═══════════════════════════════════════════════════════════════

import type { OHLCVBar } from '@/types/trading';
import type { OHLCVBuilder, Resolution } from '@/lib/trading/ohlcv-builder';
import { valuePerUnitPerLot, type InstrumentSpec } from '@/lib/insights/risk';
import { atr } from '@/lib/trading/indicators';
import { symbolCurrencies } from '@/lib/trading/protection';

// ── Correlation windows (rolling, real bars) ────────────────────

export interface CorrWindow { label: string; res: Resolution; maxReturns: number }

export const CORR_WINDOWS: CorrWindow[] = [
  { label: 'M5',  res: '5',   maxReturns: 288 },  // ~24h
  { label: 'M15', res: '15',  maxReturns: 192 },  // ~48h
  { label: 'H1',  res: '60',  maxReturns: 168 },  // ~1w
  { label: 'H4',  res: '240', maxReturns: 180 },  // ~1mo
  { label: 'D1',  res: '1D',  maxReturns: 90 },   // ~1 quarter
];

function alignedReturns(a: OHLCVBar[], b: OHLCVBar[], maxN: number): [number[], number[]] {
  const mapB = new Map<number, number>();
  for (const bar of b) mapB.set(bar.time, bar.close);
  const ra: number[] = []; const rb: number[] = [];
  let prevA: number | null = null; let prevB: number | null = null;
  for (const bar of a) {
    const closeB = mapB.get(bar.time);
    if (closeB == null) continue;
    if (prevA != null && prevB != null && prevA > 0 && prevB > 0) {
      ra.push(Math.log(bar.close / prevA));
      rb.push(Math.log(closeB / prevB));
    }
    prevA = bar.close; prevB = closeB;
  }
  return [ra.slice(-maxN), rb.slice(-maxN)];
}

export function pearson(x: number[], y: number[]): number | null {
  const n = Math.min(x.length, y.length);
  if (n < 30) return null; // too few samples to say anything honest
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += x[i]; sy += y[i]; sxx += x[i] * x[i]; syy += y[i] * y[i]; sxy += x[i] * y[i];
  }
  const cov = sxy - (sx * sy) / n;
  const vx = sxx - (sx * sx) / n;
  const vy = syy - (sy * sy) / n;
  if (vx <= 0 || vy <= 0) return null;
  return Math.max(-1, Math.min(1, cov / Math.sqrt(vx * vy)));
}

export interface CorrelationRead {
  perWindow: { label: string; corr: number | null; n: number }[];
  avg: number | null;          // weighted average of computable windows
  stability: number;           // 0–1: 1 = windows agree tightly
  trend: 'stable' | 'strengthening' | 'weakening' | 'reversing';
  breaking: boolean;           // recent H1 corr diverges hard from D1 history
  confidence: number;          // 0–100
  label: string;               // human label incl. reliability
  labelColor: string;
}

export function correlationRead(
  builder: OHLCVBuilder, primary: string, candidate: string,
): CorrelationRead {
  const perWindow = CORR_WINDOWS.map((w) => {
    const [ra, rb] = alignedReturns(builder.getAllBars(primary, w.res), builder.getAllBars(candidate, w.res), w.maxReturns);
    return { label: w.label, corr: pearson(ra, rb), n: ra.length };
  });
  const usable = perWindow.filter((w) => w.corr != null) as { label: string; corr: number; n: number }[];
  if (!usable.length) {
    return { perWindow, avg: null, stability: 0, trend: 'stable', breaking: false, confidence: 0, label: 'Unreliable Relationship', labelColor: '#8B93A7' };
  }
  const avg = usable.reduce((a, w) => a + w.corr, 0) / usable.length;
  const spread = Math.sqrt(usable.reduce((a, w) => a + (w.corr - avg) ** 2, 0) / usable.length);
  const stability = Math.max(0, 1 - spread / 0.5);

  // Trend: short-horizon (M5/M15/H1 avg) vs long-horizon (H4/D1 avg).
  const shortW = usable.filter((w) => ['M5', 'M15', 'H1'].includes(w.label));
  const longW = usable.filter((w) => ['H4', 'D1'].includes(w.label));
  let trend: CorrelationRead['trend'] = 'stable';
  let breaking = false;
  if (shortW.length && longW.length) {
    const s = shortW.reduce((a, w) => a + w.corr, 0) / shortW.length;
    const l = longW.reduce((a, w) => a + w.corr, 0) / longW.length;
    if (Math.sign(s) !== Math.sign(l) && Math.abs(l) > 0.3 && Math.abs(s) > 0.2) { trend = 'reversing'; breaking = true; }
    else if (Math.abs(s) > Math.abs(l) + 0.15) trend = 'strengthening';
    else if (Math.abs(s) < Math.abs(l) - 0.15) { trend = 'weakening'; breaking = Math.abs(l) - Math.abs(s) > 0.35; }
  }

  const sampleScore = Math.min(1, usable.length / CORR_WINDOWS.length);
  const confidence = Math.round(Math.abs(avg) * 55 + stability * 30 + sampleScore * 15);

  let label: string; let labelColor: string;
  const a = Math.abs(avg);
  if (breaking) { label = 'Correlation Breaking'; labelColor = '#FF7043'; }
  else if (stability < 0.35) { label = 'Unreliable Relationship'; labelColor = '#8B93A7'; }
  else if (a >= 0.7) { label = avg > 0 ? 'Strong Positive Correlation' : 'Strong Negative Correlation'; labelColor = avg > 0 ? '#00C27A' : '#FF5252'; }
  else if (a >= 0.4) { label = avg > 0 ? 'Moderate Positive Correlation' : 'Moderate Negative Correlation'; labelColor = avg > 0 ? '#9CCC65' : '#FF8A65'; }
  else { label = 'Weak Correlation'; labelColor = '#8B93A7'; }

  return { perWindow, avg, stability, trend, breaking, confidence, label, labelColor };
}

// ── Volatility (ATR% on H1) ─────────────────────────────────────

export function atrRead(builder: OHLCVBuilder, symbol: string): { atr: number; price: number; atrPct: number } | null {
  const bars = builder.getAllBars(symbol, '60');
  if (bars.length < 20) return null;
  const series = atr(bars.map((b) => b.high), bars.map((b) => b.low), bars.map((b) => b.close), 14).filter((v): v is number => v != null);
  const a = series[series.length - 1];
  const price = bars[bars.length - 1].close;
  if (!a || !(price > 0)) return null;
  return { atr: a, price, atrPct: (a / price) * 100 };
}

// ── Hedge candidate assessment ──────────────────────────────────

export interface HedgeCandidate {
  symbol: string;
  corr: CorrelationRead;
  hedgeDirection: 'BUY' | 'SELL';       // direction that OFFSETS the primary
  suggestedLots: number;
  rawRatio: number;                     // notional-based ratio
  volAdjRatio: number;                  // ATR-adjusted ratio
  finalRatio: number;                   // corr × vol adjusted
  riskBefore: number;                   // primary 1×ATR move, account $
  riskAfter: number;                    // combined estimate, account $
  reductionPct: number;                 // estimated drawdown reduction
  spreadCost: number;                   // hedge leg entry spread, $
  marginEstimate: number;               // hedge leg margin at 1:500, $
  sharedCurrencies: string[];
  viable: boolean;
  reasons: string[];                    // honest notes incl. failure risks
}

export interface HedgeInputs {
  primary: string;
  direction: 'BUY' | 'SELL';
  lots: number;
  hedgePct: number;                     // 0.25 / 0.5 / 0.75 / 1 / custom
}

export function assessCandidate(
  builder: OHLCVBuilder,
  inputs: HedgeInputs,
  candidate: string,
  specs: Record<string, InstrumentSpec>,
  ticks: Record<string, { bid?: number; ask?: number } | undefined>,
): HedgeCandidate | null {
  if (candidate === inputs.primary) return null;
  const specP = specs[inputs.primary]; const specH = specs[candidate];
  const volP = atrRead(builder, inputs.primary); const volH = atrRead(builder, candidate);
  if (!specP || !specH || !volP || !volH) return null;
  const corr = correlationRead(builder, inputs.primary, candidate);
  if (corr.avg == null) return null;

  // Offset direction: positive correlation → trade the candidate opposite
  // the primary; negative correlation → trade it the same way.
  const hedgeDirection: 'BUY' | 'SELL' = corr.avg >= 0
    ? (inputs.direction === 'BUY' ? 'SELL' : 'BUY')
    : inputs.direction;

  const vpuP = valuePerUnitPerLot(specP); const vpuH = valuePerUnitPerLot(specH);
  const atrDollarPerLotP = volP.atr * vpuP;   // $ move of one 1×ATR swing per lot
  const atrDollarPerLotH = volH.atr * vpuH;
  if (!(atrDollarPerLotH > 0)) return null;

  const primaryAtrDollar = atrDollarPerLotP * inputs.lots;
  const rawRatio = (volP.price * specP.contractSize) > 0 ? (volH.price * specH.contractSize) / (volP.price * specP.contractSize) : 0;
  const volAdjRatio = atrDollarPerLotP / atrDollarPerLotH;
  const finalRatio = volAdjRatio * Math.abs(corr.avg);
  const suggestedLots = Math.max(0.01, Math.round(inputs.lots * inputs.hedgePct * finalRatio * 100) / 100);

  const hedgeAtrDollar = atrDollarPerLotH * suggestedLots;
  // Combined 1×ATR risk with the offsetting direction: cross term reduces it
  // by |ρ| — an estimate that DEGRADES if the correlation weakens.
  const riskAfter = Math.sqrt(Math.max(0,
    primaryAtrDollar ** 2 + hedgeAtrDollar ** 2 - 2 * Math.abs(corr.avg) * primaryAtrDollar * hedgeAtrDollar));
  const reductionPct = primaryAtrDollar > 0 ? Math.max(0, (1 - riskAfter / primaryAtrDollar) * 100) : 0;

  const t = ticks[candidate];
  const spreadCost = t?.bid != null && t?.ask != null ? (t.ask - t.bid) * vpuH * suggestedLots : 0;
  const marginEstimate = (suggestedLots * specH.contractSize * volH.price) / 500;

  const ccyP = symbolCurrencies(inputs.primary);
  const sharedCurrencies = symbolCurrencies(candidate).filter((c) => ccyP.includes(c));

  const reasons: string[] = [];
  const viable = Math.abs(corr.avg) >= 0.5 && corr.stability >= 0.35 && !corr.breaking;
  if (Math.abs(corr.avg) < 0.5) reasons.push('correlation too weak to hedge reliably');
  if (corr.stability < 0.35) reasons.push('correlation unstable across timeframes');
  if (corr.breaking) reasons.push('relationship is breaking/reversing right now');
  if (viable) {
    reasons.push(`${corr.label.toLowerCase()} (avg ${corr.avg.toFixed(2)}, stability ${(corr.stability * 100).toFixed(0)}%)`);
    if (sharedCurrencies.length) reasons.push(`shares ${sharedCurrencies.join('/')} exposure with ${inputs.primary}`);
    reasons.push('fails if the correlation weakens, reverses or gaps through news');
  }

  return {
    symbol: candidate, corr, hedgeDirection, suggestedLots,
    rawRatio, volAdjRatio, finalRatio,
    riskBefore: primaryAtrDollar, riskAfter, reductionPct,
    spreadCost, marginEstimate, sharedCurrencies, viable, reasons,
  };
}

/** Rank all candidates for a primary. Returns viable hedges best-first,
 *  plus the non-viable rest (for transparency). */
export function findHedges(
  builder: OHLCVBuilder,
  inputs: HedgeInputs,
  universe: string[],
  specs: Record<string, InstrumentSpec>,
  ticks: Record<string, { bid?: number; ask?: number } | undefined>,
): { viable: HedgeCandidate[]; rejected: HedgeCandidate[] } {
  const all = universe
    .map((s) => assessCandidate(builder, inputs, s, specs, ticks))
    .filter((c): c is HedgeCandidate => c != null);
  const viable = all.filter((c) => c.viable)
    .sort((a, b) => (b.reductionPct * b.corr.confidence) - (a.reductionPct * a.corr.confidence));
  const rejected = all.filter((c) => !c.viable)
    .sort((a, b) => Math.abs(b.corr.avg ?? 0) - Math.abs(a.corr.avg ?? 0));
  return { viable, rejected };
}

// ── Currency exposure map (§7) ──────────────────────────────────

export interface ExposureRow { ccy: string; long: number; short: number; net: number }

export function currencyExposureMap(
  positions: { symbol: string; direction: string; size: number; open_price: number; status: string }[],
  specs: Record<string, InstrumentSpec>,
): ExposureRow[] {
  const map = new Map<string, { long: number; short: number }>();
  for (const p of positions) {
    if (p.status !== 'open') continue;
    const spec = specs[p.symbol];
    if (!spec) continue;
    const notional = Number(p.size) * spec.contractSize * Number(p.open_price);
    const ccys = symbolCurrencies(p.symbol);
    const isBuy = p.direction.toUpperCase() === 'BUY';
    // Base currency: long if buying; quote currency: the opposite side.
    ccys.forEach((c, i) => {
      const entry = map.get(c) ?? { long: 0, short: 0 };
      const longSide = i === 0 ? isBuy : !isBuy;
      if (longSide) entry.long += notional; else entry.short += notional;
      map.set(c, entry);
    });
  }
  return [...map.entries()]
    .map(([ccy, v]) => ({ ccy, long: v.long, short: v.short, net: v.long - v.short }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
}

// ── Hedge groups (combined position view, §11) ──────────────────

export interface HedgeGroup {
  id: string;
  name: string;
  primaryPositionId: string;
  hedgePositionId: string;
  primarySymbol: string;
  hedgeSymbol: string;
  corrAtEntry: number;
  createdAt: number;
  record: Record<string, unknown>;      // full downloadable audit record
}

const GROUPS_KEY = 'raptor_hedge_groups_v1';

export function loadHedgeGroups(): HedgeGroup[] {
  try { return JSON.parse(localStorage.getItem(GROUPS_KEY) || '[]'); } catch { return []; }
}

export function saveHedgeGroups(groups: HedgeGroup[]): void {
  try { localStorage.setItem(GROUPS_KEY, JSON.stringify(groups.slice(-40))); } catch { /* ignore */ }
}

// ═══════════════════════════════════════════════════════════════
// GIO4X RAPTOR — EA runtime
//
// Web-native execution engine for the EA library. Each attached EA
// evaluates its strategy on the platform's own OHLCV bars (the same
// data the RAPTOR chart renders) and trades through place_market_order
// / close_position — the exact path the manual BUY/SELL buttons use.
//
// Strategies are faithful web ports of each MQL5 expert's core entry
// logic (EA BACK UP JULY 2026), computed with the platform indicator
// library. Position policy: one 0.01-lot position per EA instance,
// entered on attach if the strategy has an active regime, flipped when
// the regime reverses on a closed bar, ATR-based SL/TP on every entry.
// ═══════════════════════════════════════════════════════════════

import { orderService } from './order-service';
import type { OHLCVBar } from '@/types/trading';
import type { Resolution } from './ohlcv-builder';
import {
  sma, ema, rsi, macd, bollingerBands, atr, parabolicSAR, ichimoku,
} from './indicators';

export type EARegime = 'BUY' | 'SELL' | null;

const TF_TO_RES: Record<string, Resolution> = {
  '1m': '1', '5m': '5', '15m': '15', '30m': '30', '1H': '60', '4H': '240', '1D': '1D',
};

// ─── Strategy implementations ─────────────────────────────────────
// Each receives the CLOSED bars (oldest → newest) and returns the
// regime the EA wants to be positioned in right now.

type Strategy = (bars: OHLCVBar[]) => EARegime;

const last = <T,>(arr: (T | null)[]): T | null => (arr.length ? arr[arr.length - 1] : null);

function series(bars: OHLCVBar[]) {
  return {
    closes: bars.map((b) => b.close),
    highs: bars.map((b) => b.high),
    lows: bars.map((b) => b.low),
  };
}

/**
 * Faithful 9/21 EMA pullback (EMA_Pullback_EA / Kondacheval_EA source):
 *   BUY  = uptrend(EMA9>EMA21) && low<=EMA9 && close>=EMA21 && bullish candle
 *   SELL = downtrend             && high>=EMA9 && close<=EMA21 && bearish candle
 * Falls back to the trend bias so the EA holds a position between pullbacks.
 */
const stratEmaPullback: Strategy = (bars) => {
  const { closes } = series(bars);
  const e9arr = ema(closes, 9);
  const e21arr = ema(closes, 21);
  const i = bars.length - 1;
  const e9 = e9arr[i]; const e21 = e21arr[i];
  const b = bars[i];
  if (e9 == null || e21 == null) return null;
  const uptrend = e9 > e21;
  const downtrend = e9 < e21;
  const bullPullback = uptrend && b.low <= e9 && b.close >= e21 && b.close > b.open;
  const bearPullback = downtrend && b.high >= e9 && b.close <= e21 && b.close < b.open;
  if (bullPullback) return 'BUY';
  if (bearPullback) return 'SELL';
  // Between pullbacks, stay aligned with the EMA trend.
  if (uptrend && b.close > e21) return 'BUY';
  if (downtrend && b.close < e21) return 'SELL';
  return null;
};

/** RSI + MACD momentum (ProHybridTrendReversal source: rsi>=min && macdMain>signal). */
const stratRsiMacdMomentum: Strategy = (bars) => {
  const { closes } = series(bars);
  const r = last(rsi(closes, 14));
  const m = macd(closes, 12, 26, 9);
  const i = closes.length - 1;
  const line = m.macd[i]; const signal = m.signal[i];
  if (r == null || line == null || signal == null) return null;
  if (r >= 50 && line > signal) return 'BUY';
  if (r <= 50 && line < signal) return 'SELL';
  return null;
};

/** RSI-driven adaptive engine (Profit Predator source: RSI bands + trend). */
const stratRsiAdaptive: Strategy = (bars) => {
  const { closes } = series(bars);
  const r = last(rsi(closes, 14));
  const e50 = last(ema(closes, 50));
  const c = closes[closes.length - 1];
  if (r == null || e50 == null) return null;
  // Momentum with trend: RSI leaving the midline in the trend direction.
  if (r > 52 && c > e50) return 'BUY';
  if (r < 48 && c < e50) return 'SELL';
  return null;
};

/** Parabolic SAR flip confirmed by EMA trend + RSI (Naughty Girl, SAR VI). */
const stratSarFlip: Strategy = (bars) => {
  const { closes, highs, lows } = series(bars);
  const sar = last(parabolicSAR(highs, lows, 0.02, 0.2));
  const e50 = last(ema(closes, 50));
  const r = last(rsi(closes, 14));
  const c = closes[closes.length - 1];
  if (sar == null || e50 == null || r == null) return null;
  if (sar < c && c > e50 && r > 48) return 'BUY';
  if (sar > c && c < e50 && r < 52) return 'SELL';
  return null;
};

/** Bollinger band + MACD confluence, mean-reversion (BOLCD). */
const stratBollMacd: Strategy = (bars) => {
  const { closes } = series(bars);
  const bb = bollingerBands(closes, 20, 2);
  const m = macd(closes, 12, 26, 9);
  const i = closes.length - 1;
  const lower = bb.lower[i]; const upper = bb.upper[i]; const mid = bb.middle[i];
  const h = m.histogram[i]; const hPrev = m.histogram[i - 1];
  const c = closes[i];
  if (lower == null || upper == null || mid == null || h == null || hPrev == null) return null;
  if (c <= lower * 1.001 && h > hPrev) return 'BUY';
  if (c >= upper * 0.999 && h < hPrev) return 'SELL';
  // exit zone: middle band — no directional edge
  return null;
};

/** EMA 20/50 regime flip (Bad Boy, Gentleman, Pro Hybrid, Paruthiveeran, Walter Vetrivel). */
const stratTrendReversal: Strategy = (bars) => {
  const { closes } = series(bars);
  const e20 = last(ema(closes, 20));
  const e50 = last(ema(closes, 50));
  if (e20 == null || e50 == null) return null;
  if (e20 > e50) return 'BUY';
  if (e20 < e50) return 'SELL';
  return null;
};

/** Fast/slow smoothing crossover, Kalman-style (BLUEBIRD, Karakattakaran, Padayappa). */
const stratKalmanTrend: Strategy = (bars) => {
  const { closes } = series(bars);
  const fast = last(ema(closes, 3));
  const slow = last(ema(closes, 30));
  if (fast == null || slow == null) return null;
  if (fast > slow) return 'BUY';
  if (fast < slow) return 'SELL';
  return null;
};

/** LinReg-candle colour ≈ short EMA slope (GIOLINEREG, Linegration V1/V2). */
const stratLinReg: Strategy = (bars) => {
  const { closes } = series(bars);
  const e = ema(closes, 11);
  const cur = e[e.length - 1]; const prev = e[e.length - 2];
  if (cur == null || prev == null) return null;
  if (cur > prev) return 'BUY';
  if (cur < prev) return 'SELL';
  return null;
};

/** Ichimoku cloud + TK cross (Ichimokuthadi, SuperIchi, SuperIchi Annamalai). */
const stratIchimoku: Strategy = (bars) => {
  const { closes, highs, lows } = series(bars);
  const ic = ichimoku(highs, lows, closes, 9, 26, 52, 26);
  const i = closes.length - 1;
  const conv = ic.conversion[i]; const base = ic.base[i];
  const spanA = ic.spanA[i]; const spanB = ic.spanB[i];
  const c = closes[i];
  if (conv == null || base == null || spanA == null || spanB == null) return null;
  const cloudTop = Math.max(spanA, spanB);
  const cloudBot = Math.min(spanA, spanB);
  if (c > cloudTop && conv > base) return 'BUY';
  if (c < cloudBot && conv < base) return 'SELL';
  return null;
};

/** SSL channel flip (SSL Hybrid, LNL GIO, Gulliver). */
const stratSslChannel: Strategy = (bars) => {
  const { closes, highs, lows } = series(bars);
  const hi = last(sma(highs, 10));
  const lo = last(sma(lows, 10));
  const c = closes[closes.length - 1];
  if (hi == null || lo == null) return null;
  if (c > hi) return 'BUY';
  if (c < lo) return 'SELL';
  return null;
};

/** Engulfing pattern at N-bar extremes (Pattern GIO, Fibonacci Bands). */
const stratPattern: Strategy = (bars) => {
  if (bars.length < 22) return null;
  const cur = bars[bars.length - 1];
  const prev = bars[bars.length - 2];
  const window = bars.slice(-21, -1);
  const winHigh = Math.max(...window.map((b) => b.high));
  const winLow = Math.min(...window.map((b) => b.low));
  const bullishEngulf = cur.close > cur.open && prev.close < prev.open && cur.close > prev.open && cur.open < prev.close;
  const bearishEngulf = cur.close < cur.open && prev.close > prev.open && cur.close < prev.open && cur.open > prev.close;
  if (bullishEngulf && cur.low <= winLow * 1.001) return 'BUY';
  if (bearishEngulf && cur.high >= winHigh * 0.999) return 'SELL';
  return null;
};

// Named strategy kinds — used to run uploaded/custom EAs after the
// MQL5 source is mapped to the closest platform engine (see custom-ea.ts).
export type StrategyKind =
  | 'ema_pullback' | 'sar_flip' | 'boll_macd' | 'trend_reversal'
  | 'kalman' | 'linreg' | 'ichimoku' | 'ssl' | 'pattern'
  | 'rsi_macd' | 'rsi_adaptive';

export const STRATEGY_KINDS: Record<StrategyKind, Strategy> = {
  ema_pullback: stratEmaPullback,
  sar_flip: stratSarFlip,
  boll_macd: stratBollMacd,
  trend_reversal: stratTrendReversal,
  kalman: stratKalmanTrend,
  linreg: stratLinReg,
  ichimoku: stratIchimoku,
  ssl: stratSslChannel,
  pattern: stratPattern,
  rsi_macd: stratRsiMacdMomentum,
  rsi_adaptive: stratRsiAdaptive,
};

// strategyId (EA_LIBRARY id) → strategy
const STRATEGIES: Record<string, Strategy> = {
  '1da5f188-c659-4843-b91d-4fdc003002dc': stratTrendReversal, // Bad Boy v3.0
  '24fa1777-47b0-48bd-af9a-2044d1010a70': stratKalmanTrend,   // BLUEBIRD
  'f689e46f-b6b2-4be8-9ed8-978ef2147d4e': stratBollMacd,      // BOLCD v1.0
  'c11d80f8-c68a-42fc-8ada-04055df910a4': stratEmaPullback,   // EMA Pullback
  'b042aa5e-3cec-44c3-914d-ccae0bc4740c': stratPattern,       // Fibonacci Bands
  '7a5eb3b5-ff39-4559-a057-050386a820f0': stratTrendReversal, // Gentleman
  '3fcc4545-7c16-497b-bed1-f6afc0d18f37': stratLinReg,        // GIOLINEREG V1
  '2d99660e-4168-4457-bc2d-5f121bd02a62': stratSslChannel,    // Gulliver
  'bf858c10-157f-40f1-915a-ceb23d6d162e': stratIchimoku,      // Ichimokuthadi
  '88bbb135-579c-418c-8795-23f6970b306b': stratKalmanTrend,   // Karakattakaran
  '1a2a7591-b872-489e-afe9-ecae05f676d9': stratEmaPullback,   // Kondacheval v1.1
  'a1cc822a-87d9-4c24-9735-8311402b3601': stratLinReg,        // Linegration V-02
  'c6dd62fa-6d15-4d8e-b577-f93642e75b0a': stratLinReg,        // Linegration V-01
  '05b87485-7f6f-46f4-b522-8f51fc90f704': stratSslChannel,    // LNL GIO
  'fd4b518d-c248-4889-92a5-c50394556571': stratSarFlip,       // Naughty Girl v1.1
  'be1030dc-47fa-4b9a-a176-8368ff8332f5': stratKalmanTrend,   // Padayappa
  '8717afe9-36dd-4ada-824d-07f2fed0c9eb': stratTrendReversal, // Paruthiveeran (LinReg+Kalman+ADX)
  '6fb4b3e9-20e4-45cd-b3e8-911d01036a14': stratPattern,       // Pattern GIO
  'd85d1178-de66-4ed4-8349-39a98c5edc7d': stratRsiAdaptive,   // Profit Predator v1.0 (RSI+stoch)
  '8cd15b06-2e6c-4e40-bbe8-1c33e7471bbf': stratRsiMacdMomentum, // Pro Hybrid (RSI+MACD)
  '5792de3d-317f-4fb3-a6f0-b69f7b47be71': stratSarFlip,       // SAR VI v1.1
  '2c83500d-ffa7-4a28-9f0e-deaa07fcd347': stratSslChannel,    // SSL Hybrid
  'bbaec02d-b5e9-45c0-a44a-e91433a120d9': stratIchimoku,      // SuperIchi Annamalai
  '7e6cedd9-6e9f-4a33-b2b6-838c647edff2': stratIchimoku,      // SuperIchi
  '8be4d74d-e25d-4a9e-b596-66c7d226cb3a': stratTrendReversal, // Walter Vetrivel
};

// ─── Runtime ──────────────────────────────────────────────────────

export interface EAStats {
  trades: number;
  direction: EARegime;
  lastAction: string;
}

// Full per-EA diagnostics snapshot (§9 / §14).
export interface EAInfo {
  key: string;
  name: string;
  symbol: string;
  timeframe: string;
  enabled: boolean;
  trades: number;
  direction: EARegime;
  hasPosition: boolean;
  magic: number;
  lastBarTime: number;
}

// Stable 6-digit "magic number" derived from the instance key (MT5-style).
function magicFromKey(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (Math.abs(h) % 900000) + 100000;
}

interface InstanceState {
  key: string;
  strategyId: string;
  strategyKind?: StrategyKind;
  name: string;
  symbol: string;
  resolution: Resolution;
  lastBarTime: number;
  positionId: string | null;
  direction: EARegime;
  trades: number;
  busy: boolean;
  enabled: boolean;   // per-EA on/off, independent of the global Algo switch
}

export interface EARuntimeDeps {
  getBars: (symbol: string, resolution: Resolution) => OHLCVBar[];
  getTick: (symbol: string) => { bid: number; ask: number } | undefined;
  getAccountId: () => string | null;
  onStats: (key: string, stats: EAStats) => void;
  onRefresh: () => void;
}

const EA_LOT = 0.01;

export class EARuntime {
  private instances = new Map<string, InstanceState>();
  // Global Algo Trading switch. When OFF, no EA evaluation or automated orders
  // occur (OnTick pauses); manual trading via the order ticket is unaffected.
  private globalEnabled = true;

  constructor(private deps: EARuntimeDeps) {}

  isGlobalEnabled(): boolean {
    return this.globalEnabled;
  }

  setGlobalEnabled(on: boolean) {
    this.globalEnabled = on;
  }

  has(key: string): boolean {
    return this.instances.has(key);
  }

  keys(): string[] {
    return Array.from(this.instances.keys());
  }

  attach(key: string, strategyId: string, name: string, symbol: string, timeframes: string[], strategyKind?: StrategyKind) {
    if (this.instances.has(key)) return;
    // Trade the EA's shortest timeframe so activity is visible quickly.
    const tf = [...(timeframes ?? [])].sort(
      (a, b) => (Object.keys(TF_TO_RES).indexOf(a)) - (Object.keys(TF_TO_RES).indexOf(b))
    )[0];
    const resolution = TF_TO_RES[tf] ?? '15';
    const inst: InstanceState = {
      key, strategyId, strategyKind, name, symbol, resolution,
      lastBarTime: 0, positionId: null, direction: null, trades: 0, busy: false, enabled: true,
    };
    this.instances.set(key, inst);
    // Enter immediately if the strategy already has an active regime — but only
    // when Algo Trading is globally enabled AND this EA is enabled.
    if (this.globalEnabled && inst.enabled) void this.evaluate(inst, true);
  }

  isInstanceEnabled(key: string): boolean {
    return this.instances.get(key)?.enabled ?? false;
  }

  setInstanceEnabled(key: string, on: boolean) {
    const inst = this.instances.get(key);
    if (!inst) return;
    inst.enabled = on;
    if (on && this.globalEnabled) void this.evaluate(inst, true);
  }

  // Restart an EA: reset its evaluation state so it re-scans from scratch and
  // re-enters on the next signal. The open position (if any) is kept and gets
  // managed/flipped by the strategy on the next evaluation.
  restart(key: string) {
    const inst = this.instances.get(key);
    if (!inst) return;
    inst.lastBarTime = 0;
    inst.direction = null;
    inst.trades = 0;
    inst.busy = false;
    if (this.globalEnabled && inst.enabled) void this.evaluate(inst, true);
  }

  getInstanceInfo(key: string): EAInfo | null {
    const inst = this.instances.get(key);
    if (!inst) return null;
    return {
      key: inst.key, name: inst.name, symbol: inst.symbol, timeframe: inst.resolution,
      enabled: inst.enabled, trades: inst.trades, direction: inst.direction,
      hasPosition: !!inst.positionId, magic: magicFromKey(inst.key), lastBarTime: inst.lastBarTime,
    };
  }

  detach(key: string) {
    this.instances.delete(key);
  }

  detachAll() {
    this.instances.clear();
  }

  /** Call on every price tick; evaluates instances whose bar closed. */
  onTick() {
    // Global Algo Trading OFF → pause all automated evaluation/orders.
    if (!this.globalEnabled) return;
    for (const inst of this.instances.values()) {
      if (!inst.enabled) continue; // per-EA switch is OFF
      void this.evaluate(inst, false);
    }
  }

  private closedBars(inst: InstanceState): OHLCVBar[] {
    const all = this.deps.getBars(inst.symbol, inst.resolution);
    // getAllBars includes the in-progress bar — evaluate on closed bars only.
    return all.length > 1 ? all.slice(0, -1) : [];
  }

  private async evaluate(inst: InstanceState, initial: boolean) {
    if (inst.busy) return;
    const bars = this.closedBars(inst);
    if (bars.length < 60) return;
    const newestClosed = bars[bars.length - 1].time;
    if (!initial && newestClosed <= inst.lastBarTime) return; // no new closed bar yet
    inst.lastBarTime = newestClosed;

    // Built-in EA → mapped strategy; uploaded EA → its detected kind.
    const strategy =
      STRATEGIES[inst.strategyId] ??
      (inst.strategyKind ? STRATEGY_KINDS[inst.strategyKind] : undefined) ??
      stratTrendReversal;
    const regime = strategy(bars);
    if (regime === null || regime === inst.direction) return;

    inst.busy = true;
    try {
      const accountId = this.deps.getAccountId();
      const tick = this.deps.getTick(inst.symbol);
      if (!accountId || !tick) return;

      // Flip: close the opposing position first.
      if (inst.positionId) {
        const closePrice = inst.direction === 'BUY' ? tick.bid : tick.ask;
        try { await orderService.closePosition(inst.positionId, closePrice); } catch { /* may already be closed by SL/TP */ }
        inst.positionId = null;
        inst.direction = null;
      }

      // ATR-based protective levels.
      const { highs, lows, closes } = {
        highs: bars.map((b) => b.high), lows: bars.map((b) => b.low), closes: bars.map((b) => b.close),
      };
      const atrArr = atr(highs, lows, closes, 14);
      const a = atrArr[atrArr.length - 1] ?? 0;
      const fillPrice = regime === 'BUY' ? tick.ask : tick.bid;
      const sl = a > 0 ? (regime === 'BUY' ? fillPrice - 2 * a : fillPrice + 2 * a) : undefined;
      const tp = a > 0 ? (regime === 'BUY' ? fillPrice + 3 * a : fillPrice - 3 * a) : undefined;

      const result = await orderService.placeMarketOrder({
        accountId,
        symbol: inst.symbol,
        direction: regime,
        size: EA_LOT,
        sl, tp,
        fillPrice,
        comment: `EA:${inst.name}`,
      }) as { success?: boolean; position_id?: string } | null;

      if (result?.success && result.position_id) {
        inst.positionId = result.position_id;
        inst.direction = regime;
        inst.trades += 1;
        this.deps.onStats(inst.key, {
          trades: inst.trades,
          direction: regime,
          lastAction: `${regime} ${EA_LOT} ${inst.symbol}`,
        });
        this.deps.onRefresh();
      }
    } finally {
      inst.busy = false;
    }
  }
}

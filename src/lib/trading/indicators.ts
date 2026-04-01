// ═══════════════════════════════════════════════════════════════
// GIO4X RAPTOR — Technical Indicators
// Pure functions that calculate popular chart indicators from OHLCV data
// ═══════════════════════════════════════════════════════════════

/**
 * Simple Moving Average
 * Returns array of same length as input with nulls for insufficient data.
 */
export function sma(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(data.length).fill(null);
  if (data.length < period || period < 1) return result;

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i];
  }
  result[period - 1] = sum / period;

  for (let i = period; i < data.length; i++) {
    sum += data[i] - data[i - period];
    result[i] = sum / period;
  }

  return result;
}

/**
 * Exponential Moving Average
 * Uses multiplier = 2 / (period + 1)
 */
export function ema(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(data.length).fill(null);
  if (data.length < period || period < 1) return result;

  // Seed with SMA of first 'period' values
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i];
  }
  let prev = sum / period;
  result[period - 1] = prev;

  const multiplier = 2 / (period + 1);

  for (let i = period; i < data.length; i++) {
    prev = (data[i] - prev) * multiplier + prev;
    result[i] = prev;
  }

  return result;
}

/**
 * Relative Strength Index (RSI)
 * Wilder's smoothing method
 */
export function rsi(data: number[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = new Array(data.length).fill(null);
  if (data.length < period + 1 || period < 1) return result;

  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }

  // First average gain/loss
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    avgGain += gains[i];
    avgLoss += losses[i];
  }
  avgGain /= period;
  avgLoss /= period;

  if (avgLoss === 0) {
    result[period] = 100;
  } else {
    const rs = avgGain / avgLoss;
    result[period] = 100 - 100 / (1 + rs);
  }

  // Subsequent values using Wilder's smoothing
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;

    if (avgLoss === 0) {
      result[i + 1] = 100;
    } else {
      const rs = avgGain / avgLoss;
      result[i + 1] = 100 - 100 / (1 + rs);
    }
  }

  return result;
}

/**
 * MACD (Moving Average Convergence Divergence)
 * Returns { macd, signal, histogram } arrays
 */
export function macd(
  data: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
} {
  const length = data.length;
  const macdLine: (number | null)[] = new Array(length).fill(null);
  const signalLine: (number | null)[] = new Array(length).fill(null);
  const histogramLine: (number | null)[] = new Array(length).fill(null);

  const fastEma = ema(data, fastPeriod);
  const slowEma = ema(data, slowPeriod);

  // MACD line = fast EMA - slow EMA
  const macdValues: number[] = [];
  for (let i = 0; i < length; i++) {
    if (fastEma[i] !== null && slowEma[i] !== null) {
      const val = fastEma[i]! - slowEma[i]!;
      macdLine[i] = val;
      macdValues.push(val);
    }
  }

  // Signal line = EMA of MACD values
  if (macdValues.length >= signalPeriod) {
    const signalEma = ema(macdValues, signalPeriod);

    // Map signal EMA back to original indices
    let macdIdx = 0;
    for (let i = 0; i < length; i++) {
      if (macdLine[i] !== null) {
        if (signalEma[macdIdx] !== null) {
          signalLine[i] = signalEma[macdIdx];
          histogramLine[i] = macdLine[i]! - signalEma[macdIdx]!;
        }
        macdIdx++;
      }
    }
  }

  return { macd: macdLine, signal: signalLine, histogram: histogramLine };
}

/**
 * Bollinger Bands
 * Returns { upper, middle, lower } arrays
 */
export function bollingerBands(
  data: number[],
  period: number = 20,
  stdDevMultiplier: number = 2
): {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
} {
  const length = data.length;
  const upper: (number | null)[] = new Array(length).fill(null);
  const middle: (number | null)[] = new Array(length).fill(null);
  const lower: (number | null)[] = new Array(length).fill(null);

  const smaValues = sma(data, period);

  for (let i = period - 1; i < length; i++) {
    const mean = smaValues[i]!;
    middle[i] = mean;

    // Calculate standard deviation
    let sumSqDiff = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = data[j] - mean;
      sumSqDiff += diff * diff;
    }
    const stdDev = Math.sqrt(sumSqDiff / period);

    upper[i] = mean + stdDevMultiplier * stdDev;
    lower[i] = mean - stdDevMultiplier * stdDev;
  }

  return { upper, middle, lower };
}

/**
 * Average True Range (ATR)
 * Uses Wilder's smoothing
 */
export function atr(
  high: number[],
  low: number[],
  close: number[],
  period: number = 14
): (number | null)[] {
  const length = high.length;
  const result: (number | null)[] = new Array(length).fill(null);
  if (length < period + 1 || period < 1) return result;

  // Calculate True Range
  const tr: number[] = [high[0] - low[0]]; // First TR is just H-L
  for (let i = 1; i < length; i++) {
    const hl = high[i] - low[i];
    const hpc = Math.abs(high[i] - close[i - 1]);
    const lpc = Math.abs(low[i] - close[i - 1]);
    tr.push(Math.max(hl, hpc, lpc));
  }

  // First ATR is simple average of first 'period' TR values
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += tr[i];
  }
  let prevAtr = sum / period;
  result[period - 1] = prevAtr;

  // Subsequent ATR uses Wilder's smoothing
  for (let i = period; i < length; i++) {
    prevAtr = (prevAtr * (period - 1) + tr[i]) / period;
    result[i] = prevAtr;
  }

  return result;
}

/**
 * Stochastic Oscillator (%K and %D)
 */
export function stochastic(
  high: number[],
  low: number[],
  close: number[],
  kPeriod: number = 14,
  dPeriod: number = 3
): {
  k: (number | null)[];
  d: (number | null)[];
} {
  const length = high.length;
  const kLine: (number | null)[] = new Array(length).fill(null);
  const dLine: (number | null)[] = new Array(length).fill(null);

  if (length < kPeriod || kPeriod < 1) return { k: kLine, d: dLine };

  // Calculate %K
  const kValues: number[] = [];
  for (let i = kPeriod - 1; i < length; i++) {
    let highestHigh = -Infinity;
    let lowestLow = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (high[j] > highestHigh) highestHigh = high[j];
      if (low[j] < lowestLow) lowestLow = low[j];
    }
    const range = highestHigh - lowestLow;
    const k = range === 0 ? 50 : ((close[i] - lowestLow) / range) * 100;
    kLine[i] = k;
    kValues.push(k);
  }

  // %D = SMA of %K
  if (kValues.length >= dPeriod) {
    const dSma = sma(kValues, dPeriod);
    let kIdx = 0;
    for (let i = kPeriod - 1; i < length; i++) {
      if (dSma[kIdx] !== null) {
        dLine[i] = dSma[kIdx];
      }
      kIdx++;
    }
  }

  return { k: kLine, d: dLine };
}

/**
 * Volume Weighted Average Price (VWAP)
 * Calculated cumulatively from the start of the data
 */
export function vwap(
  high: number[],
  low: number[],
  close: number[],
  volume: number[]
): number[] {
  const length = high.length;
  const result: number[] = new Array(length).fill(0);

  let cumulativeTPV = 0;
  let cumulativeVolume = 0;

  for (let i = 0; i < length; i++) {
    const typicalPrice = (high[i] + low[i] + close[i]) / 3;
    const vol = volume[i] || 1; // Avoid zero volume
    cumulativeTPV += typicalPrice * vol;
    cumulativeVolume += vol;
    result[i] = cumulativeTPV / cumulativeVolume;
  }

  return result;
}

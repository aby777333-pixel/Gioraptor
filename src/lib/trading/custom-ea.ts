// ═══════════════════════════════════════════════════════════════
// Custom EA upload → platform conversion
//
// A user uploads a MetaTrader expert (.mq5 source or .ex5 compiled).
// We can't run compiled MQL5 in a browser, so "conversion to platform
// compatibility" means: read the source, detect which indicators /
// signal patterns it uses, and map it onto one of the platform's
// runnable strategy engines (the same engines that power the built-in
// EA library). The converted EA is persisted and appears in the
// EAs/Robots dropdown to be attached and traded like any other.
// ═══════════════════════════════════════════════════════════════

import type { StrategyKind } from './ea-engine';

export interface CustomEA {
  id: string;
  name: string;
  description: string;
  pairs: string[];
  timeframes: string[];
  type: 'scalper' | 'trend' | 'reversal' | 'hybrid' | 'grid' | 'hedge' | 'martingale';
  rating: number;
  status: string;
  custom: true;
  strategyKind: StrategyKind;
  sourceKind: 'mq5' | 'ex5';
}

const STORAGE_KEY = 'raptor-custom-eas';
const CHANGED_EVENT = 'raptor-custom-eas-changed';

// ─── Detection: map MQL5 source features → a platform strategy ─────

interface Detector {
  kind: StrategyKind;
  type: CustomEA['type'];
  test: (src: string) => number; // score; highest wins
}

function count(src: string, re: RegExp): number {
  return (src.match(re) ?? []).length;
}

const DETECTORS: Detector[] = [
  {
    kind: 'boll_macd', type: 'reversal',
    test: (s) => (count(s, /iBands|Bollinger/gi) > 0 && count(s, /iMACD|MACD/gi) > 0 ? 6 : 0),
  },
  {
    kind: 'sar_flip', type: 'scalper',
    test: (s) => count(s, /iSAR|ParabolicSAR|Parabolic\s*SAR/gi) > 0 ? 5 : 0,
  },
  {
    kind: 'ichimoku', type: 'trend',
    test: (s) => count(s, /iIchimoku|Ichimoku|Tenkan|Kijun|SenkouSpan|SuperIchi/gi) > 0 ? 5 : 0,
  },
  {
    kind: 'rsi_macd', type: 'hybrid',
    test: (s) => (count(s, /iRSI|RSI/gi) > 0 && count(s, /iMACD|MACD/gi) > 0 ? 5 : 0),
  },
  {
    kind: 'rsi_adaptive', type: 'hybrid',
    test: (s) => (count(s, /iRSI|RSI/gi) > 0 && count(s, /iStochastic|Stochastic/gi) > 0 ? 5 : 0),
  },
  {
    kind: 'kalman', type: 'trend',
    test: (s) => count(s, /Kalman/gi) > 0 ? 5 : 0,
  },
  {
    kind: 'linreg', type: 'trend',
    test: (s) => count(s, /LinReg|Linear\s*Regression|Regression\s*Candle/gi) > 0 ? 4 : 0,
  },
  {
    kind: 'ssl', type: 'trend',
    test: (s) => count(s, /SSL|NNFX|Baseline/gi) > 0 ? 3 : 0,
  },
  {
    kind: 'ema_pullback', type: 'trend',
    // EMA-based with a pullback / cross feel
    test: (s) => (count(s, /iMA|EMA|MovingAverage/gi) >= 2 ? 3 : 0),
  },
  {
    kind: 'pattern', type: 'hybrid',
    test: (s) => count(s, /Pattern|Engulf|Fractal|HeadAndShoulders|Fibonacci/gi) > 0 ? 3 : 0,
  },
  {
    kind: 'trend_reversal', type: 'reversal',
    test: (s) => count(s, /Reversal|Trend/gi) > 0 ? 2 : 0,
  },
];

/** Extract a display name from the source, else fall back to the filename. */
function extractName(src: string, filename: string): string {
  const prop = src.match(/#property\s+description\s+"([^"]+)"/i);
  if (prop && prop[1].length <= 48) return prop[1].split(/[.\-–—|]/)[0].trim();
  const base = filename.replace(/\.(mq5|ex5)$/i, '').replace(/[_]+/g, ' ').trim();
  return base || 'Custom EA';
}

function extractDescription(src: string): string | null {
  const prop = src.match(/#property\s+description\s+"([^"]+)"/i);
  return prop ? prop[1] : null;
}

/**
 * Convert an uploaded EA file to a platform-compatible CustomEA.
 * For .mq5 the source is parsed; for .ex5 (binary) we key off the
 * filename and default to a trend engine (no source to inspect).
 */
export function convertUploadedEA(filename: string, content: string): CustomEA {
  const isMq5 = /\.mq5$/i.test(filename);
  const src = isMq5 ? content : '';

  let best: Detector = DETECTORS[DETECTORS.length - 1];
  let bestScore = 0;
  if (isMq5) {
    for (const d of DETECTORS) {
      const score = d.test(src);
      if (score > bestScore) { bestScore = score; best = d; }
    }
  }

  const name = isMq5 ? extractName(src, filename) : filename.replace(/\.(mq5|ex5)$/i, '').replace(/[_]+/g, ' ').trim();
  const desc = (isMq5 && extractDescription(src)) ||
    `Uploaded ${isMq5 ? 'MQL5 source' : 'compiled EA'} — converted to the platform's ${best.kind.replace(/_/g, ' ')} engine.`;

  return {
    id: `custom-${genId()}`,
    name: name || 'Custom EA',
    description: desc,
    pairs: ['EURUSD', 'GBPUSD', 'XAUUSD'],
    timeframes: ['15m', '1H'],
    type: best.type,
    rating: 4.0,
    status: 'available',
    custom: true,
    strategyKind: best.kind,
    sourceKind: isMq5 ? 'mq5' : 'ex5',
  };
}

// ─── Persistence (localStorage + change event) ────────────────────

function genId(): string {
  // Browser-safe unique id without external deps.
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && 'randomUUID' in c) return (c as Crypto).randomUUID();
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

export function loadCustomEAs(): CustomEA[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CustomEA[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomEA(ea: CustomEA): void {
  if (typeof window === 'undefined') return;
  const list = loadCustomEAs();
  list.push(ea);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(CHANGED_EVENT));
}

export function removeCustomEA(id: string): void {
  if (typeof window === 'undefined') return;
  const list = loadCustomEAs().filter((e) => e.id !== id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(CHANGED_EVENT));
}

export function onCustomEAsChanged(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(CHANGED_EVENT, cb);
  window.addEventListener('storage', cb); // cross-tab
  return () => {
    window.removeEventListener(CHANGED_EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

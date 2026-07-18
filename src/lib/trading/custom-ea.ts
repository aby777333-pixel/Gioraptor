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

// One extracted MQL5 `input` declaration (super-prompt §7 parameter extraction).
export interface ExtractedInput {
  name: string;
  label: string;        // trailing comment when present, else the name
  mqlType: string;      // int / double / bool / string / ENUM_* / color / datetime …
  defaultValue: string; // as written in source
}

// Per-event / per-feature conversion outcome (§2/§4): never silently omitted.
export interface ConversionItem {
  item: string;
  status: 'converted' | 'approximated' | 'unsupported' | 'manual-review';
  note: string;
}

export interface ConversionReport {
  fileKind: 'ea-source' | 'indicator-source' | 'compiled';
  sourceAvailable: boolean;
  detectedEngine: StrategyKind;
  engineScore: number;      // detector confidence score (0 = filename-only default)
  events: ConversionItem[];
  features: ConversionItem[];
  securityFlags: string[];  // DLL imports / WebRequest / file I/O found in source
  overall: 'converted' | 'partial' | 'compiled-only' | 'manual-review';
  convertedAt: number;
}

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
  // Library registration metadata (§16/§31) — absent on EAs uploaded before this
  // version; all consumers must treat these as optional.
  inputs?: ExtractedInput[];
  report?: ConversionReport;
  source?: string;          // .mq5 source (capped); never present for .ex5
  checksum?: string;
  uploadedAt?: number;
  version?: string;
  author?: string;
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

// ─── §7 Parameter extraction: parse MQL5 `input` declarations ──────

const INPUT_RE = /^\s*(?:input|sinput)\s+([A-Za-z_][\w<>:]*)\s+([A-Za-z_]\w*)\s*=\s*([^;]+);\s*(?:\/\/\s*(.*))?$/gm;

export function extractInputs(src: string): ExtractedInput[] {
  const out: ExtractedInput[] = [];
  let m: RegExpExecArray | null;
  INPUT_RE.lastIndex = 0;
  while ((m = INPUT_RE.exec(src)) !== null && out.length < 200) {
    out.push({
      mqlType: m[1],
      name: m[2],
      defaultValue: m[3].trim(),
      label: (m[4] || m[2].replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ')).trim(),
    });
  }
  return out;
}

// ─── §2/§4 Conversion report — honest per-event / per-feature status ─

function has(src: string, re: RegExp): boolean { return re.test(src); }

export function buildConversionReport(
  filename: string, src: string, engine: StrategyKind, engineScore: number,
): ConversionReport {
  const compiled = !/\.(mq5|mq4)$/i.test(filename) || !src;
  const isIndicator = !compiled && (has(src, /#property\s+indicator_/i) || (has(src, /\bOnCalculate\s*\(/) && !has(src, /\bOnTick\s*\(/)));

  if (compiled) {
    return {
      fileKind: 'compiled', sourceAvailable: false,
      detectedEngine: engine, engineScore: 0,
      events: [{ item: 'All events', status: 'unsupported', note: 'Compiled binary — no readable source. Runs via the platform strategy engine chosen from the filename; original logic is NOT executed.' }],
      features: [],
      securityFlags: [],
      overall: 'compiled-only',
      convertedAt: Date.now(),
    };
  }

  const events: ConversionItem[] = [];
  const ev = (re: RegExp, item: string, status: ConversionItem['status'], note: string) => {
    if (has(src, re)) events.push({ item, status, note });
  };
  ev(/\bOnInit\s*\(/, 'OnInit', 'converted', 'Mapped to the runtime attach/initialisation lifecycle.');
  ev(/\bOnDeinit\s*\(/, 'OnDeinit', 'converted', 'Mapped to the runtime detach lifecycle.');
  ev(/\bOnTick\s*\(/, 'OnTick', 'approximated', 'Runs on platform ticks, evaluated on bar close (bar-level model, not every raw tick).');
  ev(/\bOnTimer\s*\(/, 'OnTimer', 'unsupported', 'No timer events in the web runtime — timer-driven logic will not fire. Manual review advised.');
  ev(/\bOnTrade\s*\(/, 'OnTrade', 'approximated', 'Order lifecycle handled by the platform order service; custom OnTrade code is not executed.');
  ev(/\bOnTradeTransaction\s*\(/, 'OnTradeTransaction', 'unsupported', 'Transaction-level callbacks are not available in the web runtime.');
  ev(/\bOnChartEvent\s*\(/, 'OnChartEvent', 'unsupported', 'Chart-object events are not bridged to the strategy engine.');
  ev(/\bOnCalculate\s*\(/, 'OnCalculate', isIndicator ? 'manual-review' : 'approximated', isIndicator ? 'Indicator buffer logic — map plots via the Raptor Script editor or the indicator catalog.' : 'Indicator-style calculation inside an EA — approximated by the mapped engine.');

  const features: ConversionItem[] = [];
  const ft = (re: RegExp, item: string, status: ConversionItem['status'], note: string) => {
    if (has(src, re)) features.push({ item, status, note });
  };
  ft(/\bOrderSend|\btrade\.(Buy|Sell)|CTrade/i, 'Order execution', 'converted', 'Mapped to the platform order service (place_market_order / pending orders).');
  ft(/StopLoss|\bSL\b|sl\s*=/i, 'Stop-loss logic', 'approximated', 'Replaced by ATR-scaled SL from EA Properties (editable).');
  ft(/TakeProfit|\bTP\b|tp\s*=/i, 'Take-profit logic', 'approximated', 'Replaced by ATR-scaled TP from EA Properties (editable).');
  ft(/Trailing/i, 'Trailing stop', 'unsupported', 'Server-side trailing is not implemented in the web runtime.');
  ft(/\bMagic|magic_number|MagicNumber/i, 'Magic number', 'converted', 'A per-instance magic number is derived from the attach key.');
  ft(/iCustom\s*\(/, 'iCustom calls', 'manual-review', 'External custom indicators are not bundled — the mapped engine approximates the signal.');
  ft(/#import/, 'DLL imports', 'unsupported', 'DLLs cannot run in the browser and are never executed.');
  ft(/WebRequest/i, 'WebRequest', 'unsupported', 'Outbound network calls from strategies are blocked.');
  ft(/File(Open|Write|Read)/i, 'File operations', 'unsupported', 'Strategy file I/O is not available in the web runtime.');
  ft(/PositionClosePartial|partial/i, 'Partial close', 'approximated', 'Batch close controls exist in QuickTrade; per-EA partial logic is not executed.');
  ft(/Hedg/i, 'Hedging logic', 'manual-review', 'Account netting/hedging semantics depend on the trading account.');

  const securityFlags: string[] = [];
  if (has(src, /#import/)) securityFlags.push('DLL import directive found (never executed).');
  if (has(src, /WebRequest/i)) securityFlags.push('WebRequest network call found (blocked).');
  if (has(src, /File(Open|Write|Read)/i)) securityFlags.push('File I/O found (not available).');

  const hasUnsupported = [...events, ...features].some((i) => i.status === 'unsupported');
  const hasReview = isIndicator || [...events, ...features].some((i) => i.status === 'manual-review');
  const overall: ConversionReport['overall'] = isIndicator
    ? 'manual-review'
    : hasUnsupported || hasReview ? 'partial' : 'converted';

  return {
    fileKind: isIndicator ? 'indicator-source' : 'ea-source',
    sourceAvailable: true,
    detectedEngine: engine, engineScore,
    events, features, securityFlags, overall,
    convertedAt: Date.now(),
  };
}

// ─── §31 checksum (djb2) for duplicate detection ───────────────────

export function checksumOf(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16).padStart(8, '0');
}

const MAX_STORED_SOURCE = 200_000; // chars — keep localStorage well under quota

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

  const versionMatch = isMq5 ? src.match(/#property\s+version\s+"([^"]+)"/i) : null;
  const authorMatch = isMq5 ? src.match(/#property\s+copyright\s+"([^"]+)"/i) : null;

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
    // §7/§2/§16/§31 — extraction, report, source, registration metadata
    inputs: isMq5 ? extractInputs(src) : [],
    report: buildConversionReport(filename, src, best.kind, bestScore),
    source: isMq5 ? src.slice(0, MAX_STORED_SOURCE) : undefined,
    checksum: checksumOf(isMq5 ? src : filename),
    uploadedAt: Date.now(),
    version: versionMatch?.[1],
    author: authorMatch?.[1],
  };
}

/** §31 duplicate detection: an already-uploaded file (same checksum) is rejected. */
export function findDuplicate(checksum: string): CustomEA | undefined {
  return loadCustomEAs().find((e) => e.checksum === checksum);
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

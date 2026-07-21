// ═══════════════════════════════════════════════════════════════
// Broker Symbol / Group Configuration — the pricing & routing
// contract that takes effect the moment the real LP connects.
//
// Model (owner spec): instruments are organised into GROUPS (Forex
// Majors, Forex Minors, Metals, Energy, Indices, Crypto). Each group
// carries ONE STANDARD — Trading on/off, Commission/lot, Swap long &
// short per lot/day, Min lot, Max lot, Spread markup, Sessions,
// Routing (A-Book / B-Book / Hybrid). Expanding a group lets the
// broker edit any symbol INDIVIDUALLY; an edited symbol becomes an
// override and stops following the group standard until reset.
//
// effectiveConfigFor(symbol) is the single lookup the execution/
// routing layer will call when live data lands. Config persists
// locally with JSON export/import; migrating it into a Supabase
// `symbol_config` table is a straight 1:1 mapping when the LP
// integration starts server-side.
// ═══════════════════════════════════════════════════════════════

export type BookRouting = 'A-Book' | 'B-Book' | 'Hybrid';

export interface SymbolSettings {
  trading: boolean;             // symbol enabled for trading
  commissionPerLot: number;     // $ per lot round-turn
  swapLongPerLotDay: number;    // $ per lot per day (negative = charge)
  swapShortPerLotDay: number;
  minLot: number;
  maxLot: number;
  spreadMarkupPoints: number;   // added to raw LP spread
  sessions: string;             // human-readable trading window
  routing: BookRouting;
}

export interface GroupDef { id: string; label: string; standard: SymbolSettings }

export const SYMBOL_GROUPS: GroupDef[] = [
  { id: 'fx-majors', label: 'Forex Majors', standard: { trading: true, commissionPerLot: 6, swapLongPerLotDay: -4.5, swapShortPerLotDay: -3.5, minLot: 0.01, maxLot: 50, spreadMarkupPoints: 3, sessions: 'Mon 00:00 – Fri 23:59', routing: 'B-Book' } },
  { id: 'fx-minors', label: 'Forex Minors & Crosses', standard: { trading: true, commissionPerLot: 7, swapLongPerLotDay: -6, swapShortPerLotDay: -5, minLot: 0.01, maxLot: 30, spreadMarkupPoints: 5, sessions: 'Mon 00:00 – Fri 23:59', routing: 'B-Book' } },
  { id: 'metals', label: 'Metals', standard: { trading: true, commissionPerLot: 8, swapLongPerLotDay: -12, swapShortPerLotDay: -8, minLot: 0.01, maxLot: 20, spreadMarkupPoints: 8, sessions: 'Mon 01:00 – Fri 23:45', routing: 'Hybrid' } },
  { id: 'energy', label: 'Energies', standard: { trading: true, commissionPerLot: 8, swapLongPerLotDay: -10, swapShortPerLotDay: -10, minLot: 0.01, maxLot: 20, spreadMarkupPoints: 10, sessions: 'Mon 01:00 – Fri 23:00', routing: 'Hybrid' } },
  { id: 'indices', label: 'Indices', standard: { trading: true, commissionPerLot: 5, swapLongPerLotDay: -8, swapShortPerLotDay: -6, minLot: 0.01, maxLot: 25, spreadMarkupPoints: 15, sessions: 'Exchange hours + extended', routing: 'Hybrid' } },
  { id: 'crypto', label: 'Crypto', standard: { trading: true, commissionPerLot: 10, swapLongPerLotDay: -20, swapShortPerLotDay: -18, minLot: 0.01, maxLot: 10, spreadMarkupPoints: 25, sessions: '24/7', routing: 'A-Book' } },
];

const MAJORS = new Set(['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD']);

export function groupOfSymbol(symbol: string): string {
  if (/^XA[UG]/.test(symbol)) return 'metals';
  if (/(USOIL|UKOIL|NATGAS|WTI|BRENT)/i.test(symbol)) return 'energy';
  if (/(US30|NAS100|SPX500|GER40|UK100|JP225|US500|EU50|HK50|AUS200)/i.test(symbol)) return 'indices';
  if (/^(BTC|ETH|XRP|LTC|SOL|DOGE|ADA|BNB|DOT)/.test(symbol)) return 'crypto';
  return MAJORS.has(symbol) ? 'fx-majors' : 'fx-minors';
}

// ── Persistence ─────────────────────────────────────────────────

interface StoredConfig {
  version: 1;
  groupStandards: Record<string, SymbolSettings>;   // group id → edited standard
  overrides: Record<string, SymbolSettings>;        // symbol → per-symbol override
  updatedAt: string;
}

const KEY = 'raptor_broker_symbol_config_v1';

function loadStore(): StoredConfig {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null') as StoredConfig | null;
    if (raw && raw.version === 1) return raw;
  } catch { /* fall through */ }
  return { version: 1, groupStandards: {}, overrides: {}, updatedAt: new Date().toISOString() };
}

function saveStore(s: StoredConfig): void {
  try { s.updatedAt = new Date().toISOString(); localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export function groupStandard(groupId: string): SymbolSettings {
  const store = loadStore();
  const def = SYMBOL_GROUPS.find((g) => g.id === groupId)?.standard ?? SYMBOL_GROUPS[0].standard;
  return { ...def, ...(store.groupStandards[groupId] ?? {}) };
}

export function setGroupStandard(groupId: string, settings: SymbolSettings): void {
  const store = loadStore();
  store.groupStandards[groupId] = settings;
  saveStore(store);
}

export function symbolOverride(symbol: string): SymbolSettings | null {
  const store = loadStore();
  return store.overrides[symbol] ?? null;
}

export function setSymbolOverride(symbol: string, settings: SymbolSettings): void {
  const store = loadStore();
  store.overrides[symbol] = settings;
  saveStore(store);
}

export function clearSymbolOverride(symbol: string): void {
  const store = loadStore();
  delete store.overrides[symbol];
  saveStore(store);
}

/** The single lookup the routing/pricing layer calls at execution time. */
export function effectiveConfigFor(symbol: string): SymbolSettings & { source: 'override' | 'group'; group: string } {
  const groupId = groupOfSymbol(symbol);
  const ov = symbolOverride(symbol);
  if (ov) return { ...ov, source: 'override', group: groupId };
  return { ...groupStandard(groupId), source: 'group', group: groupId };
}

export function exportConfig(): string {
  return JSON.stringify(loadStore(), null, 2);
}

export function importConfig(json: string): { ok: boolean; error?: string } {
  try {
    const parsed = JSON.parse(json) as StoredConfig;
    if (parsed.version !== 1 || typeof parsed.groupStandards !== 'object' || typeof parsed.overrides !== 'object') {
      return { ok: false, error: 'not a valid symbol-config export (version 1 expected)' };
    }
    saveStore(parsed);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'invalid JSON' };
  }
}

export function configUpdatedAt(): string | null {
  try { return loadStore().updatedAt ?? null; } catch { return null; }
}

export function overrideCount(): number {
  try { return Object.keys(loadStore().overrides).length; } catch { return 0; }
}

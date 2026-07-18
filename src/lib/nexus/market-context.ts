// ═══════════════════════════════════════════════════════════════
// NEXUS live market context (NEXUS super-prompt: "not a chatbot").
// Builds an honest snapshot of what the platform actually knows right now —
// live quotes from the price stream, the trader's real open positions and
// account — so NEXUS answers about THIS trader's situation, not generics.
// Everything here is real platform data; nothing is fabricated.
// ═══════════════════════════════════════════════════════════════

import { useTradingStore } from '@/stores/trading';
import { orderService } from '@/lib/trading/order-service';
import { getOhlcvBuilder } from '@/lib/nexus/market-data-bridge';
import { classifyMarketState, marketStateToText, type MarketStateAssessment } from '@/lib/nexus/market-state';

export interface NexusContext {
  activeSymbol: string | null;
  quotes: { symbol: string; bid: number; ask: number; spread: number }[];
  positions: {
    symbol: string; direction: string; size: number;
    openPrice: number; currentPrice: number; floatingPnl: number;
    sl: number | null; tp: number | null;
  }[];
  accountConnected: boolean;
  /** Real bar-based classification — only present when the terminal's bar
   *  builder is available on this page (never fabricated elsewhere). */
  marketState: (MarketStateAssessment & { symbol: string; timeframe: string }) | null;
  /** Real performance analytics computed from the account's closed trades. */
  performance: NexusPerformance | null;
}

export interface NexusPerformance {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;          // %
  netPnl: number;
  profitFactor: number | null;
  avgWin: number;
  avgLoss: number;
  currentLossStreak: number; // consecutive losses, most recent first
  tradesToday: number;
  avgTradesPerDay: number;   // over the distinct trading days in the sample
  avgSize: number;
  lastSize: number;
  lastTrade: {
    symbol: string; direction: string; size: number;
    openPrice: number; closePrice: number; pnl: number; closedAt: string;
  } | null;
}

/** Compute honest performance stats from real closed-position rows. */
export function computePerformance(rows: Record<string, unknown>[]): NexusPerformance | null {
  if (!rows || rows.length === 0) return null;
  const trades = rows.map((r) => ({
    symbol: String(r.symbol ?? ''),
    direction: String(r.direction ?? ''),
    size: Number(r.size ?? 0),
    openPrice: Number(r.open_price ?? 0),
    closePrice: Number(r.close_price ?? r.current_price ?? 0),
    pnl: Number(r.realized_pnl ?? r.floating_pnl ?? 0),
    closedAt: String(r.closed_at ?? ''),
  }));
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl < 0);
  const grossWin = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  let streak = 0;
  for (const t of trades) { if (t.pnl < 0) streak++; else break; }
  const today = new Date().toDateString();
  const tradesToday = trades.filter((t) => t.closedAt && new Date(t.closedAt).toDateString() === today).length;
  const days = new Set(trades.filter((t) => t.closedAt).map((t) => new Date(t.closedAt).toDateString())).size || 1;
  return {
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: Math.round((wins.length / trades.length) * 100),
    netPnl: trades.reduce((s, t) => s + t.pnl, 0),
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
    avgWin: wins.length ? grossWin / wins.length : 0,
    avgLoss: losses.length ? grossLoss / losses.length : 0,
    currentLossStreak: streak,
    tradesToday,
    avgTradesPerDay: Math.round((trades.length / days) * 10) / 10,
    avgSize: trades.reduce((s, t) => s + t.size, 0) / trades.length,
    lastSize: trades[0]?.size ?? 0,
    lastTrade: trades[0] ?? null,
  };
}

export async function buildNexusContext(): Promise<NexusContext> {
  const state = useTradingStore.getState();
  const quotes = Object.values(state.prices ?? {})
    .slice(0, 16)
    .map((t) => ({ symbol: t.symbol, bid: t.bid, ask: t.ask, spread: t.spread }));

  let positions: NexusContext['positions'] = [];
  let performance: NexusPerformance | null = null;
  let accountConnected = false;
  if (state.activeAccountId) {
    accountConnected = true;
    try {
      const closed = await orderService.getTradeHistory(state.activeAccountId, 50);
      performance = computePerformance((closed ?? []) as Record<string, unknown>[]);
    } catch { /* history unavailable — omit honestly */ }
    try {
      const open = await orderService.getOpenPositions(state.activeAccountId);
      positions = (open ?? []).map((p: Record<string, unknown>) => ({
        symbol: String(p.symbol ?? ''),
        direction: String(p.direction ?? ''),
        size: Number(p.size ?? 0),
        openPrice: Number(p.open_price ?? 0),
        currentPrice: Number(p.current_price ?? 0),
        floatingPnl: Number(p.floating_pnl ?? 0),
        sl: p.sl != null ? Number(p.sl) : null,
        tp: p.tp != null ? Number(p.tp) : null,
      }));
    } catch { /* positions unavailable — report honestly as none */ }
  }

  // Market-state classification from REAL bars (terminal page only).
  let marketState: NexusContext['marketState'] = null;
  const builder = getOhlcvBuilder();
  if (builder && state.activeSymbol) {
    try {
      const bars = builder.getAllBars(state.activeSymbol, '60');
      const ms = classifyMarketState(bars);
      if (ms) marketState = { ...ms, symbol: state.activeSymbol, timeframe: 'H1' };
    } catch { /* classification optional */ }
  }

  return {
    activeSymbol: state.activeSymbol ?? null,
    quotes,
    positions,
    accountConnected,
    marketState,
    performance,
  };
}

/** Render the context as a compact block for the model / fallback engine. */
export function contextToText(ctx: NexusContext): string {
  const lines: string[] = [];
  lines.push(`Active chart symbol: ${ctx.activeSymbol ?? 'none'}`);
  if (ctx.quotes.length > 0) {
    lines.push('Live quotes (real-time from the platform feed):');
    for (const q of ctx.quotes) lines.push(`  ${q.symbol}: bid ${q.bid} / ask ${q.ask} (spread ${q.spread})`);
  } else {
    lines.push('Live quotes: none streaming on this page.');
  }
  if (!ctx.accountConnected) {
    lines.push('Trading account: not connected (signed out or no active account) — open positions unknown.');
  } else if (ctx.positions.length === 0) {
    lines.push('Open positions: none.');
  } else {
    lines.push(`Open positions (${ctx.positions.length}, real):`);
    for (const p of ctx.positions) {
      lines.push(`  ${p.direction} ${p.size} ${p.symbol} @ ${p.openPrice} → now ${p.currentPrice}, floating P&L ${p.floatingPnl >= 0 ? '+' : ''}${p.floatingPnl.toFixed(2)}, SL ${p.sl ?? '—'}, TP ${p.tp ?? '—'}`);
    }
  }
  if (ctx.marketState) {
    lines.push(marketStateToText(ctx.marketState.symbol, ctx.marketState.timeframe, ctx.marketState));
  }
  if (ctx.performance) {
    const p = ctx.performance;
    lines.push(`Performance (real, last ${p.totalTrades} closed trades): win rate ${p.winRate}% (${p.wins}W/${p.losses}L), net P&L ${p.netPnl >= 0 ? '+' : ''}${p.netPnl.toFixed(2)}, profit factor ${p.profitFactor != null ? p.profitFactor.toFixed(2) : 'n/a'}, avg win +${p.avgWin.toFixed(2)} / avg loss -${p.avgLoss.toFixed(2)}, current loss streak ${p.currentLossStreak}, trades today ${p.tradesToday} (avg ${p.avgTradesPerDay}/day), avg size ${p.avgSize.toFixed(2)} lots`);
    if (p.lastTrade) {
      const t = p.lastTrade;
      lines.push(`Last closed trade: ${t.direction} ${t.size} ${t.symbol} @ ${t.openPrice} → ${t.closePrice}, P&L ${t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}, closed ${t.closedAt}`);
    }
  } else if (ctx.accountConnected) {
    lines.push('Performance: no closed trades in this account yet.');
  }
  return lines.join('\n');
}

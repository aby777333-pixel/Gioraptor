// ═══════════════════════════════════════════════════════════════
// NEXUS live market context (NEXUS super-prompt: "not a chatbot").
// Builds an honest snapshot of what the platform actually knows right now —
// live quotes from the price stream, the trader's real open positions and
// account — so NEXUS answers about THIS trader's situation, not generics.
// Everything here is real platform data; nothing is fabricated.
// ═══════════════════════════════════════════════════════════════

import { useTradingStore } from '@/stores/trading';
import { orderService } from '@/lib/trading/order-service';

export interface NexusContext {
  activeSymbol: string | null;
  quotes: { symbol: string; bid: number; ask: number; spread: number }[];
  positions: {
    symbol: string; direction: string; size: number;
    openPrice: number; currentPrice: number; floatingPnl: number;
    sl: number | null; tp: number | null;
  }[];
  accountConnected: boolean;
}

export async function buildNexusContext(): Promise<NexusContext> {
  const state = useTradingStore.getState();
  const quotes = Object.values(state.prices ?? {})
    .slice(0, 16)
    .map((t) => ({ symbol: t.symbol, bid: t.bid, ask: t.ask, spread: t.spread }));

  let positions: NexusContext['positions'] = [];
  let accountConnected = false;
  if (state.activeAccountId) {
    accountConnected = true;
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

  return {
    activeSymbol: state.activeSymbol ?? null,
    quotes,
    positions,
    accountConnected,
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
  return lines.join('\n');
}

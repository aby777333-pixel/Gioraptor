'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X } from 'lucide-react';
import { useTradingStore } from '@/stores/trading';
import { orderService } from '@/lib/trading/order-service';
import { formatPrice, formatPnL, formatLot, cn } from '@/lib/utils/format';
import type { Position, Order } from '@/types/trading';

type TabKey = 'positions' | 'pending' | 'history';

function getDecimals(symbol: string): number {
  if (symbol === 'USDJPY') return 3;
  if (symbol.startsWith('XAU')) return 2;
  if (symbol.startsWith('BTC') || symbol === 'US30' || symbol === 'NAS100') return 1;
  if (symbol.startsWith('ETH')) return 2;
  return 5;
}

function calcFloatingPnl(pos: Position, currentBid: number, currentAsk: number): number {
  // For BUY positions, PnL is based on selling at bid
  // For SELL positions, PnL is based on buying at ask
  const closePrice = pos.direction === 'BUY' ? currentBid : currentAsk;
  if (!closePrice || closePrice <= 0) return pos.floating_pnl;

  // Standard forex contract size is 100,000
  const contractSize = 100000;
  let pnl: number;
  if (pos.direction === 'BUY') {
    pnl = (closePrice - pos.open_price) * pos.size * contractSize;
  } else {
    pnl = (pos.open_price - closePrice) * pos.size * contractSize;
  }

  // JPY pair adjustment
  if (pos.symbol === 'USDJPY' || pos.symbol.endsWith('JPY')) {
    pnl = pnl / 100;
  }
  // Gold uses contract size of 100 typically
  if (pos.symbol.startsWith('XAU')) {
    pnl = (pos.direction === 'BUY' ? closePrice - pos.open_price : pos.open_price - closePrice) * pos.size * 100;
  }

  return pnl;
}

export default function PositionsPanel() {
  const {
    activeAccountId,
    prices,
    refreshPositions,
    setPositions,
    setPendingOrders,
    setAccountSummary,
    triggerRefresh,
  } = useTradingStore();

  const [activeTab, setActiveTab] = useState<TabKey>('positions');
  const [openPositions, setOpenPositions] = useState<Position[]>([]);
  const [pendingOrders, setPendingOrdersLocal] = useState<Order[]>([]);
  const [tradeHistory, setTradeHistory] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Track positions with live PnL
  const [livePnl, setLivePnl] = useState<Record<string, number>>({});

  const loadData = useCallback(async () => {
    if (!activeAccountId) {
      setOpenPositions([]);
      setPendingOrdersLocal([]);
      setTradeHistory([]);
      return;
    }

    setIsLoading(true);
    try {
      const [positions, orders, history, summary] = await Promise.all([
        orderService.getOpenPositions(activeAccountId),
        orderService.getPendingOrders(activeAccountId),
        orderService.getTradeHistory(activeAccountId),
        orderService.getAccountSummary(activeAccountId),
      ]);

      const positionsData = (positions ?? []) as Position[];
      const ordersData = (orders ?? []) as Order[];
      const historyData = (history ?? []) as Position[];

      setOpenPositions(positionsData);
      setPositions(positionsData);
      setPendingOrdersLocal(ordersData);
      setPendingOrders(ordersData);
      setTradeHistory(historyData);

      if (summary?.success) {
        setAccountSummary({
          balance: summary.balance,
          equity: summary.equity,
          margin_used: summary.margin_used,
          free_margin: summary.free_margin,
          margin_level_pct: summary.margin_level_pct,
          floating_pnl: summary.floating_pnl,
          open_positions_count: summary.open_positions_count,
        });
      }
    } catch (err) {
      console.error('Failed to load trading data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeAccountId, setPositions, setPendingOrders, setAccountSummary]);

  // Load data on mount and when refresh is triggered
  useEffect(() => {
    loadData();
  }, [loadData, refreshPositions]);

  // Update floating PnL in real-time from price ticks
  const prevPricesRef = useRef(prices);
  useEffect(() => {
    if (openPositions.length === 0) return;
    // Only recompute when prices actually change
    if (prevPricesRef.current === prices) return;
    prevPricesRef.current = prices;

    const updated: Record<string, number> = {};
    for (const pos of openPositions) {
      const tick = prices[pos.symbol];
      if (tick) {
        updated[pos.id] = calcFloatingPnl(pos, tick.bid, tick.ask);
      } else {
        updated[pos.id] = pos.floating_pnl;
      }
    }
    setLivePnl(updated);
  }, [prices, openPositions]);

  function getPnl(pos: Position): number {
    return livePnl[pos.id] ?? pos.floating_pnl;
  }

  const totalProfit = openPositions.reduce((s, p) => s + getPnl(p), 0);
  const totalSwap = openPositions.reduce((s, p) => s + (p.swap_accrued ?? 0), 0);
  const totalCommission = openPositions.reduce((s, p) => s + (p.commission ?? 0), 0);

  async function handleClosePosition(pos: Position) {
    const tick = prices[pos.symbol];
    const closePrice = pos.direction === 'BUY' ? tick?.bid : tick?.ask;
    if (!closePrice || closePrice <= 0) {
      setFeedback({ type: 'error', message: 'No price available to close position' });
      setTimeout(() => setFeedback(null), 4000);
      return;
    }

    setClosingId(pos.id);
    setFeedback(null);
    try {
      const result = await orderService.closePosition(pos.id, closePrice);
      if (result?.success) {
        setFeedback({
          type: 'success',
          message: `Closed ${pos.symbol} ${pos.direction} @ ${formatPrice(closePrice, getDecimals(pos.symbol))} | PnL: ${formatPnL(result.realized_pnl)}`,
        });
        triggerRefresh();
      } else {
        setFeedback({ type: 'error', message: result?.error || 'Failed to close position' });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error closing position';
      setFeedback({ type: 'error', message });
    } finally {
      setClosingId(null);
      setTimeout(() => setFeedback(null), 5000);
    }
  }

  async function handleCancelOrder(orderId: string) {
    setCancellingId(orderId);
    setFeedback(null);
    try {
      const result = await orderService.cancelOrder(orderId);
      if (result?.success) {
        setFeedback({ type: 'success', message: 'Order cancelled' });
        triggerRefresh();
      } else {
        setFeedback({ type: 'error', message: result?.error || 'Failed to cancel order' });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error cancelling order';
      setFeedback({ type: 'error', message });
    } finally {
      setCancellingId(null);
      setTimeout(() => setFeedback(null), 4000);
    }
  }

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'positions', label: 'Open Positions', count: openPositions.length },
    { key: 'pending', label: 'Pending Orders', count: pendingOrders.length },
    { key: 'history', label: 'History', count: tradeHistory.length },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div
        className="flex border-b shrink-0"
        style={{ borderColor: 'var(--border)' }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2 text-xs font-medium transition-all border-b-2',
              activeTab === tab.key
                ? 'border-[#29ABE2] opacity-100'
                : 'border-transparent opacity-50 hover:opacity-70'
            )}
          >
            {tab.label}
            {tab.count > 0 && (
              <span
                className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: 'var(--bg-elevated)' }}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          className={cn(
            'text-xs px-3 py-1.5 font-medium',
            feedback.type === 'success'
              ? 'bg-green-600/20 text-green-400'
              : 'bg-red-600/20 text-red-400'
          )}
        >
          {feedback.message}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isLoading && openPositions.length === 0 && (
          <div className="flex items-center justify-center h-32 text-xs opacity-30">
            Loading...
          </div>
        )}

        {activeTab === 'positions' && (
          <>
            {openPositions.length === 0 && !isLoading ? (
              <div className="flex items-center justify-center h-32 text-xs opacity-30">
                {activeAccountId ? 'No open positions' : 'Select a trading account'}
              </div>
            ) : (
              <>
                {/* Table header */}
                <div
                  className="grid grid-cols-[80px_50px_55px_75px_75px_65px_65px_55px_55px_70px_30px] gap-1 px-3 py-1.5 text-[10px] uppercase tracking-wider opacity-40 border-b sticky top-0"
                  style={{
                    borderColor: 'var(--border)',
                    backgroundColor: 'var(--bg-surface)',
                  }}
                >
                  <span>Symbol</span>
                  <span>Dir</span>
                  <span className="text-right">Size</span>
                  <span className="text-right">Open</span>
                  <span className="text-right">Current</span>
                  <span className="text-right">SL</span>
                  <span className="text-right">TP</span>
                  <span className="text-right">Swap</span>
                  <span className="text-right">Comm</span>
                  <span className="text-right">Profit</span>
                  <span />
                </div>

                {/* Position rows */}
                {openPositions.map((pos) => {
                  const dec = getDecimals(pos.symbol);
                  const pnl = getPnl(pos);
                  const isProfitable = pnl >= 0;
                  const tick = prices[pos.symbol];
                  const currentPrice = pos.direction === 'BUY'
                    ? (tick?.bid ?? pos.current_price)
                    : (tick?.ask ?? pos.current_price);

                  return (
                    <div
                      key={pos.id}
                      className="grid grid-cols-[80px_50px_55px_75px_75px_65px_65px_55px_55px_70px_30px] gap-1 px-3 py-1.5 text-xs border-b hover:opacity-90 transition-opacity"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <span className="font-medium">{pos.symbol}</span>
                      <span
                        className={cn(
                          'font-bold text-[10px]',
                          pos.direction === 'BUY'
                            ? 'text-green-400'
                            : 'text-red-400'
                        )}
                      >
                        {pos.direction}
                      </span>
                      <span className="font-mono text-right">
                        {formatLot(pos.size)}
                      </span>
                      <span className="font-mono text-right">
                        {formatPrice(pos.open_price, dec)}
                      </span>
                      <span className="font-mono text-right">
                        {formatPrice(currentPrice, dec)}
                      </span>
                      <span className="font-mono text-right opacity-60">
                        {pos.sl ? formatPrice(pos.sl, dec) : '--'}
                      </span>
                      <span className="font-mono text-right opacity-60">
                        {pos.tp ? formatPrice(pos.tp, dec) : '--'}
                      </span>
                      <span className="font-mono text-right opacity-60">
                        {(pos.swap_accrued ?? 0).toFixed(2)}
                      </span>
                      <span className="font-mono text-right opacity-60">
                        {(pos.commission ?? 0).toFixed(2)}
                      </span>
                      <span
                        className={cn(
                          'font-mono text-right font-bold',
                          isProfitable ? 'text-green-400' : 'text-red-400'
                        )}
                      >
                        {formatPnL(pnl)}
                      </span>
                      <button
                        onClick={() => handleClosePosition(pos)}
                        disabled={closingId === pos.id}
                        className={cn(
                          'flex items-center justify-center hover:text-red-400 transition-colors opacity-50 hover:opacity-100',
                          closingId === pos.id && 'opacity-20 cursor-not-allowed'
                        )}
                        title="Close position"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}

                {/* Summary row */}
                {openPositions.length > 0 && (
                  <div
                    className="grid grid-cols-[80px_50px_55px_75px_75px_65px_65px_55px_55px_70px_30px] gap-1 px-3 py-2 text-xs font-bold border-t"
                    style={{
                      borderColor: 'var(--border)',
                      backgroundColor: 'var(--bg-elevated)',
                    }}
                  >
                    <span className="col-span-7 opacity-50">Total</span>
                    <span className="font-mono text-right opacity-60">
                      {totalSwap.toFixed(2)}
                    </span>
                    <span className="font-mono text-right opacity-60">
                      {totalCommission.toFixed(2)}
                    </span>
                    <span
                      className={cn(
                        'font-mono text-right',
                        totalProfit >= 0 ? 'text-green-400' : 'text-red-400'
                      )}
                    >
                      {formatPnL(totalProfit)}
                    </span>
                    <span />
                  </div>
                )}
              </>
            )}
          </>
        )}

        {activeTab === 'pending' && (
          <>
            {pendingOrders.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-xs opacity-30">
                No pending orders
              </div>
            ) : (
              <>
                <div
                  className="grid grid-cols-[80px_50px_55px_60px_75px_65px_65px_60px_30px] gap-1 px-3 py-1.5 text-[10px] uppercase tracking-wider opacity-40 border-b sticky top-0"
                  style={{
                    borderColor: 'var(--border)',
                    backgroundColor: 'var(--bg-surface)',
                  }}
                >
                  <span>Symbol</span>
                  <span>Dir</span>
                  <span>Type</span>
                  <span className="text-right">Size</span>
                  <span className="text-right">Price</span>
                  <span className="text-right">SL</span>
                  <span className="text-right">TP</span>
                  <span>Status</span>
                  <span />
                </div>

                {pendingOrders.map((ord) => {
                  const dec = getDecimals(ord.symbol);
                  return (
                    <div
                      key={ord.id}
                      className="grid grid-cols-[80px_50px_55px_60px_75px_65px_65px_60px_30px] gap-1 px-3 py-1.5 text-xs border-b hover:opacity-90 transition-opacity"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <span className="font-medium">{ord.symbol}</span>
                      <span
                        className={cn(
                          'font-bold text-[10px]',
                          ord.direction === 'BUY'
                            ? 'text-green-400'
                            : 'text-red-400'
                        )}
                      >
                        {ord.direction}
                      </span>
                      <span className="capitalize opacity-60">
                        {ord.order_type}
                      </span>
                      <span className="font-mono text-right">
                        {formatLot(ord.requested_size)}
                      </span>
                      <span className="font-mono text-right">
                        {ord.requested_price
                          ? formatPrice(ord.requested_price, dec)
                          : '--'}
                      </span>
                      <span className="font-mono text-right opacity-60">
                        {ord.sl ? formatPrice(ord.sl, dec) : '--'}
                      </span>
                      <span className="font-mono text-right opacity-60">
                        {ord.tp ? formatPrice(ord.tp, dec) : '--'}
                      </span>
                      <span className="text-[10px] opacity-50 capitalize">
                        {ord.status.replace(/_/g, ' ')}
                      </span>
                      <button
                        onClick={() => handleCancelOrder(ord.id)}
                        disabled={cancellingId === ord.id}
                        className={cn(
                          'flex items-center justify-center hover:text-red-400 transition-colors opacity-50 hover:opacity-100',
                          cancellingId === ord.id && 'opacity-20 cursor-not-allowed'
                        )}
                        title="Cancel order"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}

        {activeTab === 'history' && (
          <>
            {tradeHistory.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-xs opacity-30">
                No trade history available
              </div>
            ) : (
              <>
                <div
                  className="grid grid-cols-[80px_50px_55px_75px_75px_70px_80px] gap-1 px-3 py-1.5 text-[10px] uppercase tracking-wider opacity-40 border-b sticky top-0"
                  style={{
                    borderColor: 'var(--border)',
                    backgroundColor: 'var(--bg-surface)',
                  }}
                >
                  <span>Symbol</span>
                  <span>Dir</span>
                  <span className="text-right">Size</span>
                  <span className="text-right">Open</span>
                  <span className="text-right">Close</span>
                  <span className="text-right">PnL</span>
                  <span className="text-right">Closed</span>
                </div>

                {tradeHistory.map((pos) => {
                  const dec = getDecimals(pos.symbol);
                  const pnl = pos.realized_pnl ?? 0;
                  const isProfitable = pnl >= 0;
                  const closedDate = pos.closed_at
                    ? new Date(pos.closed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : '--';

                  return (
                    <div
                      key={pos.id}
                      className="grid grid-cols-[80px_50px_55px_75px_75px_70px_80px] gap-1 px-3 py-1.5 text-xs border-b hover:opacity-90 transition-opacity"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <span className="font-medium">{pos.symbol}</span>
                      <span
                        className={cn(
                          'font-bold text-[10px]',
                          pos.direction === 'BUY'
                            ? 'text-green-400'
                            : 'text-red-400'
                        )}
                      >
                        {pos.direction}
                      </span>
                      <span className="font-mono text-right">
                        {formatLot(pos.size)}
                      </span>
                      <span className="font-mono text-right">
                        {formatPrice(pos.open_price, dec)}
                      </span>
                      <span className="font-mono text-right">
                        {pos.close_price ? formatPrice(pos.close_price, dec) : '--'}
                      </span>
                      <span
                        className={cn(
                          'font-mono text-right font-bold',
                          isProfitable ? 'text-green-400' : 'text-red-400'
                        )}
                      >
                        {formatPnL(pnl)}
                      </span>
                      <span className="text-right opacity-50">{closedDate}</span>
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useMemo } from 'react';
import { useTradingStore } from '@/stores/trading';
import { orderService } from '@/lib/trading/order-service';
import { formatPrice, formatCurrency, cn } from '@/lib/utils/format';

type OrderTypeOption = 'market' | 'limit' | 'stop';

function getDecimals(symbol: string): number {
  if (symbol === 'USDJPY') return 3;
  if (symbol.startsWith('XAU')) return 2;
  if (symbol.startsWith('BTC') || symbol === 'US30' || symbol === 'NAS100') return 1;
  if (symbol.startsWith('ETH')) return 2;
  return 5;
}

export default function OrderTicket() {
  const {
    activeSymbol,
    prices,
    orderDirection,
    setOrderDirection,
    activeAccountId,
    triggerRefresh,
  } = useTradingStore();

  const [lotSize, setLotSize] = useState('0.01');
  const [orderType, setOrderType] = useState<OrderTypeOption>('market');
  const [price, setPrice] = useState('');
  const [slValue, setSlValue] = useState('');
  const [tpValue, setTpValue] = useState('');
  const [isPlacing, setIsPlacing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const tick = prices[activeSymbol];
  const decimals = getDecimals(activeSymbol);

  const bid = tick?.bid ?? 0;
  const ask = tick?.ask ?? 0;

  const lots = parseFloat(lotSize) || 0;
  const marginEstimate = useMemo(() => {
    const entryPrice = orderDirection === 'BUY' ? ask : bid;
    if (!entryPrice || lots <= 0) return 0;
    const contractSize = 100000;
    const leverage = 500;
    return (lots * contractSize * entryPrice) / leverage;
  }, [orderDirection, ask, bid, lots]);

  const isBuy = orderDirection === 'BUY';
  const showPriceInput = orderType !== 'market';

  async function handlePlaceOrder() {
    if (!activeAccountId) {
      setFeedback({ type: 'error', message: 'No trading account selected' });
      return;
    }

    if (lots <= 0) return;

    setIsPlacing(true);
    setFeedback(null);

    try {
      if (orderType === 'market') {
        const fillPrice = isBuy ? ask : bid;
        if (fillPrice <= 0) {
          setFeedback({ type: 'error', message: 'No price available. Wait for market data.' });
          setIsPlacing(false);
          return;
        }

        const result = await orderService.placeMarketOrder({
          accountId: activeAccountId,
          symbol: activeSymbol,
          direction: orderDirection,
          size: lots,
          sl: slValue ? parseFloat(slValue) : undefined,
          tp: tpValue ? parseFloat(tpValue) : undefined,
          fillPrice,
        });

        if (result?.success) {
          setFeedback({
            type: 'success',
            message: `${orderDirection} ${lots} ${activeSymbol} filled @ ${formatPrice(result.fill_price, decimals)}`,
          });
          setSlValue('');
          setTpValue('');
          triggerRefresh();
        } else {
          setFeedback({ type: 'error', message: result?.error || 'Order failed' });
        }
      } else {
        const orderPrice = parseFloat(price);
        if (!orderPrice || orderPrice <= 0) {
          setFeedback({ type: 'error', message: 'Enter a valid price for pending order' });
          setIsPlacing(false);
          return;
        }

        const result = await orderService.placePendingOrder({
          accountId: activeAccountId,
          symbol: activeSymbol,
          direction: orderDirection,
          orderType: orderType,
          size: lots,
          price: orderPrice,
          sl: slValue ? parseFloat(slValue) : undefined,
          tp: tpValue ? parseFloat(tpValue) : undefined,
        });

        if (result?.success) {
          setFeedback({
            type: 'success',
            message: `${orderType.toUpperCase()} ${orderDirection} ${lots} ${activeSymbol} @ ${formatPrice(orderPrice, decimals)} placed`,
          });
          setPrice('');
          setSlValue('');
          setTpValue('');
          triggerRefresh();
        } else {
          setFeedback({ type: 'error', message: result?.error || 'Order failed' });
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unexpected error placing order';
      setFeedback({ type: 'error', message });
    } finally {
      setIsPlacing(false);
      setTimeout(() => setFeedback(null), 5000);
    }
  }

  return (
    <div className="flex flex-col h-full p-3 gap-3">
      {/* BUY / SELL toggle */}
      <div className="grid grid-cols-2 gap-1 rounded overflow-hidden">
        <button
          onClick={() => setOrderDirection('BUY')}
          className={cn(
            'py-2 text-sm font-bold transition-all uppercase tracking-wider',
            isBuy
              ? 'bg-green-600 text-white'
              : 'bg-green-600/10 text-green-400 hover:bg-green-600/20'
          )}
        >
          Buy
        </button>
        <button
          onClick={() => setOrderDirection('SELL')}
          className={cn(
            'py-2 text-sm font-bold transition-all uppercase tracking-wider',
            !isBuy
              ? 'bg-red-600 text-white'
              : 'bg-red-600/10 text-red-400 hover:bg-red-600/20'
          )}
        >
          Sell
        </button>
      </div>

      {/* Symbol display */}
      <div className="text-center">
        <span className="text-lg font-bold" style={{ color: '#29ABE2' }}>
          {activeSymbol}
        </span>
      </div>

      {/* Bid / Ask display */}
      <div className="grid grid-cols-2 gap-2 text-center">
        <div
          className="rounded p-2"
          style={{ backgroundColor: 'var(--bg-elevated)' }}
        >
          <div className="text-[10px] uppercase opacity-40 mb-0.5">Bid</div>
          <div className="font-mono text-lg font-bold text-red-400">
            {bid > 0 ? formatPrice(bid, decimals) : '--'}
          </div>
        </div>
        <div
          className="rounded p-2"
          style={{ backgroundColor: 'var(--bg-elevated)' }}
        >
          <div className="text-[10px] uppercase opacity-40 mb-0.5">Ask</div>
          <div className="font-mono text-lg font-bold text-green-400">
            {ask > 0 ? formatPrice(ask, decimals) : '--'}
          </div>
        </div>
      </div>

      {/* Lot size */}
      <div>
        <label className="text-[10px] uppercase tracking-wider opacity-50 mb-1 block">
          Lot Size
        </label>
        <input
          type="number"
          value={lotSize}
          onChange={(e) => setLotSize(e.target.value)}
          step={0.01}
          min={0.01}
          className="w-full px-3 py-1.5 rounded text-sm font-mono outline-none border"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border)',
          }}
        />
      </div>

      {/* Order type */}
      <div>
        <label className="text-[10px] uppercase tracking-wider opacity-50 mb-1 block">
          Order Type
        </label>
        <select
          value={orderType}
          onChange={(e) => setOrderType(e.target.value as OrderTypeOption)}
          className="w-full px-3 py-1.5 rounded text-sm outline-none border appearance-none cursor-pointer"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border)',
          }}
        >
          <option value="market">Market</option>
          <option value="limit">Limit</option>
          <option value="stop">Stop</option>
        </select>
      </div>

      {/* Price input (limit/stop only) */}
      {showPriceInput && (
        <div>
          <label className="text-[10px] uppercase tracking-wider opacity-50 mb-1 block">
            Price
          </label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            step={Math.pow(10, -decimals)}
            placeholder={formatPrice(isBuy ? ask : bid, decimals)}
            className="w-full px-3 py-1.5 rounded text-sm font-mono outline-none border"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border)',
            }}
          />
        </div>
      )}

      {/* SL / TP */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] uppercase tracking-wider opacity-50 mb-1 block">
            Stop Loss
          </label>
          <input
            type="number"
            value={slValue}
            onChange={(e) => setSlValue(e.target.value)}
            step={Math.pow(10, -decimals)}
            placeholder="Price"
            className="w-full px-3 py-1.5 rounded text-sm font-mono outline-none border"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border)',
            }}
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider opacity-50 mb-1 block">
            Take Profit
          </label>
          <input
            type="number"
            value={tpValue}
            onChange={(e) => setTpValue(e.target.value)}
            step={Math.pow(10, -decimals)}
            placeholder="Price"
            className="w-full px-3 py-1.5 rounded text-sm font-mono outline-none border"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border)',
            }}
          />
        </div>
      </div>

      {/* Margin preview */}
      <div
        className="text-xs rounded px-3 py-2 flex justify-between"
        style={{ backgroundColor: 'var(--bg-elevated)' }}
      >
        <span className="opacity-50">Est. Margin</span>
        <span className="font-mono">{formatCurrency(marginEstimate)}</span>
      </div>

      {/* Feedback toast */}
      {feedback && (
        <div
          className={cn(
            'text-xs rounded px-3 py-2 font-medium',
            feedback.type === 'success'
              ? 'bg-green-600/20 text-green-400 border border-green-600/30'
              : 'bg-red-600/20 text-red-400 border border-red-600/30'
          )}
        >
          {feedback.message}
        </div>
      )}

      {/* Place Order button */}
      <button
        onClick={handlePlaceOrder}
        disabled={lots <= 0 || isPlacing}
        className={cn(
          'w-full py-2.5 rounded font-bold text-sm uppercase tracking-wider transition-all',
          isBuy
            ? 'bg-green-600 hover:bg-green-500 text-white'
            : 'bg-red-600 hover:bg-red-500 text-white',
          (lots <= 0 || isPlacing) && 'opacity-40 cursor-not-allowed'
        )}
      >
        {isPlacing
          ? 'Placing...'
          : isBuy
            ? 'Place Buy Order'
            : 'Place Sell Order'}
      </button>
    </div>
  );
}

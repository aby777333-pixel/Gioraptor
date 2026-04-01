'use client';

import { useState, useMemo } from 'react';
import { useTradingStore } from '@/stores/trading';
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
  const { activeSymbol, prices, orderDirection, setOrderDirection, accountSummary } =
    useTradingStore();

  const [lotSize, setLotSize] = useState('0.01');
  const [orderType, setOrderType] = useState<OrderTypeOption>('market');
  const [price, setPrice] = useState('');
  const [slValue, setSlValue] = useState('');
  const [tpValue, setTpValue] = useState('');

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

  function handlePlaceOrder() {
    // Order placement will be connected to the backend later
    console.log('Place order:', {
      symbol: activeSymbol,
      direction: orderDirection,
      type: orderType,
      lots: parseFloat(lotSize),
      price: showPriceInput ? parseFloat(price) : null,
      sl: slValue ? parseFloat(slValue) : null,
      tp: tpValue ? parseFloat(tpValue) : null,
    });
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

      {/* Place Order button */}
      <button
        onClick={handlePlaceOrder}
        disabled={lots <= 0}
        className={cn(
          'w-full py-2.5 rounded font-bold text-sm uppercase tracking-wider transition-all',
          isBuy
            ? 'bg-green-600 hover:bg-green-500 text-white'
            : 'bg-red-600 hover:bg-red-500 text-white',
          lots <= 0 && 'opacity-40 cursor-not-allowed'
        )}
      >
        {isBuy ? 'Place Buy Order' : 'Place Sell Order'}
      </button>
    </div>
  );
}

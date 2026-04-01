'use client';

import { useState, useMemo, useCallback } from 'react';
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

function getPipSize(symbol: string): number {
  if (symbol === 'USDJPY') return 0.01;
  if (symbol.startsWith('XAU')) return 0.1;
  if (symbol.startsWith('XAG')) return 0.01;
  if (symbol.startsWith('BTC')) return 1;
  if (symbol.startsWith('ETH')) return 0.1;
  if (symbol === 'US30' || symbol === 'NAS100' || symbol === 'SPX500') return 1;
  return 0.0001;
}

function getContractSize(symbol: string): number {
  if (symbol.startsWith('XAU')) return 100;
  if (symbol.startsWith('XAG')) return 5000;
  if (symbol.startsWith('BTC')) return 1;
  if (symbol.startsWith('ETH')) return 1;
  if (symbol === 'US30' || symbol === 'NAS100' || symbol === 'SPX500') return 1;
  return 100000;
}

function calcPipValue(symbol: string, lotSize: number): number {
  const pipSize = getPipSize(symbol);
  const contractSize = getContractSize(symbol);
  if (symbol.endsWith('USD') || symbol === 'XAUUSD' || symbol === 'XAGUSD') {
    return lotSize * contractSize * pipSize;
  }
  if (symbol === 'USDJPY') {
    return lotSize * contractSize * pipSize / 150;
  }
  return lotSize * contractSize * pipSize;
}

export default function OrderTicket() {
  const {
    activeSymbol,
    prices,
    orderDirection,
    setOrderDirection,
    activeAccountId,
    accountSummary,
    triggerRefresh,
  } = useTradingStore();

  const [lotSize, setLotSize] = useState('0.01');
  const [orderType, setOrderType] = useState<OrderTypeOption>('market');
  const [price, setPrice] = useState('');
  const [slValue, setSlValue] = useState('');
  const [tpValue, setTpValue] = useState('');
  const [isPlacing, setIsPlacing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [slTpMode, setSlTpMode] = useState<'price' | 'pips'>('price');

  const tick = prices[activeSymbol];
  const decimals = getDecimals(activeSymbol);
  const pipSize = getPipSize(activeSymbol);

  const bid = tick?.bid ?? 0;
  const ask = tick?.ask ?? 0;

  const lots = parseFloat(lotSize) || 0;
  const isBuy = orderDirection === 'BUY';
  const showPriceInput = orderType !== 'market';

  const entryPrice = useMemo(() => {
    if (orderType === 'market') return isBuy ? ask : bid;
    return parseFloat(price) || (isBuy ? ask : bid);
  }, [orderType, isBuy, ask, bid, price]);

  // Resolved SL/TP prices (handle pips mode)
  const resolvedSL = useMemo(() => {
    const v = parseFloat(slValue);
    if (!v || v <= 0) return 0;
    if (slTpMode === 'price') return v;
    // pips mode: convert pips to price distance
    return isBuy ? entryPrice - v * pipSize : entryPrice + v * pipSize;
  }, [slValue, slTpMode, isBuy, entryPrice, pipSize]);

  const resolvedTP = useMemo(() => {
    const v = parseFloat(tpValue);
    if (!v || v <= 0) return 0;
    if (slTpMode === 'price') return v;
    return isBuy ? entryPrice + v * pipSize : entryPrice - v * pipSize;
  }, [tpValue, slTpMode, isBuy, entryPrice, pipSize]);

  // Margin estimate
  const marginEstimate = useMemo(() => {
    if (!entryPrice || lots <= 0) return 0;
    const contractSize = getContractSize(activeSymbol);
    const leverage = 500;
    return (lots * contractSize * entryPrice) / leverage;
  }, [entryPrice, lots, activeSymbol]);

  // Pip value
  const pipValue = useMemo(() => calcPipValue(activeSymbol, lots), [activeSymbol, lots]);

  // Risk calculation
  const riskCalc = useMemo(() => {
    if (!resolvedSL || entryPrice <= 0 || lots <= 0) return null;
    const slDistancePips = Math.abs(entryPrice - resolvedSL) / pipSize;
    const riskAmount = slDistancePips * pipValue;
    const balance = accountSummary.balance || 0;
    const riskPct = balance > 0 ? (riskAmount / balance) * 100 : 0;
    return { riskAmount, riskPct, slDistancePips };
  }, [resolvedSL, entryPrice, lots, pipSize, pipValue, accountSummary.balance]);

  // R:R ratio
  const rrRatio = useMemo(() => {
    if (!resolvedSL || !resolvedTP || entryPrice <= 0) return null;
    const risk = Math.abs(entryPrice - resolvedSL);
    const reward = Math.abs(resolvedTP - entryPrice);
    if (risk <= 0) return null;
    return reward / risk;
  }, [resolvedSL, resolvedTP, entryPrice]);

  // Risk preset: auto-calculate lot size for a given risk %
  const applyRiskPreset = useCallback(
    (pct: number) => {
      const balance = accountSummary.balance;
      if (!balance || balance <= 0) return;

      // Need SL distance
      let slPips = 0;
      if (resolvedSL && entryPrice > 0) {
        slPips = Math.abs(entryPrice - resolvedSL) / pipSize;
      } else if (slTpMode === 'pips' && parseFloat(slValue) > 0) {
        slPips = parseFloat(slValue);
      } else {
        // Default 50 pips if no SL set
        slPips = 50;
      }

      if (slPips <= 0) return;

      const riskAmount = balance * (pct / 100);
      const pipVal1Lot = calcPipValue(activeSymbol, 1);
      if (pipVal1Lot <= 0) return;
      const newLots = riskAmount / (slPips * pipVal1Lot);
      setLotSize((Math.floor(newLots * 100) / 100).toFixed(2));
    },
    [accountSummary.balance, resolvedSL, entryPrice, pipSize, slTpMode, slValue, activeSymbol]
  );

  // Risk color
  const riskColor = useMemo(() => {
    if (!riskCalc) return '#888';
    if (riskCalc.riskPct < 2) return '#00C853';
    if (riskCalc.riskPct <= 5) return '#FFC107';
    return '#FF5252';
  }, [riskCalc]);

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
          sl: resolvedSL > 0 ? resolvedSL : undefined,
          tp: resolvedTP > 0 ? resolvedTP : undefined,
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
          sl: resolvedSL > 0 ? resolvedSL : undefined,
          tp: resolvedTP > 0 ? resolvedTP : undefined,
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
    <div className="flex flex-col h-full p-3 gap-2">
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
        <span className="text-base font-bold" style={{ color: '#29ABE2' }}>
          {activeSymbol}
        </span>
      </div>

      {/* Bid / Ask display */}
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded p-1.5" style={{ backgroundColor: 'var(--bg-elevated)' }}>
          <div className="text-[9px] uppercase opacity-40 mb-0.5">Bid</div>
          <div className="font-mono text-base font-bold text-red-400">
            {bid > 0 ? formatPrice(bid, decimals) : '--'}
          </div>
        </div>
        <div className="rounded p-1.5" style={{ backgroundColor: 'var(--bg-elevated)' }}>
          <div className="text-[9px] uppercase opacity-40 mb-0.5">Ask</div>
          <div className="font-mono text-base font-bold text-green-400">
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

      {/* Risk preset buttons */}
      <div>
        <label className="text-[10px] uppercase tracking-wider opacity-50 mb-1 block">
          Risk Presets
        </label>
        <div className="grid grid-cols-4 gap-1">
          {[0.5, 1, 2, 5].map((pct) => (
            <button
              key={pct}
              onClick={() => applyRiskPreset(pct)}
              className="py-1 text-[10px] font-bold rounded transition-all hover:opacity-80"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: pct <= 1 ? '#00C853' : pct <= 2 ? '#FFC107' : '#FF5252',
              }}
            >
              {pct}%
            </button>
          ))}
        </div>
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

      {/* SL / TP Mode toggle */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider opacity-50">SL / TP</span>
        <button
          onClick={() => setSlTpMode(slTpMode === 'price' ? 'pips' : 'price')}
          className="text-[10px] font-bold px-2 py-0.5 rounded transition-all"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            color: '#29ABE2',
          }}
        >
          {slTpMode === 'price' ? 'PRICE' : 'PIPS'}
        </button>
      </div>

      {/* SL / TP */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] uppercase tracking-wider opacity-50 mb-0.5 block">
            Stop Loss {slTpMode === 'pips' ? '(pips)' : ''}
          </label>
          <input
            type="number"
            value={slValue}
            onChange={(e) => setSlValue(e.target.value)}
            step={slTpMode === 'pips' ? 1 : Math.pow(10, -decimals)}
            placeholder={slTpMode === 'pips' ? 'Pips' : 'Price'}
            className="w-full px-2 py-1.5 rounded text-sm font-mono outline-none border"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border)',
            }}
          />
        </div>
        <div>
          <label className="text-[9px] uppercase tracking-wider opacity-50 mb-0.5 block">
            Take Profit {slTpMode === 'pips' ? '(pips)' : ''}
          </label>
          <input
            type="number"
            value={tpValue}
            onChange={(e) => setTpValue(e.target.value)}
            step={slTpMode === 'pips' ? 1 : Math.pow(10, -decimals)}
            placeholder={slTpMode === 'pips' ? 'Pips' : 'Price'}
            className="w-full px-2 py-1.5 rounded text-sm font-mono outline-none border"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border)',
            }}
          />
        </div>
      </div>

      {/* Info rows: Pip value, R:R, Risk %, Margin */}
      <div className="flex flex-col gap-1">
        {/* Pip value */}
        <div
          className="text-[11px] rounded px-2 py-1 flex justify-between"
          style={{ backgroundColor: 'var(--bg-elevated)' }}
        >
          <span className="opacity-50">Pip Value</span>
          <span className="font-mono" style={{ color: '#29ABE2' }}>
            1 pip = ${pipValue.toFixed(2)}
          </span>
        </div>

        {/* R:R Ratio */}
        {rrRatio !== null && (
          <div
            className="text-[11px] rounded px-2 py-1 flex justify-between"
            style={{ backgroundColor: 'var(--bg-elevated)' }}
          >
            <span className="opacity-50">R:R Ratio</span>
            <span className="font-mono font-bold" style={{ color: rrRatio >= 1.5 ? '#00C853' : '#FFC107' }}>
              1:{rrRatio.toFixed(1)}
            </span>
          </div>
        )}

        {/* Risk % */}
        {riskCalc && (
          <div
            className="text-[11px] rounded px-2 py-1 flex justify-between"
            style={{ backgroundColor: 'var(--bg-elevated)' }}
          >
            <span className="opacity-50">Risk</span>
            <span className="font-mono font-bold" style={{ color: riskColor }}>
              {riskCalc.riskPct.toFixed(1)}% (${riskCalc.riskAmount.toFixed(2)})
            </span>
          </div>
        )}

        {/* Margin */}
        <div
          className="text-[11px] rounded px-2 py-1 flex justify-between"
          style={{ backgroundColor: 'var(--bg-elevated)' }}
        >
          <span className="opacity-50">Margin Required</span>
          <span className="font-mono">{formatCurrency(marginEstimate)}</span>
        </div>
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
          'w-full py-2 rounded font-bold text-sm uppercase tracking-wider transition-all',
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

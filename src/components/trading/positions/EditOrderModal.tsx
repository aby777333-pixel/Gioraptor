'use client';

import { useState } from 'react';
import { X, Pencil } from 'lucide-react';
import { orderService } from '@/lib/trading/order-service';
import { useTradingStore } from '@/stores/trading';
import { formatPrice } from '@/lib/utils/format';
import type { Position } from '@/types/trading';

interface EditOrderModalProps {
  position: Position;
  onClose: () => void;
  onSuccess: () => void;
}

function getDecimals(symbol: string): number {
  if (symbol === 'USDJPY') return 3;
  if (symbol.startsWith('XAU')) return 2;
  if (symbol.startsWith('BTC') || symbol === 'US30' || symbol === 'NAS100') return 1;
  if (symbol.startsWith('ETH')) return 2;
  return 5;
}

type ModalTab = 'modify' | 'partial';

export default function EditOrderModal({ position, onClose, onSuccess }: EditOrderModalProps) {
  const { prices, triggerRefresh } = useTradingStore();
  const [activeTab, setActiveTab] = useState<ModalTab>('modify');
  const [sl, setSl] = useState(position.sl?.toString() ?? '0.00');
  const [tp, setTp] = useState(position.tp?.toString() ?? '0.00');
  const [remarks, setRemarks] = useState('');
  const [partialSize, setPartialSize] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const dec = getDecimals(position.symbol);
  const tick = prices[position.symbol];
  const marketPrice = position.direction === 'BUY'
    ? (tick?.bid ?? position.current_price)
    : (tick?.ask ?? position.current_price);

  const orderId = position.id.slice(0, 8).toUpperCase();

  async function handleModify() {
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const slVal = parseFloat(sl);
      const tpVal = parseFloat(tp);
      const result = await orderService.modifyPosition(
        position.id,
        slVal > 0 ? slVal : undefined,
        tpVal > 0 ? tpVal : undefined,
      );
      if (result?.success) {
        setSuccess('Order modified successfully');
        triggerRefresh();
        onSuccess();
        setTimeout(onClose, 1200);
      } else {
        setError(result?.error || 'Failed to modify order');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error modifying order';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePartialClose() {
    const closeSize = parseFloat(partialSize);
    if (isNaN(closeSize) || closeSize <= 0) {
      setError('Enter a valid close size');
      return;
    }
    if (closeSize > position.size) {
      setError('Close size cannot exceed position size');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const closePrice = position.direction === 'BUY' ? tick?.bid : tick?.ask;
      if (!closePrice || closePrice <= 0) {
        setError('No market price available');
        setIsSubmitting(false);
        return;
      }
      const result = await orderService.closePosition(position.id, closePrice);
      if (result?.success) {
        setSuccess('Position closed successfully');
        triggerRefresh();
        onSuccess();
        setTimeout(onClose, 1200);
      } else {
        setError(result?.error || 'Failed to close position');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error closing position';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function setPartialPercent(pct: number) {
    const val = (position.size * pct) / 100;
    setPartialSize(val.toFixed(2));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="rounded-lg shadow-2xl w-full max-w-md"
        style={{
          backgroundColor: '#111118',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center gap-2">
            <Pencil size={14} style={{ color: '#29ABE2' }} />
            <span className="text-[14px] font-semibold" style={{ color: '#F0F0F0' }}>
              Edit Ongoing Order
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded transition-opacity hover:opacity-80"
            style={{ width: 24, height: 24, color: 'rgba(255,255,255,0.4)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={() => setActiveTab('modify')}
            className="flex-1 py-2.5 text-[12px] font-semibold uppercase tracking-wider transition-colors"
            style={{
              color: activeTab === 'modify' ? '#29ABE2' : 'rgba(255,255,255,0.35)',
              borderBottom: activeTab === 'modify' ? '2px solid #29ABE2' : '2px solid transparent',
              backgroundColor: activeTab === 'modify' ? 'rgba(41,171,226,0.06)' : 'transparent',
            }}
          >
            Modify SL/TP
          </button>
          <button
            onClick={() => setActiveTab('partial')}
            className="flex-1 py-2.5 text-[12px] font-semibold uppercase tracking-wider transition-colors"
            style={{
              color: activeTab === 'partial' ? '#29ABE2' : 'rgba(255,255,255,0.35)',
              borderBottom: activeTab === 'partial' ? '2px solid #29ABE2' : '2px solid transparent',
              backgroundColor: activeTab === 'partial' ? 'rgba(41,171,226,0.06)' : 'transparent',
            }}
          >
            Partial Close
          </button>
        </div>

        {/* Order Info */}
        <div className="px-5 pt-4 pb-2">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Order ID
              </div>
              <div className="text-[12px] font-mono font-medium" style={{ color: '#F0F0F0' }}>
                #{orderId}
              </div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Market Price
              </div>
              <div className="text-[12px] font-mono font-medium" style={{ color: '#F0F0F0' }}>
                {formatPrice(marketPrice, dec)}
              </div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Direction
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: position.direction === 'BUY' ? 'rgba(0,194,122,0.15)' : 'rgba(193,18,31,0.15)',
                    color: position.direction === 'BUY' ? '#22c55e' : '#ef4444',
                  }}
                >
                  {position.direction}
                </span>
                <span className="text-[11px] font-semibold" style={{ color: '#fff' }}>
                  {position.symbol}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Volume
              </div>
              <div className="text-[12px] font-mono font-medium" style={{ color: '#F0F0F0' }}>
                {position.size.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Entry Price
              </div>
              <div className="text-[12px] font-mono font-medium" style={{ color: '#F0F0F0' }}>
                {formatPrice(position.open_price, dec)}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="px-5 pb-4">
          {activeTab === 'modify' && (
            <>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-semibold block mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Stop Loss
                  </label>
                  <input
                    type="text"
                    value={sl}
                    onChange={(e) => setSl(e.target.value)}
                    className="w-full px-3 py-2 rounded text-[13px] font-mono outline-none transition-colors"
                    style={{
                      backgroundColor: '#0A0A0F',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: '#F0F0F0',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#29ABE2'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-semibold block mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Take Profit
                  </label>
                  <input
                    type="text"
                    value={tp}
                    onChange={(e) => setTp(e.target.value)}
                    className="w-full px-3 py-2 rounded text-[13px] font-mono outline-none transition-colors"
                    style={{
                      backgroundColor: '#0A0A0F',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: '#F0F0F0',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#29ABE2'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="text-[10px] uppercase tracking-wider font-semibold block mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Remarks
                </label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="No remarks"
                  className="w-full px-3 py-2 rounded text-[12px] outline-none transition-colors placeholder:opacity-30"
                  style={{
                    backgroundColor: '#0A0A0F',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#F0F0F0',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#29ABE2'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                />
              </div>
            </>
          )}

          {activeTab === 'partial' && (
            <>
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Close Size
                  </label>
                  <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    Current: {position.size.toFixed(2)} lots
                  </span>
                </div>
                <input
                  type="text"
                  value={partialSize}
                  onChange={(e) => setPartialSize(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded text-[13px] font-mono outline-none transition-colors placeholder:opacity-30"
                  style={{
                    backgroundColor: '#0A0A0F',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#F0F0F0',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#29ABE2'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                />
              </div>

              <div className="flex items-center gap-2 mb-4">
                {[25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setPartialPercent(pct)}
                    className="flex-1 py-1.5 rounded text-[11px] font-semibold transition-colors"
                    style={{
                      backgroundColor: '#1A1A24',
                      border: '1px solid rgba(255,255,255,0.06)',
                      color: 'rgba(255,255,255,0.5)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(41,171,226,0.15)';
                      e.currentTarget.style.borderColor = 'rgba(41,171,226,0.3)';
                      e.currentTarget.style.color = '#29ABE2';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#1A1A24';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                      e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
                    }}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Error / Success */}
          {error && (
            <div
              className="mb-3 px-3 py-2 rounded text-[11px] text-center"
              style={{
                backgroundColor: 'rgba(239,68,68,0.1)',
                color: '#ef4444',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              {error}
            </div>
          )}
          {success && (
            <div
              className="mb-3 px-3 py-2 rounded text-[11px] text-center"
              style={{
                backgroundColor: 'rgba(34,197,94,0.1)',
                color: '#22c55e',
                border: '1px solid rgba(34,197,94,0.2)',
              }}
            >
              {success}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded text-[12px] font-semibold transition-colors"
              style={{
                backgroundColor: '#1A1A24',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.6)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#252530'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#1A1A24'; }}
            >
              <X size={12} />
              Cancel
            </button>
            <button
              onClick={activeTab === 'modify' ? handleModify : handlePartialClose}
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded text-[12px] font-semibold transition-colors"
              style={{
                backgroundColor: isSubmitting ? 'rgba(41,171,226,0.1)' : 'rgba(41,171,226,0.2)',
                border: '1px solid rgba(41,171,226,0.3)',
                color: '#29ABE2',
                cursor: isSubmitting ? 'wait' : 'pointer',
              }}
              onMouseEnter={(e) => { if (!isSubmitting) e.currentTarget.style.backgroundColor = 'rgba(41,171,226,0.3)'; }}
              onMouseLeave={(e) => { if (!isSubmitting) e.currentTarget.style.backgroundColor = 'rgba(41,171,226,0.2)'; }}
            >
              <Pencil size={12} />
              {activeTab === 'modify'
                ? (isSubmitting ? 'Modifying...' : 'Modify Order')
                : (isSubmitting ? 'Closing...' : 'Close Position')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

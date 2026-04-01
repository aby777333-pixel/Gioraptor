'use client';

import { useEffect, useState, useCallback } from 'react';
import TopBar from '@/components/layout/TopBar';
import Watchlist from '@/components/trading/watchlist/Watchlist';
import ChartPanel from '@/components/trading/chart/ChartPanel';
import PositionsPanel from '@/components/trading/positions/PositionsPanel';
import AccountBar from '@/components/trading/account-summary/AccountBar';
import RightPanel from '@/components/trading/RightPanel';
import KeyboardShortcuts from '@/components/trading/KeyboardShortcuts';
import { usePriceEngine } from '@/hooks/usePriceEngine';
import { useTradingStore } from '@/stores/trading';

const TF_MAP: Record<string, string> = {
  '1': '1m',
  '2': '5m',
  '3': '15m',
  '4': '1H',
  '5': '4H',
  '6': '1D',
};

export default function TerminalPage() {
  const { ohlcvBuilder, isLiveData } = usePriceEngine();
  const { setOrderDirection } = useTradingStore();
  const [showShortcuts, setShowShortcuts] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea/select
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const key = e.key;

      // B -> BUY
      if (key === 'b' || key === 'B') {
        e.preventDefault();
        setOrderDirection('BUY');
        return;
      }

      // S -> SELL
      if (key === 's' || key === 'S') {
        e.preventDefault();
        setOrderDirection('SELL');
        return;
      }

      // ESC -> close modals
      if (key === 'Escape') {
        setShowShortcuts(false);
        return;
      }

      // ? -> show shortcuts
      if (key === '?') {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
        return;
      }

      // 1-6 -> timeframe
      if (TF_MAP[key]) {
        e.preventDefault();
        window.dispatchEvent(
          new CustomEvent('raptor-timeframe-change', { detail: TF_MAP[key] })
        );
        return;
      }

      // F11 -> fullscreen
      if (key === 'F11') {
        e.preventDefault();
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          document.documentElement.requestFullscreen().catch(() => {});
        }
        return;
      }
    },
    [setOrderDirection]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className="h-screen w-screen overflow-hidden bg-[var(--bg-primary)]"
      style={{
        display: 'grid',
        gridTemplateRows: '44px 1fr 200px 30px',
        gridTemplateColumns: '240px 1fr 280px',
      }}
    >
      {/* TopBar - spans full width */}
      <div
        className="border-b border-[var(--border)]"
        style={{ gridColumn: '1 / -1' }}
      >
        <TopBar />
      </div>

      {/* Watchlist - left sidebar */}
      <div className="border-r border-[var(--border)] overflow-hidden">
        <Watchlist />
      </div>

      {/* ChartPanel - center, fills remaining space */}
      <div className="overflow-hidden">
        <ChartPanel ohlcvBuilder={ohlcvBuilder} isLiveData={isLiveData} />
      </div>

      {/* Right Panel - Order Ticket + Account + Tools */}
      <div className="border-l border-[var(--border)] overflow-hidden">
        <RightPanel />
      </div>

      {/* PositionsPanel - spans full width */}
      <div
        className="border-t border-[var(--border)] overflow-hidden"
        style={{ gridColumn: '1 / -1' }}
      >
        <PositionsPanel />
      </div>

      {/* AccountBar - spans full width */}
      <div
        className="border-t border-[var(--border)] overflow-hidden"
        style={{ gridColumn: '1 / -1' }}
      >
        <AccountBar />
      </div>

      {/* Keyboard shortcuts modal */}
      {showShortcuts && (
        <KeyboardShortcuts onClose={() => setShowShortcuts(false)} />
      )}
    </div>
  );
}

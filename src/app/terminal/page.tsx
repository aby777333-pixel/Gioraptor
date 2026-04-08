'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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

  // ── Resizable positions panel ──
  const [panelHeight, setPanelHeight] = useState(240);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(240);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    startY.current = e.clientY;
    startHeight.current = panelHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, [panelHeight]);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startY.current - e.clientY;
      const newHeight = Math.max(100, Math.min(600, startHeight.current + delta));
      setPanelHeight(newHeight);
    };
    const handleUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const key = e.key;

      if (key === 'b' || key === 'B') { e.preventDefault(); setOrderDirection('BUY'); return; }
      if (key === 's' || key === 'S') { e.preventDefault(); setOrderDirection('SELL'); return; }
      if (key === 'Escape') { setShowShortcuts(false); return; }
      if (key === '?') { e.preventDefault(); setShowShortcuts((prev) => !prev); return; }
      if (TF_MAP[key]) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('raptor-timeframe-change', { detail: TF_MAP[key] }));
        return;
      }
      if (key === 'F11') {
        e.preventDefault();
        if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); }
        else { document.documentElement.requestFullscreen().catch(() => {}); }
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
    <div className="h-screen w-screen overflow-hidden bg-[var(--bg-primary)] flex flex-col">
      {/* TopBar */}
      <div className="border-b border-[var(--border)] shrink-0">
        <TopBar />
      </div>

      {/* Main content - responsive grid */}
      <div
        className="flex-1 overflow-hidden"
        style={{
          display: 'grid',
          gridTemplateRows: `1fr auto ${panelHeight}px 30px`,
          gridTemplateColumns: '240px 1fr 280px',
        }}
      >
        {/* Watchlist - left sidebar (hidden on mobile) */}
        <div className="border-r border-[var(--border)] overflow-hidden hidden lg:block">
          <Watchlist />
        </div>

        {/* ChartPanel - center */}
        <div className="overflow-hidden" style={{ gridColumn: 'span 1' }}>
          <ChartPanel ohlcvBuilder={ohlcvBuilder} isLiveData={isLiveData} />
        </div>

        {/* Right Panel (hidden on mobile) */}
        <div className="border-l border-[var(--border)] overflow-hidden hidden xl:block">
          <RightPanel />
        </div>

        {/* ── Drag handle ── */}
        <div
          onMouseDown={handleDragStart}
          style={{ gridColumn: '1 / -1', height: 6, cursor: 'row-resize', position: 'relative', zIndex: 50 }}
        >
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(0,145,213,0.08) 50%, rgba(255,255,255,0.02) 100%)',
            borderTop: '1px solid var(--border)',
            borderBottom: '1px solid var(--border)',
            transition: 'background 0.15s',
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'linear-gradient(180deg, rgba(0,145,213,0.1) 0%, rgba(0,145,213,0.25) 50%, rgba(0,145,213,0.1) 100%)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(0,145,213,0.08) 50%, rgba(255,255,255,0.02) 100%)'; }}
          >
            {/* Grip dots */}
            <div style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              display: 'flex',
              gap: 3,
            }}>
              {[0,1,2,3,4].map((i) => (
                <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.15)' }} />
              ))}
            </div>
          </div>
        </div>

        {/* PositionsPanel - spans full width */}
        <div className="overflow-auto" style={{ gridColumn: '1 / -1' }}>
          <PositionsPanel />
        </div>

        {/* AccountBar - spans full width */}
        <div className="border-t border-[var(--border)] overflow-hidden" style={{ gridColumn: '1 / -1' }}>
          <AccountBar />
        </div>
      </div>

      {/* Mobile-only: make chart take full width */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 1023px) {
          [style*="grid-template-columns: 240px"] {
            grid-template-columns: 1fr !important;
          }
        }
        @media (min-width: 1024px) and (max-width: 1279px) {
          [style*="grid-template-columns: 240px"] {
            grid-template-columns: 200px 1fr !important;
          }
        }
      `}} />

      {/* Keyboard shortcuts modal */}
      {showShortcuts && (
        <KeyboardShortcuts onClose={() => setShowShortcuts(false)} />
      )}
    </div>
  );
}

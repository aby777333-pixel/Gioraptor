'use client';

// Standalone EMIL window (multi-monitor). Opens in its own tab behind the
// same login; shares the same account, positions, Shield state, and market
// data wiring as the terminal. Observe-only in this phase.

import TopBar from '@/components/layout/TopBar';
import BottomDock from '@/components/layout/BottomDock';
import PositionsPanel from '@/components/trading/positions/PositionsPanel';
import AccountBar from '@/components/trading/account-summary/AccountBar';
import TermsGateModal from '@/components/trading/TermsGateModal';
import EmilPanel from '@/components/trading/emil/EmilPanel';
import { usePriceEngine } from '@/hooks/usePriceEngine';

export default function EmilWindow() {
  const { ohlcvBuilder, isLiveData } = usePriceEngine();

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[var(--bg-primary)]">
      <div className="shrink-0 border-b border-[var(--border)]">
        <TopBar />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
        <EmilPanel ohlcvBuilder={ohlcvBuilder} isLiveData={isLiveData} standalone onClose={() => window.close()} />
      </div>
      {/* EMIL's own trades, live — drag the grip to resize */}
      <BottomDock initialHeight={200}>
        <PositionsPanel />
      </BottomDock>
      <div className="shrink-0 border-t border-[var(--border)]">
        <AccountBar />
      </div>
      <TermsGateModal />
    </div>
  );
}

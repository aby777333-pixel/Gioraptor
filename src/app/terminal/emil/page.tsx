'use client';

// Standalone EMIL window (multi-monitor). Opens in its own tab behind the
// same login; shares the same account, positions, Shield state, and market
// data wiring as the terminal. Observe-only in this phase.

import TopBar from '@/components/layout/TopBar';
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
      <div className="shrink-0 border-t border-[var(--border)]">
        <AccountBar />
      </div>
      <TermsGateModal />
    </div>
  );
}

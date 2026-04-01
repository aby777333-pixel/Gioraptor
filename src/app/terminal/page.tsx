'use client';

import TopBar from '@/components/layout/TopBar';
import Watchlist from '@/components/trading/watchlist/Watchlist';
import ChartPanel from '@/components/trading/chart/ChartPanel';
import OrderTicket from '@/components/trading/order-ticket/OrderTicket';
import PositionsPanel from '@/components/trading/positions/PositionsPanel';
import AccountBar from '@/components/trading/account-summary/AccountBar';
import { usePriceEngine } from '@/hooks/usePriceEngine';

export default function TerminalPage() {
  const { ohlcvBuilder } = usePriceEngine();

  return (
    <div
      className="h-screen w-screen overflow-hidden bg-[var(--bg-primary)]"
      style={{
        display: 'grid',
        gridTemplateRows: '48px 1fr 240px 32px',
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
        <ChartPanel ohlcvBuilder={ohlcvBuilder} />
      </div>

      {/* OrderTicket - right sidebar */}
      <div className="border-l border-[var(--border)] overflow-hidden">
        <OrderTicket />
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
    </div>
  );
}

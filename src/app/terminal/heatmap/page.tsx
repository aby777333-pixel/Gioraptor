'use client';

import { ArrowLeft, Grid3X3 } from 'lucide-react';
import Link from 'next/link';
import MarketHeatmap from '@/components/trading/MarketHeatmap';
import CurrencyStrength from '@/components/trading/CurrencyStrength';
import { usePriceEngine } from '@/hooks/usePriceEngine';

export default function HeatmapPage() {
  // Start the price engine so prices update
  usePriceEngine();

  return (
    <div className="h-screen w-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 shrink-0"
        style={{ height: 48, backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}
      >
        <Link
          href="/terminal"
          className="flex items-center gap-1 text-[11px] px-2 py-1 rounded transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft size={14} /> Terminal
        </Link>
        <div style={{ width: 1, height: 20, backgroundColor: 'var(--border)' }} />
        <Grid3X3 size={16} style={{ color: '#29ABE2' }} />
        <h1 className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          Market Heatmap & Currency Strength
        </h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[1fr_320px]">
        {/* Heatmap */}
        <div className="overflow-y-auto" style={{ borderRight: '1px solid var(--border)' }}>
          <MarketHeatmap />
        </div>

        {/* Currency Strength Sidebar */}
        <div className="overflow-hidden hidden lg:block">
          <CurrencyStrength />
        </div>
      </div>
    </div>
  );
}

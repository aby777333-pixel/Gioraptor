'use client';

import { useState } from 'react';
import { IndicatorLibrary } from '@/components/charts/IndicatorLibrary';

export default function RaptorChartsPage() {
  const [activeIndicators, setActiveIndicators] = useState<string[]>(['EMA', 'RSI', 'VWAP']);

  const handleAddIndicator = (shortName: string) => {
    setActiveIndicators(prev =>
      prev.includes(shortName) ? prev.filter(i => i !== shortName) : [...prev, shortName]
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">RAPTOR CHARTS</h1>
        <p className="text-xs text-white/30">Indigenous charting platform — 155+ indicators, 50+ drawing tools, 15 chart types</p>
      </div>
      <IndicatorLibrary onAddIndicator={handleAddIndicator} activeIndicators={activeIndicators} />
    </div>
  );
}

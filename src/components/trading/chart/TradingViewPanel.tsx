'use client';

// TradingView Advanced Chart embed — streams REAL TradingView market data
// for the active symbol. Used as the terminal's default chart view; the
// native RAPTOR chart (ChartPanel) remains available via the source toggle.

import { useEffect, useMemo, useRef } from 'react';
import { useTradingStore } from '@/stores/trading';

// Internal symbol → TradingView symbol mapping.
const TV_SYMBOLS: Record<string, string> = {
  EURUSD: 'FX:EURUSD', GBPUSD: 'FX:GBPUSD', USDJPY: 'FX:USDJPY',
  USDCHF: 'FX:USDCHF', AUDUSD: 'FX:AUDUSD', USDCAD: 'FX:USDCAD',
  NZDUSD: 'FX:NZDUSD', EURGBP: 'FX:EURGBP', EURJPY: 'FX:EURJPY',
  GBPJPY: 'FX:GBPJPY',
  XAUUSD: 'OANDA:XAUUSD', XAGUSD: 'OANDA:XAGUSD',
  BTCUSD: 'BITSTAMP:BTCUSD', ETHUSD: 'BITSTAMP:ETHUSD',
  US30: 'FOREXCOM:DJI', NAS100: 'FOREXCOM:NSXUSD', SPX500: 'FOREXCOM:SPXUSD',
  USOIL: 'TVC:USOIL', UKOIL: 'TVC:UKOIL', NATGAS: 'NYMEX:NG1!',
};

export default function TradingViewPanel() {
  const { activeSymbol } = useTradingStore();
  const hostRef = useRef<HTMLDivElement>(null);

  const tvSymbol = useMemo(
    () => TV_SYMBOLS[activeSymbol] ?? `FX:${activeSymbol}`,
    [activeSymbol]
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'tradingview-widget-container';
    container.style.height = '100%';
    container.style.width = '100%';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.height = '100%';
    widgetDiv.style.width = '100%';
    container.appendChild(widgetDiv);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: '60',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      backgroundColor: '#060D16',
      gridColor: 'rgba(255,255,255,0.04)',
      allow_symbol_change: false,
      calendar: false,
      hide_side_toolbar: false,
      support_host: 'https://www.tradingview.com',
    });
    container.appendChild(script);

    host.appendChild(container);
    return () => {
      host.innerHTML = '';
    };
  }, [tvSymbol]);

  return (
    <div className="relative h-full w-full" style={{ backgroundColor: '#060D16' }}>
      <div ref={hostRef} className="absolute inset-0" />
      <div
        className="absolute top-1 left-2 z-10 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
        style={{ backgroundColor: 'rgba(0,194,122,0.15)', color: '#00C27A', border: '1px solid rgba(0,194,122,0.3)' }}
      >
        TradingView Live
      </div>
    </div>
  );
}

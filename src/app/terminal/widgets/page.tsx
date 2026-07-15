'use client';

// Market Widgets — the TradingView widget set from "Trading view widgets.docx",
// hosted inside the terminal (dark theme). Reachable from the Tools menu.

import { TVWidget, TVElement } from '@/components/widgets/TVEmbeds';

const MARKET_DATA_SECTIONS = JSON.stringify([
  { sectionName: 'Indices', symbols: ['FOREXCOM:SPXUSD', 'FOREXCOM:NSXUSD', 'FOREXCOM:DJI', 'INDEX:NKY', 'INDEX:DEU40', 'FOREXCOM:UKXGBP'] },
  { sectionName: 'Futures', symbols: ['BMFBOVESPA:ISP1!', 'BMFBOVESPA:EUR1!', 'CMCMARKETS:GOLD', 'TVC:USOIL', 'BMFBOVESPA:CCM1!'] },
  { sectionName: 'Bonds', symbols: ['EUREX:FGBL1!', 'EUREX:FBTP1!', 'EUREX:FGBM1!'] },
  { sectionName: 'Forex', symbols: ['FX:EURUSD', 'FX:GBPUSD', 'FX:USDJPY', 'FX:USDCHF', 'FX:AUDUSD', 'FX:USDCAD'] },
]);

function Panel({ title, children, wide = false }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-white/5 ${wide ? 'lg:col-span-2' : ''}`}
      style={{ backgroundColor: '#0A0F1A' }}
    >
      <div className="border-b border-white/5 px-4 py-2.5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-white/70">{title}</h2>
      </div>
      <div className="p-2">{children}</div>
    </div>
  );
}

export default function TerminalWidgetsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">MARKET WIDGETS</h1>
        <p className="text-xs text-white/30">
          Live TradingView widgets — market data, screeners, fundamentals, calendar & news
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Market Data — Indices · Futures · Bonds · Forex" wide>
          <TVElement tag="tv-market-data" attrs={{ 'symbol-sectors': MARKET_DATA_SECTIONS }} minHeight={560} />
        </Panel>

        <Panel title="Forex Cross Rates">
          <TVElement tag="tv-forex-table" minHeight={460} />
        </Panel>
        <Panel title="Forex Heat Map">
          <TVElement tag="tv-forex-table" attrs={{ 'displayed-value': 'dailyChange', heatmap: true }} minHeight={460} />
        </Panel>

        <Panel title="Forex Screener">
          <TVWidget
            widget="screener"
            height={550}
            config={{ market: 'forex', showToolbar: true, defaultColumn: 'overview', defaultScreen: 'general', isTransparent: false, locale: 'en', colorTheme: 'dark', width: '100%', height: 550 }}
          />
        </Panel>
        <Panel title="Crypto Markets">
          <TVWidget
            widget="screener"
            height={550}
            config={{ defaultColumn: 'overview', screener_type: 'crypto_mkt', displayCurrency: 'USD', colorTheme: 'dark', isTransparent: false, locale: 'en', width: '100%', height: 550 }}
          />
        </Panel>

        <Panel title="AAPL Fundamentals">
          <TVWidget
            widget="financials"
            height={550}
            config={{ symbol: 'NASDAQ:AAPL', colorTheme: 'dark', displayMode: 'regular', isTransparent: false, locale: 'en', width: '100%', height: 550 }}
          />
        </Panel>
        <Panel title="Technical Analysis — AAPL">
          <TVElement tag="tv-technical-analysis" attrs={{ symbol: 'NASDAQ:AAPL' }} minHeight={550} />
        </Panel>

        <Panel title="Top Stories">
          <TVWidget
            widget="timeline"
            height={550}
            config={{ displayMode: 'regular', feedMode: 'all_symbols', colorTheme: 'dark', isTransparent: false, locale: 'en', width: '100%', height: 550 }}
          />
        </Panel>
        <Panel title="Economic Calendar">
          <TVWidget
            widget="events"
            height={550}
            config={{ colorTheme: 'dark', isTransparent: false, locale: 'en', countryFilter: 'ar,au,br,ca,cn,fr,de,in,id,it,jp,kr,mx,ru,sa,za,tr,gb,us,eu', importanceFilter: '-1,0,1', width: '100%', height: 550 }}
          />
        </Panel>
      </div>

      <p className="mt-5 text-center text-[11px] text-white/25">
        Widgets and market data provided by{' '}
        <a href="https://www.tradingview.com/" target="_blank" rel="noopener nofollow noreferrer" className="underline hover:no-underline">
          TradingView
        </a>
        .
      </p>
    </div>
  );
}

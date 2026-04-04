'use client';

import { useState } from 'react';
import { SymbolManager } from '@/components/broker/SymbolManager';
import type { SymbolConfig } from '@/types/broker';

const MOCK_SYMBOLS: SymbolConfig[] = [
  { id: '1', symbol: 'EURUSD', displayName: 'Euro / US Dollar', assetClass: 'forex', isEnabled: true, spreadType: 'variable', spreadMarkup: 0.3, minSpread: 0.1, maxSpread: 3.0, swapLong: -6.5, swapShort: 1.2, maxLeverage: 500, minLot: 0.01, maxLot: 100, lotStep: 0.01, contractSize: 100000, sessionOpen: '22:00', sessionClose: '22:00', restrictedCountries: [] },
  { id: '2', symbol: 'GBPUSD', displayName: 'British Pound / US Dollar', assetClass: 'forex', isEnabled: true, spreadType: 'variable', spreadMarkup: 0.5, minSpread: 0.3, maxSpread: 5.0, swapLong: -5.8, swapShort: 0.9, maxLeverage: 500, minLot: 0.01, maxLot: 100, lotStep: 0.01, contractSize: 100000, sessionOpen: '22:00', sessionClose: '22:00', restrictedCountries: [] },
  { id: '3', symbol: 'USDJPY', displayName: 'US Dollar / Japanese Yen', assetClass: 'forex', isEnabled: true, spreadType: 'variable', spreadMarkup: 0.2, minSpread: 0.1, maxSpread: 3.0, swapLong: 8.5, swapShort: -12.3, maxLeverage: 500, minLot: 0.01, maxLot: 100, lotStep: 0.01, contractSize: 100000, sessionOpen: '22:00', sessionClose: '22:00', restrictedCountries: [] },
  { id: '4', symbol: 'XAUUSD', displayName: 'Gold / US Dollar', assetClass: 'commodities', isEnabled: true, spreadType: 'variable', spreadMarkup: 2.0, minSpread: 1.0, maxSpread: 15.0, swapLong: -15.2, swapShort: 3.1, maxLeverage: 200, minLot: 0.01, maxLot: 50, lotStep: 0.01, contractSize: 100, sessionOpen: '23:00', sessionClose: '22:00', restrictedCountries: [] },
  { id: '5', symbol: 'BTCUSD', displayName: 'Bitcoin / US Dollar', assetClass: 'crypto', isEnabled: true, spreadType: 'fixed', spreadMarkup: 50, minSpread: 30, maxSpread: 200, swapLong: -0.05, swapShort: -0.05, maxLeverage: 20, minLot: 0.01, maxLot: 10, lotStep: 0.01, contractSize: 1, sessionOpen: null, sessionClose: null, restrictedCountries: ['US', 'UK'] },
  { id: '6', symbol: 'US30', displayName: 'Dow Jones 30', assetClass: 'indices', isEnabled: true, spreadType: 'variable', spreadMarkup: 1.0, minSpread: 0.5, maxSpread: 10.0, swapLong: -8.5, swapShort: -2.1, maxLeverage: 100, minLot: 0.1, maxLot: 50, lotStep: 0.1, contractSize: 1, sessionOpen: '23:00', sessionClose: '22:00', restrictedCountries: [] },
  { id: '7', symbol: 'ETHUSD', displayName: 'Ethereum / US Dollar', assetClass: 'crypto', isEnabled: true, spreadType: 'fixed', spreadMarkup: 5, minSpread: 3, maxSpread: 30, swapLong: -0.05, swapShort: -0.05, maxLeverage: 10, minLot: 0.01, maxLot: 50, lotStep: 0.01, contractSize: 1, sessionOpen: null, sessionClose: null, restrictedCountries: ['US'] },
  { id: '8', symbol: 'AAPL', displayName: 'Apple Inc.', assetClass: 'stocks', isEnabled: false, spreadType: 'variable', spreadMarkup: 0.1, minSpread: 0.05, maxSpread: 1.0, swapLong: -3.2, swapShort: -1.5, maxLeverage: 20, minLot: 1, maxLot: 1000, lotStep: 1, contractSize: 1, sessionOpen: '14:30', sessionClose: '21:00', restrictedCountries: [] },
];

export default function SymbolsPage() {
  const [symbols, setSymbols] = useState(MOCK_SYMBOLS);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Symbol & Market Configuration</h1>
        <p className="text-xs text-white/30">Manage instrument availability, spreads, leverage, and trading sessions</p>
      </div>
      <SymbolManager
        symbols={symbols}
        onToggle={(id, enabled) => setSymbols(prev => prev.map(s => s.id === id ? { ...s, isEnabled: enabled } : s))}
        onEdit={(sym) => console.log('Edit symbol:', sym.symbol)}
      />
    </div>
  );
}

'use client';

import { DealerWorkstation } from '@/components/dealing-desk/DealerWorkstation';
import type { DealerPosition, LiveOrder, DealerAction } from '@/types/dealing-desk';

const MOCK_POSITIONS: DealerPosition[] = [
  { id: 'p1', clientName: 'James Wilson', accountNumber: 'ACC-1001', symbol: 'EURUSD', direction: 'buy', volume: 2.50, openPrice: 1.08420, currentPrice: 1.08560, stopLoss: 1.08200, takeProfit: 1.08800, unrealizedPnl: 350.00, swap: -12.50, commission: -5.00, marginUsed: 5000, openTime: new Date(Date.now() - 7200000).toISOString(), riskBand: 'medium', ibName: 'Alpha Partners', country: 'US', accountGroup: 'Standard', isHedged: true, hedgeLpName: 'LMAX', dealerNotes: null },
  { id: 'p2', clientName: 'Sarah Chen', accountNumber: 'ACC-1002', symbol: 'XAUUSD', direction: 'buy', volume: 1.00, openPrice: 2348.50, currentPrice: 2356.20, stopLoss: 2330.00, takeProfit: 2380.00, unrealizedPnl: 770.00, swap: -25.00, commission: -7.00, marginUsed: 12000, openTime: new Date(Date.now() - 14400000).toISOString(), riskBand: 'low', ibName: null, country: 'UK', accountGroup: 'ECN', isHedged: false, hedgeLpName: null, dealerNotes: null },
  { id: 'p3', clientName: 'Ahmed Al-Rashid', accountNumber: 'ACC-1003', symbol: 'GBPUSD', direction: 'sell', volume: 5.00, openPrice: 1.26780, currentPrice: 1.26920, stopLoss: null, takeProfit: null, unrealizedPnl: -700.00, swap: 8.50, commission: -10.00, marginUsed: 15000, openTime: new Date(Date.now() - 3600000).toISOString(), riskBand: 'high', ibName: 'Desert Capital', country: 'UAE', accountGroup: 'VIP', isHedged: false, hedgeLpName: null, dealerNotes: 'Large position — no SL set. Monitor closely.' },
  { id: 'p4', clientName: 'Dmitry Petrov', accountNumber: 'ACC-1004', symbol: 'BTCUSD', direction: 'buy', volume: 0.50, openPrice: 68500, currentPrice: 69200, stopLoss: 67000, takeProfit: 72000, unrealizedPnl: 350.00, swap: -5.00, commission: -15.00, marginUsed: 8000, openTime: new Date(Date.now() - 28800000).toISOString(), riskBand: 'aggressive', ibName: 'FX Educators', country: 'RU', accountGroup: 'Standard', isHedged: true, hedgeLpName: 'PrimeXM', dealerNotes: null },
  { id: 'p5', clientName: 'Maria Santos', accountNumber: 'ACC-1005', symbol: 'EURUSD', direction: 'sell', volume: 1.00, openPrice: 1.08650, currentPrice: 1.08560, stopLoss: 1.08900, takeProfit: 1.08200, unrealizedPnl: 90.00, swap: 3.20, commission: -2.00, marginUsed: 2000, openTime: new Date(Date.now() - 1800000).toISOString(), riskBand: 'low', ibName: null, country: 'BR', accountGroup: 'Standard', isHedged: false, hedgeLpName: null, dealerNotes: null },
  { id: 'p6', clientName: 'Yuki Tanaka', accountNumber: 'ACC-1006', symbol: 'USDJPY', direction: 'buy', volume: 10.00, openPrice: 153.420, currentPrice: 153.680, stopLoss: 152.800, takeProfit: 154.500, unrealizedPnl: 1690.00, swap: -45.00, commission: -20.00, marginUsed: 25000, openTime: new Date(Date.now() - 43200000).toISOString(), riskBand: 'medium', ibName: 'Alpha Partners', country: 'JP', accountGroup: 'VIP', isHedged: true, hedgeLpName: 'LMAX', dealerNotes: 'VIP client — priority execution' },
];

const MOCK_ORDERS: LiveOrder[] = [
  { id: 'o1', clientName: 'Ahmed Al-Rashid', accountNumber: 'ACC-1003', symbol: 'XAUUSD', type: 'limit', direction: 'buy', volume: 2.00, requestedPrice: 2340.00, currentPrice: 2356.20, slippage: 0, status: 'pending', timeInForce: 'GTC', routingDecision: 'pending', receivedAt: new Date(Date.now() - 120000).toISOString(), filledAt: null, dealerAction: null },
  { id: 'o2', clientName: 'James Wilson', accountNumber: 'ACC-1001', symbol: 'EURUSD', type: 'market', direction: 'sell', volume: 1.00, requestedPrice: 1.08555, currentPrice: 1.08560, slippage: 0.5, status: 'filled', timeInForce: 'IOC', routingDecision: 'a_book', receivedAt: new Date(Date.now() - 30000).toISOString(), filledAt: new Date(Date.now() - 29800).toISOString(), dealerAction: null },
  { id: 'o3', clientName: 'Dmitry Petrov', accountNumber: 'ACC-1004', symbol: 'BTCUSD', type: 'stop', direction: 'sell', volume: 0.25, requestedPrice: 67000, currentPrice: 69200, slippage: 0, status: 'pending', timeInForce: 'GTC', routingDecision: 'b_book', receivedAt: new Date(Date.now() - 600000).toISOString(), filledAt: null, dealerAction: null },
  { id: 'o4', clientName: 'New Trader X', accountNumber: 'ACC-2001', symbol: 'EURUSD', type: 'market', direction: 'buy', volume: 50.00, requestedPrice: 1.08560, currentPrice: 1.08560, slippage: 0, status: 'pending', timeInForce: 'FOK', routingDecision: 'pending', receivedAt: new Date(Date.now() - 5000).toISOString(), filledAt: null, dealerAction: 'Large order — dealer review required' },
];

const MOCK_ACTIONS: DealerAction[] = [
  { id: 'da1', dealerName: 'Tom Risk', action: 'force_close', targetType: 'position', targetId: 'pos-old-123', details: { symbol: 'GBPJPY', volume: 3.0 }, reason: 'Margin call — client unresponsive', timestamp: new Date(Date.now() - 3600000).toISOString() },
  { id: 'da2', dealerName: 'Admin', action: 'spread_override', targetType: 'symbol', targetId: 'XAUUSD', details: { oldMarkup: 2.0, newMarkup: 5.0 }, reason: 'NFP release in 5 minutes', timestamp: new Date(Date.now() - 7200000).toISOString() },
  { id: 'da3', dealerName: 'Tom Risk', action: 'override_routing', targetType: 'account', targetId: 'ACC-1003', details: { from: 'b_book', to: 'a_book' }, reason: 'Client showing toxic flow patterns', timestamp: new Date(Date.now() - 14400000).toISOString() },
  { id: 'da4', dealerName: 'Admin', action: 'requote', targetType: 'order', targetId: 'ord-456', details: { originalPrice: 2355.00, newPrice: 2355.80 }, reason: 'Price moved during review', timestamp: new Date(Date.now() - 18000000).toISOString() },
  { id: 'da5', dealerName: 'Tom Risk', action: 'margin_extension', targetType: 'account', targetId: 'ACC-1006', details: { extension: '24h' }, reason: 'VIP client requested extension — approved by admin', timestamp: new Date(Date.now() - 28800000).toISOString() },
];

export default function DealingDeskPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">RAPTOR DESK — Dealing Desk</h1>
        <p className="text-xs text-white/30">Real-time position monitor, order flow, and dealer intervention tools</p>
      </div>
      <DealerWorkstation
        positions={MOCK_POSITIONS}
        orders={MOCK_ORDERS}
        recentActions={MOCK_ACTIONS}
        onForceClose={(id, reason) => console.log('Force close', id, reason)}
        onRejectOrder={(id, reason) => console.log('Reject', id, reason)}
        onRequote={(id, price) => console.log('Requote', id, price)}
      />
    </div>
  );
}

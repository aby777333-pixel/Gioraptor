'use client';

import { MigrationCenter } from '@/components/connect/MigrationCenter';
import type { PlatformMigration, ClientMigrationStatus, TerminalConnection } from '@/types/connect';

const MOCK_MIGRATIONS: PlatformMigration[] = [
  { id: 'mg1', platform: 'mt5', serverName: 'MT5 Live — Primary', phase: 'traffic_shift', totalClients: 4827, migratedClients: 3890, totalAccounts: 7200, migratedAccounts: 5800, totalHistory: 2_450_000, migratedHistory: 2_100_000, openPositions: 12400, syncedPositions: 11200, eaScripts: 340, convertedScripts: 298, trafficSplitPct: 75, dualRunActive: true, emailsSent: 3890, emailsPending: 937, errors: [{ type: 'position', message: 'Position sync failed for hedged order pair', clientRef: 'ACC-3421', timestamp: new Date().toISOString(), resolved: false }], startedAt: '2026-02-01', estimatedCompletion: '2026-05-01' },
  { id: 'mg2', platform: 'mt5', serverName: 'MT5 Demo', phase: 'complete', totalClients: 8900, migratedClients: 8900, totalAccounts: 8900, migratedAccounts: 8900, totalHistory: 890_000, migratedHistory: 890_000, openPositions: 0, syncedPositions: 0, eaScripts: 0, convertedScripts: 0, trafficSplitPct: 100, dualRunActive: false, emailsSent: 8900, emailsPending: 0, errors: [], startedAt: '2026-01-15', estimatedCompletion: null },
  { id: 'mg3', platform: 'ctrader', serverName: 'cTrader Production', phase: 'data_import', totalClients: 1200, migratedClients: 340, totalAccounts: 1800, migratedAccounts: 510, totalHistory: 450_000, migratedHistory: 120_000, openPositions: 2800, syncedPositions: 890, eaScripts: 45, convertedScripts: 12, trafficSplitPct: 15, dualRunActive: true, emailsSent: 340, emailsPending: 860, errors: [], startedAt: '2026-03-15', estimatedCompletion: '2026-06-30' },
];

const MOCK_CLIENTS: ClientMigrationStatus[] = Array.from({ length: 15 }, (_, i) => ({
  clientId: `mc${i}`, clientName: `Client ${String.fromCharCode(65 + i)}`, email: `client${String.fromCharCode(97 + i)}@example.com`,
  platform: (i < 10 ? 'mt5' : 'ctrader') as 'mt5' | 'ctrader',
  status: (['migrated', 'migrated', 'migrated', 'dual_run', 'in_progress', 'migrated', 'pending', 'migrated', 'failed', 'migrated', 'in_progress', 'pending', 'pending', 'migrated', 'opted_out'] as const)[i],
  accountsMigrated: i < 8 ? 2 : i === 8 ? 0 : 1, totalAccounts: 2,
  historyImported: i < 9, positionsSynced: i < 8,
  emailSent: i < 12, emailOpenedAt: i < 10 ? new Date(Date.now() - i * 86400000).toISOString() : null,
  migratedAt: i < 6 ? new Date(Date.now() - i * 172800000).toISOString() : null,
  errorMessage: i === 8 ? 'Balance mismatch — manual reconciliation required' : null,
}));

const MOCK_TERMINALS: TerminalConnection[] = [
  { id: 'tc1', name: 'Bloomberg EMSX', type: 'fix', clientName: 'Institutional Fund A', status: 'active', fixVersion: 'FIX 4.4', ordersToday: 234, volumeToday: 1200, latencyMs: 4, lastActivity: new Date().toISOString(), connectedSince: '2026-01-10' },
  { id: 'tc2', name: 'Custom Algo Platform', type: 'rest_api', clientName: 'Quant Hedge Fund B', status: 'active', fixVersion: null, ordersToday: 1890, volumeToday: 450, latencyMs: 12, lastActivity: new Date().toISOString(), connectedSince: '2026-02-15' },
  { id: 'tc3', name: 'Prop Desk Terminal', type: 'websocket', clientName: 'Internal Prop Desk', status: 'active', fixVersion: null, ordersToday: 567, volumeToday: 890, latencyMs: 2, lastActivity: new Date().toISOString(), connectedSince: '2025-11-01' },
];

export default function ConnectPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">RAPTOR CONNECT</h1>
        <p className="text-xs text-white/30">Legacy platform migration, client status tracking, and third-party terminal connections</p>
      </div>
      <MigrationCenter migrations={MOCK_MIGRATIONS} clientStatuses={MOCK_CLIENTS} terminals={MOCK_TERMINALS}
        onCutover={id => console.log('Advance', id)} onSendEmails={id => console.log('Send emails', id)} />
    </div>
  );
}

'use client';

import { useState } from 'react';
import { CrmPipeline } from '@/components/broker/CrmPipeline';
import type { CrmPipelineStage, CrmLead } from '@/types/broker';

const MOCK_LEADS: CrmLead[] = [
  { id: '1', userId: 'u1', name: 'James Wilson', email: 'james@example.com', phone: '+1-555-0101', country: 'US', stage: 'lead', assignedAgent: null, assignedAgentName: null, source: 'Google Ads', campaign: 'FX Spring 2026', landingPage: '/lp/forex', tags: ['forex', 'US'], score: 45, lastActivity: new Date().toISOString(), stageEnteredAt: new Date().toISOString(), slaHoursRemaining: 12, aiSuggestedAction: 'Schedule intro call — high intent signal', totalDeposits: 0, totalWithdrawals: 0, netPnl: 0, totalVolume: 0, accountCount: 0, kycStatus: 'none', riskCategory: 'low', createdAt: new Date().toISOString() },
  { id: '2', userId: 'u2', name: 'Sarah Chen', email: 'sarah@company.com', phone: '+44-20-7946', country: 'UK', stage: 'contacted', assignedAgent: 'a1', assignedAgentName: 'Mike R.', source: 'Referral', campaign: '', landingPage: '', tags: ['institutional', 'UK'], score: 72, lastActivity: new Date(Date.now() - 86400000).toISOString(), stageEnteredAt: new Date(Date.now() - 172800000).toISOString(), slaHoursRemaining: 4, aiSuggestedAction: 'Send demo credentials', totalDeposits: 0, totalWithdrawals: 0, netPnl: 0, totalVolume: 0, accountCount: 0, kycStatus: 'none', riskCategory: 'low', createdAt: new Date(Date.now() - 259200000).toISOString() },
  { id: '3', userId: 'u3', name: 'Ahmed Al-Rashid', email: 'ahmed@trading.ae', phone: '+971-50-123', country: 'UAE', stage: 'demo', assignedAgent: 'a2', assignedAgentName: 'Lisa T.', source: 'Instagram', campaign: 'ME Q2', landingPage: '/lp/gold', tags: ['gold', 'UAE', 'VIP prospect'], score: 85, lastActivity: new Date(Date.now() - 3600000).toISOString(), stageEnteredAt: new Date(Date.now() - 604800000).toISOString(), slaHoursRemaining: null, aiSuggestedAction: 'Offer VIP account upgrade', totalDeposits: 0, totalWithdrawals: 0, netPnl: 0, totalVolume: 15.4, accountCount: 1, kycStatus: 'pending', riskCategory: 'low', createdAt: new Date(Date.now() - 1209600000).toISOString() },
  { id: '4', userId: 'u4', name: 'Maria Santos', email: 'maria@invest.br', phone: '+55-11-9876', country: 'BR', stage: 'documents', assignedAgent: 'a1', assignedAgentName: 'Mike R.', source: 'Facebook', campaign: 'LATAM 2026', landingPage: '/lp/copy-trading', tags: ['copy-trading', 'LATAM'], score: 60, lastActivity: new Date(Date.now() - 172800000).toISOString(), stageEnteredAt: new Date(Date.now() - 432000000).toISOString(), slaHoursRemaining: 8, aiSuggestedAction: 'Follow up on missing ID back photo', totalDeposits: 0, totalWithdrawals: 0, netPnl: 0, totalVolume: 0, accountCount: 0, kycStatus: 'pending', riskCategory: 'medium', createdAt: new Date(Date.now() - 1814400000).toISOString() },
  { id: '5', userId: 'u5', name: 'Dmitry Petrov', email: 'dmitry@fx.ru', phone: '+7-495-123', country: 'RU', stage: 'live', assignedAgent: 'a2', assignedAgentName: 'Lisa T.', source: 'Affiliate', campaign: '', landingPage: '', tags: ['scalper', 'high-volume'], score: 90, lastActivity: new Date(Date.now() - 1800000).toISOString(), stageEnteredAt: new Date(Date.now() - 2592000000).toISOString(), slaHoursRemaining: null, aiSuggestedAction: null, totalDeposits: 25000, totalWithdrawals: 3200, netPnl: 4800, totalVolume: 890, accountCount: 2, kycStatus: 'verified', riskCategory: 'medium', createdAt: new Date(Date.now() - 7776000000).toISOString() },
  { id: '6', userId: 'u6', name: 'Yuki Tanaka', email: 'yuki@trade.jp', phone: '+81-3-5555', country: 'JP', stage: 'active', assignedAgent: null, assignedAgentName: null, source: 'Organic', campaign: '', landingPage: '', tags: ['algo', 'EA user', 'VIP'], score: 95, lastActivity: new Date(Date.now() - 900000).toISOString(), stageEnteredAt: new Date(Date.now() - 15552000000).toISOString(), slaHoursRemaining: null, aiSuggestedAction: null, totalDeposits: 150000, totalWithdrawals: 42000, netPnl: 67000, totalVolume: 12450, accountCount: 3, kycStatus: 'verified', riskCategory: 'low', createdAt: new Date(Date.now() - 31536000000).toISOString() },
  { id: '7', userId: 'u7', name: 'Robert Klein', email: 'robert@wealth.de', phone: '+49-89-123', country: 'DE', stage: 'vip', assignedAgent: 'a3', assignedAgentName: 'Anna K.', source: 'Event', campaign: 'iFX Expo 2025', landingPage: '', tags: ['whale', 'VIP', 'PAMM manager'], score: 99, lastActivity: new Date(Date.now() - 600000).toISOString(), stageEnteredAt: new Date(Date.now() - 7776000000).toISOString(), slaHoursRemaining: null, aiSuggestedAction: null, totalDeposits: 500000, totalWithdrawals: 120000, netPnl: 234000, totalVolume: 45000, accountCount: 5, kycStatus: 'verified', riskCategory: 'low', createdAt: new Date(Date.now() - 63072000000).toISOString() },
];

function buildStages(leads: CrmLead[]): CrmPipelineStage[] {
  const stageOrder: { name: string; key: string; color: string }[] = [
    { name: 'Lead', key: 'lead', color: '#6b7280' },
    { name: 'Contacted', key: 'contacted', color: '#00b4ff' },
    { name: 'Demo', key: 'demo', color: '#8b5cf6' },
    { name: 'Documents', key: 'documents', color: '#f59e0b' },
    { name: 'Live', key: 'live', color: '#00dc82' },
    { name: 'Active', key: 'active', color: '#10b981' },
    { name: 'VIP', key: 'vip', color: '#f59e0b' },
  ];
  return stageOrder.map((s, i) => {
    const stageLeads = leads.filter(l => l.stage === s.key);
    return { id: `stage-${i}`, name: s.name, sortOrder: i, color: s.color, slaHours: null, leads: stageLeads, count: stageLeads.length };
  });
}

export default function CrmPage() {
  const [stages] = useState(buildStages(MOCK_LEADS));

  const handleSelectLead = (id: string) => {
    console.log('Selected lead:', id);
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Client CRM</h1>
        <p className="text-xs text-white/30">Manage your client pipeline from lead to VIP</p>
      </div>
      <CrmPipeline stages={stages} onSelectLead={handleSelectLead} />
    </div>
  );
}

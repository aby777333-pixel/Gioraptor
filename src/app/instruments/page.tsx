'use client';

import { useState } from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';

interface Instrument {
  symbol: string;
  group: string;
  groupIcon: string;
  groupColor: string;
  digits: number;
  contract_size: number;
  pip_size: number;
  pip_value: number;
  margin_pct: number;
  tradable: boolean;
  swap_long: number;
  swap_short: number;
  min_volume: number;
  max_volume: number;
}

const MOCK_INSTRUMENTS: Instrument[] = [
  { symbol: 'EURUSD', group: 'Forex', groupIcon: '$', groupColor: '#22d3ee', digits: 5, contract_size: 100000, pip_size: 0.0001, pip_value: 10, margin_pct: 0.5, tradable: true, swap_long: -6.5, swap_short: 1.2, min_volume: 0.01, max_volume: 100 },
  { symbol: 'GBPUSD', group: 'Forex', groupIcon: '$', groupColor: '#22d3ee', digits: 5, contract_size: 100000, pip_size: 0.0001, pip_value: 10, margin_pct: 0.5, tradable: true, swap_long: -5.8, swap_short: 0.9, min_volume: 0.01, max_volume: 100 },
  { symbol: 'USDJPY', group: 'Forex', groupIcon: '$', groupColor: '#22d3ee', digits: 3, contract_size: 100000, pip_size: 0.01, pip_value: 6.52, margin_pct: 0.5, tradable: true, swap_long: 8.5, swap_short: -12.3, min_volume: 0.01, max_volume: 100 },
  { symbol: 'GBPJPY', group: 'Forex', groupIcon: '$', groupColor: '#22d3ee', digits: 3, contract_size: 100000, pip_size: 0.01, pip_value: 6.52, margin_pct: 0.5, tradable: true, swap_long: -3.2, swap_short: -1.8, min_volume: 0.01, max_volume: 100 },
  { symbol: 'XAUUSD', group: 'Metals', groupIcon: 'Au', groupColor: '#f59e0b', digits: 2, contract_size: 100, pip_size: 0.01, pip_value: 1, margin_pct: 0.5, tradable: true, swap_long: -15.2, swap_short: 3.1, min_volume: 0.01, max_volume: 50 },
  { symbol: 'BTCUSD', group: 'Crypto', groupIcon: 'B', groupColor: '#8b5cf6', digits: 2, contract_size: 1, pip_size: 0.01, pip_value: 0.01, margin_pct: 5.0, tradable: true, swap_long: -0.05, swap_short: -0.05, min_volume: 0.01, max_volume: 10 },
];

const GROUP_TABS = ['ALL', 'Forex', 'Metals', 'Crypto'];

export default function InstrumentsPage() {
  const [activeGroup, setActiveGroup] = useState('ALL');
  const [search, setSearch] = useState('');

  const filtered = MOCK_INSTRUMENTS.filter((inst) => {
    const matchGroup = activeGroup === 'ALL' || inst.group === activeGroup;
    const matchSearch = !search || inst.symbol.toLowerCase().includes(search.toLowerCase());
    return matchGroup && matchSearch;
  });

  return (
    <div className="min-h-screen bg-[#0B0B0D] text-white">
      {/* Header */}
      <header className="border-b border-[#252530] bg-[#0B0B0D]/95 backdrop-blur sticky top-0 z-30">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <Link href="/broker/overview">
              <Logo height={26} theme="dark" />
            </Link>
            <div className="flex items-center gap-2 text-xs text-white/40">
              <Link href="/broker/overview" className="hover:text-white/70 transition-colors">Market Configuration</Link>
              <span>/</span>
              <span className="text-white/80">Instruments</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/instruments/groups"
              className="text-xs text-white/50 hover:text-white/80 transition-colors px-3 py-1.5 rounded border border-[#252530] hover:border-[#353540]"
            >
              Manage Groups
            </Link>
            <Link
              href="/trading-terms"
              className="text-xs text-white/50 hover:text-white/80 transition-colors px-3 py-1.5 rounded border border-[#252530] hover:border-[#353540]"
            >
              Trading Terms
            </Link>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white">Instruments Registry</h1>
          <p className="text-xs text-white/30 mt-1">Master list of all tradeable instruments and their base configurations</p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-1 bg-[#111116] border border-[#252530] rounded-lg p-1">
            {GROUP_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveGroup(tab)}
                className={`text-xs px-3 py-1.5 rounded transition-colors ${
                  activeGroup === tab
                    ? 'bg-cyan-500/15 text-cyan-400'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Search symbol..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs bg-[#111116] border border-[#252530] rounded-lg px-3 py-2 text-white placeholder-white/25 focus:outline-none focus:border-cyan-500/40 w-48"
          />
          <span className="text-xs text-white/30 ml-auto">{filtered.length} instruments</span>
        </div>

        {/* Table */}
        <div className="bg-[#111116] border border-[#252530] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#252530] text-white/40">
                  <th className="text-left px-4 py-3 font-medium">Symbol</th>
                  <th className="text-left px-4 py-3 font-medium">Group</th>
                  <th className="text-right px-4 py-3 font-medium">Digits</th>
                  <th className="text-right px-4 py-3 font-medium">Contract Size</th>
                  <th className="text-right px-4 py-3 font-medium">Pip Size</th>
                  <th className="text-right px-4 py-3 font-medium">Pip Value</th>
                  <th className="text-right px-4 py-3 font-medium">Margin%</th>
                  <th className="text-center px-4 py-3 font-medium">Tradable</th>
                  <th className="text-right px-4 py-3 font-medium">Swap L</th>
                  <th className="text-right px-4 py-3 font-medium">Swap S</th>
                  <th className="text-right px-4 py-3 font-medium">Min Vol</th>
                  <th className="text-right px-4 py-3 font-medium">Max Vol</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inst) => (
                  <tr key={inst.symbol} className="border-b border-[#1a1a22] hover:bg-[#161620] transition-colors">
                    <td className="px-4 py-2.5 font-mono font-semibold text-white">{inst.symbol}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold"
                          style={{ backgroundColor: inst.groupColor + '20', color: inst.groupColor }}
                        >
                          {inst.groupIcon}
                        </span>
                        <span className="text-white/60">{inst.group}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-white/50">{inst.digits}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-white/50">{inst.contract_size.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-white/50">{inst.pip_size}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-white/50">${inst.pip_value}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-white/50">{inst.margin_pct}%</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-block w-2 h-2 rounded-full ${inst.tradable ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    </td>
                    <td className={`px-4 py-2.5 text-right font-mono ${inst.swap_long >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                      {inst.swap_long}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-mono ${inst.swap_short >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                      {inst.swap_short}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-white/50">{inst.min_volume}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-white/50">{inst.max_volume}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

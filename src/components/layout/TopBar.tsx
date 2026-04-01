'use client';

import { useState } from 'react';
import { Sun, Moon, ChevronDown, User, LogOut, Settings } from 'lucide-react';
import { useTradingStore } from '@/stores/trading';
import { formatCurrency, cn } from '@/lib/utils/format';
import type { TradingAccount } from '@/types/trading';

const mockAccounts: TradingAccount[] = [
  {
    id: 'acc-1',
    user_id: 'u1',
    account_number: 'RAP-100201',
    account_type: 'raw_spread',
    currency: 'USD',
    leverage: 500,
    balance: 25430.18,
    credit: 0,
    is_demo: false,
    is_active: true,
  },
  {
    id: 'acc-2',
    user_id: 'u1',
    account_number: 'RAP-100202',
    account_type: 'demo',
    currency: 'USD',
    leverage: 100,
    balance: 100000.0,
    credit: 0,
    is_demo: true,
    is_active: true,
  },
];

export default function TopBar() {
  const { accountSummary, theme, toggleTheme } = useTradingStore();
  const [selectedAccount, setSelectedAccount] = useState(mockAccounts[0]);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const balance = accountSummary.balance || selectedAccount.balance;
  const equity = accountSummary.equity || balance;
  const freeMargin = accountSummary.free_margin || balance;
  const marginLevel = accountSummary.margin_level_pct;

  return (
    <div
      className="flex items-center justify-between px-4 border-b select-none"
      style={{
        height: 48,
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Left: Logo */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-lg font-bold" style={{ color: '#29ABE2' }}>
          GIO4X
        </span>
        <span className="text-sm font-medium opacity-70">Raptor</span>
      </div>

      {/* Center: Account selector */}
      <div className="relative">
        <button
          onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded text-sm hover:opacity-80 transition-opacity"
          style={{ backgroundColor: 'var(--bg-elevated)' }}
        >
          <span className="font-mono text-xs opacity-60">
            {selectedAccount.account_number}
          </span>
          <span className="font-mono font-medium">
            {formatCurrency(balance)}
          </span>
          {selectedAccount.is_demo && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded"
              style={{ backgroundColor: '#29ABE2', color: '#000' }}
            >
              DEMO
            </span>
          )}
          <ChevronDown size={14} className="opacity-50" />
        </button>

        {accountDropdownOpen && (
          <div
            className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-64 rounded-md shadow-lg z-50 border py-1"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border)',
            }}
          >
            {mockAccounts.map((acc) => (
              <button
                key={acc.id}
                onClick={() => {
                  setSelectedAccount(acc);
                  setAccountDropdownOpen(false);
                }}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 text-sm hover:opacity-80 transition-opacity',
                  selectedAccount.id === acc.id && 'opacity-100',
                  selectedAccount.id !== acc.id && 'opacity-60'
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs">{acc.account_number}</span>
                  {acc.is_demo && (
                    <span
                      className="text-[9px] font-bold px-1 rounded"
                      style={{ backgroundColor: '#29ABE2', color: '#000' }}
                    >
                      DEMO
                    </span>
                  )}
                </div>
                <span className="font-mono">
                  {formatCurrency(acc.balance)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: Account summary mini + controls */}
      <div className="flex items-center gap-4 shrink-0">
        {/* Account summary mini */}
        <div className="hidden lg:flex items-center gap-4 text-xs">
          <div className="flex flex-col items-end">
            <span className="opacity-50">Balance</span>
            <span className="font-mono">{formatCurrency(balance)}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="opacity-50">Equity</span>
            <span className="font-mono">{formatCurrency(equity)}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="opacity-50">Free Margin</span>
            <span className="font-mono">{formatCurrency(freeMargin)}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="opacity-50">Margin Level</span>
            <span className="font-mono">
              {marginLevel > 0 ? `${marginLevel.toFixed(1)}%` : '--'}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div
          className="hidden lg:block w-px h-6"
          style={{ backgroundColor: 'var(--border)' }}
        />

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded hover:opacity-70 transition-opacity"
          title="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="p-1.5 rounded hover:opacity-70 transition-opacity"
          >
            <User size={16} />
          </button>

          {userMenuOpen && (
            <div
              className="absolute top-full right-0 mt-1 w-44 rounded-md shadow-lg z-50 border py-1"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border)',
              }}
            >
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:opacity-70 transition-opacity"
                onClick={() => setUserMenuOpen(false)}
              >
                <Settings size={14} />
                Settings
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:opacity-70 transition-opacity"
                onClick={() => setUserMenuOpen(false)}
              >
                <LogOut size={14} />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

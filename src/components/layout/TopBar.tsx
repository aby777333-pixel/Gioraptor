'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sun,
  Moon,
  ChevronDown,
  LogOut,
  Settings,
  RefreshCw,
  BarChart3,
  Wallet,
} from 'lucide-react';
import { useTradingStore } from '@/stores/trading';
import { cn } from '@/lib/utils/format';
import { createClient } from '@/lib/supabase/client';
import type { TradingAccount } from '@/types/trading';

type TopBarTab = 'market' | 'accounts';

export default function TopBar() {
  const {
    activeSymbol,
    theme,
    toggleTheme,
    setActiveAccountId,
  } = useTradingStore();

  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<TradingAccount | null>(null);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TopBarTab>('market');
  const [latency, setLatency] = useState(18);
  const [speed] = useState(13.3);

  const accountRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountDropdownOpen(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Load accounts from Supabase
  useEffect(() => {
    let cancelled = false;
    async function loadAccounts() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        const { data, error } = await supabase
          .from('trading_accounts')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('created_at', { ascending: true });

        if (error || !data || cancelled) return;

        const mapped: TradingAccount[] = data.map((row: Record<string, unknown>) => ({
          id: row.id as string,
          user_id: row.user_id as string,
          account_number: row.account_number as string,
          account_type: row.account_type as TradingAccount['account_type'],
          currency: (row.currency as string) || 'USD',
          leverage: (row.leverage as number) || 100,
          balance: (row.balance as number) || 0,
          credit: (row.credit as number) || 0,
          is_demo: (row.is_demo as boolean) || false,
          is_active: true,
        }));

        if (mapped.length > 0) {
          setAccounts(mapped);
          setSelectedAccount(mapped[0]);
          setActiveAccountId(mapped[0].id);
        }
      } catch {
        // Supabase not configured or no auth - use fallback
        const fallback: TradingAccount[] = [
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
        if (!cancelled) {
          setAccounts(fallback);
          setSelectedAccount(fallback[0]);
          setActiveAccountId(fallback[0].id);
        }
      }
    }
    loadAccounts();
    return () => {
      cancelled = true;
    };
  }, [setActiveAccountId]);

  // Simulated latency ticker (5-50ms, updates every 3s)
  useEffect(() => {
    const iv = setInterval(() => {
      setLatency(Math.floor(Math.random() * 46) + 5);
    }, 3000);
    return () => clearInterval(iv);
  }, []);

  const handleSelectAccount = useCallback(
    (acc: TradingAccount) => {
      setSelectedAccount(acc);
      setActiveAccountId(acc.id);
      setAccountDropdownOpen(false);
    },
    [setActiveAccountId]
  );

  const userName = 'Trader';
  const accountNum = selectedAccount?.account_number ?? '---';

  return (
    <div
      className="flex items-center px-2 border-b select-none gap-0"
      style={{
        height: 42,
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border)',
        fontSize: 12,
      }}
    >
      {/* ── Logo ── */}
      <div className="flex items-center gap-1.5 shrink-0 mr-3">
        <div
          className="flex items-center justify-center rounded"
          style={{
            width: 26,
            height: 26,
            backgroundColor: '#29ABE2',
            color: '#000',
            fontWeight: 800,
            fontSize: 11,
            lineHeight: 1,
          }}
        >
          G4
        </div>
        <div className="flex flex-col leading-none">
          <span className="font-bold text-[11px]" style={{ color: '#29ABE2' }}>
            GIO4X
          </span>
          <span className="text-[9px] opacity-50 -mt-px">Raptor</span>
        </div>
      </div>

      {/* ── Separator ── */}
      <Separator />

      {/* ── Nav tabs ── */}
      <NavTab
        active={activeTab === 'market'}
        onClick={() => setActiveTab('market')}
        icon={<BarChart3 size={13} />}
        label="Market View"
      />
      <NavTab
        active={activeTab === 'accounts'}
        onClick={() => setActiveTab('accounts')}
        icon={<Wallet size={13} />}
        label="Accounts"
      />

      <Separator />

      {/* ── Active symbol + timeframe ── */}
      <div className="flex items-center gap-1.5 px-2">
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: '#00C853' }}
        />
        <span className="font-mono font-semibold text-[12px]">
          {activeSymbol}
        </span>
        <span
          className="text-[10px] font-mono px-1 py-px rounded"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            opacity: 0.7,
          }}
        >
          1D
        </span>
        <span
          className="text-[10px] font-mono px-1 py-px rounded"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            opacity: 0.7,
          }}
        >
          1m
        </span>
      </div>

      {/* ── Spacer ── */}
      <div className="flex-1" />

      {/* ── Connection status ── */}
      <div className="flex items-center gap-2 px-2 text-[11px] font-mono opacity-70">
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ backgroundColor: latency < 40 ? '#00C853' : '#FFC107' }}
        />
        <span>{latency}ms</span>
        <span className="opacity-40">|</span>
        <span>{speed} Mbps</span>
      </div>

      {/* ── Refresh ── */}
      <button
        className="p-1 rounded hover:opacity-70 transition-opacity"
        title="Refresh"
        onClick={() => window.location.reload()}
      >
        <RefreshCw size={13} className="opacity-50" />
      </button>

      <Separator />

      {/* ── Theme toggle ── */}
      <button
        onClick={toggleTheme}
        className="p-1 rounded hover:opacity-70 transition-opacity"
        title="Toggle theme"
      >
        {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
      </button>

      <Separator />

      {/* ── Account selector ── */}
      <div className="relative" ref={accountRef}>
        <button
          onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
          className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] hover:opacity-80 transition-opacity"
          style={{ backgroundColor: 'var(--bg-elevated)' }}
        >
          <span className="opacity-60">{userName}</span>
          <span className="font-mono font-medium">{accountNum}</span>
          {selectedAccount?.is_demo && (
            <span
              className="text-[9px] font-bold px-1 rounded"
              style={{ backgroundColor: '#29ABE2', color: '#000' }}
            >
              DEMO
            </span>
          )}
          <ChevronDown size={12} className="opacity-40" />
        </button>

        {accountDropdownOpen && (
          <div
            className="absolute top-full right-0 mt-1 w-60 rounded shadow-lg z-50 border py-1"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border)',
            }}
          >
            {accounts.map((acc) => (
              <button
                key={acc.id}
                onClick={() => handleSelectAccount(acc)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-1.5 text-[11px] hover:opacity-80 transition-opacity',
                  selectedAccount?.id === acc.id && 'opacity-100',
                  selectedAccount?.id !== acc.id && 'opacity-50'
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono">{acc.account_number}</span>
                  {acc.is_demo && (
                    <span
                      className="text-[9px] font-bold px-1 rounded"
                      style={{ backgroundColor: '#29ABE2', color: '#000' }}
                    >
                      DEMO
                    </span>
                  )}
                </div>
                <span className="font-mono opacity-60">
                  1:{acc.leverage}
                </span>
              </button>
            ))}

            <div
              className="my-1 h-px"
              style={{ backgroundColor: 'var(--border)' }}
            />

            {/* Settings / sign out */}
            <button
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] hover:opacity-70 transition-opacity"
              onClick={() => setAccountDropdownOpen(false)}
            >
              <Settings size={12} />
              Settings
            </button>
            <button
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] hover:opacity-70 transition-opacity"
              onClick={() => setAccountDropdownOpen(false)}
            >
              <LogOut size={12} />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── tiny reusable pieces ── */

function Separator() {
  return (
    <div
      className="mx-1.5 h-5"
      style={{ width: 1, backgroundColor: 'var(--border)' }}
    />
  );
}

function NavTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 px-2.5 py-1 rounded text-[11px] transition-opacity',
        active ? 'opacity-100' : 'opacity-50 hover:opacity-70'
      )}
      style={
        active
          ? { backgroundColor: 'var(--bg-elevated)' }
          : undefined
      }
    >
      {icon}
      {label}
    </button>
  );
}

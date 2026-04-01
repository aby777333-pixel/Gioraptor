'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sun,
  Moon,
  ChevronDown,
  LogOut,
  Settings,
  RefreshCw,
  Mic,
  Bot,
  Brain,
  Calendar,
  Newspaper,
  Users,
  PieChart,
  Activity,
  Search,
} from 'lucide-react';
import Link from 'next/link';
import VoiceTrading from '@/components/trading/VoiceTrading';
import { useTradingStore } from '@/stores/trading';
import { cn } from '@/lib/utils/format';
import { createClient } from '@/lib/supabase/client';
import type { TradingAccount } from '@/types/trading';

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
  const [latency, setLatency] = useState(18);
  const [speed] = useState(13.3);
  const [voicePanelOpen, setVoicePanelOpen] = useState(false);

  const accountRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountDropdownOpen(false);
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

  // Simulated latency ticker
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

  const helpMenuItems = [
    { href: '/terminal/ea-builder', icon: <Bot size={14} />, label: 'EA Builder' },
    { href: '/terminal/signals', icon: <Brain size={14} />, label: 'AI Signals' },
    { href: '/terminal/calendar', icon: <Calendar size={14} />, label: 'Calendar' },
    { href: '/terminal/news', icon: <Newspaper size={14} />, label: 'News' },
    { href: '/terminal/copy-trading', icon: <Users size={14} />, label: 'Copy Trading' },
    { href: '/terminal/pamm', icon: <PieChart size={14} />, label: 'PAMM' },
  ];

  return (
    <div
      className="flex items-center px-3 border-b select-none"
      style={{
        height: 48,
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border)',
        fontSize: 13,
      }}
    >
      {/* ── Logo ── */}
      <div className="flex items-center gap-2 shrink-0 mr-4">
        <img src="/logo.png" alt="GIO4X" style={{ height: 28 }} />
      </div>

      <Separator />

      {/* ── Nav items: all inline, evenly spaced ── */}
      <div className="flex items-center gap-0.5">
        <NavItem label="View" active />
        <NavItem label="New Order" />
        <NavItem label="Help" />
        {helpMenuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-1 px-3 py-1 rounded text-[13px] opacity-50 hover:opacity-90 transition-opacity whitespace-nowrap"
          >
            {item.label}
          </Link>
        ))}
      </div>

      <Separator />

      {/* ── Active symbol + timeframe ── */}
      <div className="flex items-center gap-2 px-3">
        <Search size={14} className="opacity-40" />
        <span className="font-mono font-semibold text-[13px]">
          {activeSymbol}
        </span>
        <span
          className="text-[11px] font-mono px-1.5 py-0.5 rounded"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            opacity: 0.8,
          }}
        >
          1D
        </span>
        <span
          className="text-[11px] font-mono px-1.5 py-0.5 rounded"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            opacity: 0.8,
          }}
        >
          1m
        </span>
        <ChevronDown size={12} className="opacity-40" />
      </div>

      {/* ── Indicators button ── */}
      <button
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[13px] opacity-60 hover:opacity-90 transition-opacity"
        style={{ backgroundColor: 'var(--bg-elevated)' }}
        title="Indicators"
      >
        <Activity size={14} />
        Indicators
      </button>

      {/* ── Spacer ── */}
      <div className="flex-1" />

      {/* ── Right side controls with proper spacing ── */}
      <div className="flex items-center gap-3">

        {/* Connection status */}
        <div className="flex items-center gap-2 px-3 text-[13px] font-mono opacity-70">
          <span
            className="inline-block w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: latency < 40 ? '#00C853' : '#FFC107' }}
          />
          <span>{latency}ms</span>
          <span className="opacity-40">|</span>
          <span>{speed} Mbps</span>
        </div>

        <Separator />

        {/* Refresh */}
        <button
          className="p-2 rounded hover:opacity-70 transition-opacity"
          title="Refresh"
          onClick={() => window.location.reload()}
        >
          <RefreshCw size={16} className="opacity-50" />
        </button>

        {/* Theme toggle */}
        <button
          onClick={() => {
            const newTheme = theme === 'dark' ? 'light' : 'dark';
            toggleTheme();
            document.documentElement.setAttribute('data-theme', newTheme);
          }}
          className="p-2 rounded hover:opacity-70 transition-opacity"
          title="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={16} className="opacity-60" /> : <Moon size={16} className="opacity-60" />}
        </button>

        {/* Voice Trading */}
        <button
          onClick={() => setVoicePanelOpen(!voicePanelOpen)}
          className="p-2 rounded hover:opacity-70 transition-opacity"
          title="Voice Trading"
          style={voicePanelOpen ? { color: '#29ABE2' } : undefined}
        >
          <Mic size={16} className={voicePanelOpen ? '' : 'opacity-50'} />
        </button>

      </div>

      {/* Voice panel dropdown */}
      <div className="relative">
        <div /> {/* anchor */}

        {voicePanelOpen && (
          <div
            className="absolute top-full right-0 mt-1 z-50"
            style={{ filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.4))' }}
          >
            <VoiceTrading onClose={() => setVoicePanelOpen(false)} />
          </div>
        )}
      </div>

      <Separator />

      {/* ── Account selector ── */}
      <div className="relative" ref={accountRef}>
        <button
          onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded text-[13px] hover:opacity-80 transition-opacity"
          style={{ backgroundColor: 'var(--bg-elevated)' }}
        >
          <span className="opacity-60">{userName}</span>
          <span className="font-mono font-medium">{accountNum}</span>
          {selectedAccount?.is_demo && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded"
              style={{ backgroundColor: '#29ABE2', color: '#000' }}
            >
              DEMO
            </span>
          )}
          <ChevronDown size={13} className="opacity-40" />
        </button>

        {accountDropdownOpen && (
          <div
            className="absolute top-full right-0 mt-1 w-64 rounded-lg shadow-xl z-50 border py-1.5"
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
                  'w-full flex items-center justify-between px-4 py-2 text-[13px] transition-colors',
                  selectedAccount?.id === acc.id && 'opacity-100',
                  selectedAccount?.id !== acc.id && 'opacity-50'
                )}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono">{acc.account_number}</span>
                  {acc.is_demo && (
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded"
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
              className="my-1.5 h-px"
              style={{ backgroundColor: 'var(--border)' }}
            />

            <button
              className="w-full flex items-center gap-2.5 px-4 py-2 text-[13px] hover:opacity-70 transition-opacity"
              onClick={() => setAccountDropdownOpen(false)}
            >
              <Settings size={14} />
              Settings
            </button>
            <button
              className="w-full flex items-center gap-2.5 px-4 py-2 text-[13px] hover:opacity-70 transition-opacity"
              onClick={() => setAccountDropdownOpen(false)}
            >
              <LogOut size={14} />
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
      className="mx-2 h-6"
      style={{ width: 1, backgroundColor: 'var(--border)' }}
    />
  );
}

function NavItem({
  active,
  label,
}: {
  active?: boolean;
  label: string;
}) {
  return (
    <button
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded text-[13px] transition-colors',
        active ? 'opacity-100' : 'opacity-60 hover:opacity-90'
      )}
      style={
        active
          ? { backgroundColor: 'var(--bg-elevated)' }
          : undefined
      }
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: active ? '#29ABE2' : 'var(--text-muted)' }}
      />
      {label}
    </button>
  );
}

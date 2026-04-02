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
  Bell,
  BarChart3,
  Grid3X3,
  ArrowLeft,
  TrendingUp,
  LineChart,
  Wallet,
  Shield,
  Building2,
  Layers,
  Menu,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import VoiceTrading from '@/components/trading/VoiceTrading';
import AlertsPanel from '@/components/trading/alerts/AlertsPanel';
import { useTradingStore } from '@/stores/trading';
import { cn } from '@/lib/utils/format';
import { createClient } from '@/lib/supabase/client';
import type { TradingAccount } from '@/types/trading';

interface MenuCategory {
  label: string;
  icon: React.ReactNode;
  items: { href: string; icon: React.ReactNode; label: string; desc?: string }[];
}

const menuCategories: MenuCategory[] = [
  {
    label: 'Trading',
    icon: <TrendingUp size={14} />,
    items: [
      { href: '/terminal', icon: <LineChart size={14} />, label: 'Terminal', desc: 'Full trading terminal' },
      { href: '/terminal/ea-builder', icon: <Bot size={14} />, label: 'EA Builder', desc: 'Build automated strategies' },
      { href: '/terminal/signals', icon: <Brain size={14} />, label: 'AI Signals', desc: 'AI-powered trade signals' },
    ],
  },
  {
    label: 'Analysis',
    icon: <BarChart3 size={14} />,
    items: [
      { href: '/terminal/analytics', icon: <BarChart3 size={14} />, label: 'Analytics', desc: 'Performance analytics' },
      { href: '/terminal/heatmap', icon: <Grid3X3 size={14} />, label: 'Heatmap', desc: 'Market heatmap' },
      { href: '/terminal/calendar', icon: <Calendar size={14} />, label: 'Calendar', desc: 'Economic calendar' },
      { href: '/terminal/news', icon: <Newspaper size={14} />, label: 'News', desc: 'Market news feed' },
    ],
  },
  {
    label: 'Social',
    icon: <Users size={14} />,
    items: [
      { href: '/terminal/copy-trading', icon: <Users size={14} />, label: 'Copy Trading', desc: 'Follow top traders' },
      { href: '/terminal/pamm', icon: <PieChart size={14} />, label: 'PAMM / MAM', desc: 'Managed accounts' },
    ],
  },
  {
    label: 'More',
    icon: <Layers size={14} />,
    items: [
      { href: '/terminal/prop', icon: <Wallet size={14} />, label: 'Prop Trading', desc: 'Funded challenges' },
      { href: '/terminal/white-label', icon: <Building2 size={14} />, label: 'White Label', desc: 'Launch your brand' },
      { href: '/admin', icon: <Shield size={14} />, label: 'Admin Panel', desc: 'Broker admin' },
    ],
  },
];

export default function TopBar() {
  const {
    activeSymbol,
    theme,
    toggleTheme,
    setActiveAccountId,
  } = useTradingStore();

  const pathname = usePathname();
  const isSubPage = pathname !== '/terminal' && pathname.startsWith('/terminal/');

  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<TradingAccount | null>(null);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [latency, setLatency] = useState(18);
  const [speed] = useState(13.3);
  const [voicePanelOpen, setVoicePanelOpen] = useState(false);
  const [alertsPanelOpen, setAlertsPanelOpen] = useState(false);
  const [alertCount] = useState(0);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const accountRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountDropdownOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
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
        const { data: { user } } = await supabase.auth.getUser();
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
        const fallback: TradingAccount[] = [
          {
            id: 'acc-1', user_id: 'u1', account_number: 'RAP-100201',
            account_type: 'raw_spread', currency: 'USD', leverage: 500,
            balance: 25430.18, credit: 0, is_demo: false, is_active: true,
          },
          {
            id: 'acc-2', user_id: 'u1', account_number: 'RAP-100202',
            account_type: 'demo', currency: 'USD', leverage: 100,
            balance: 100000.0, credit: 0, is_demo: true, is_active: true,
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
    return () => { cancelled = true; };
  }, [setActiveAccountId]);

  // Simulated latency ticker
  useEffect(() => {
    const iv = setInterval(() => setLatency(Math.floor(Math.random() * 46) + 5), 3000);
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

  const accountNum = selectedAccount?.account_number ?? '---';

  return (
    <div
      className="flex items-center px-2 border-b select-none"
      style={{
        height: 44,
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border)',
        fontSize: 12,
      }}
    >
      {/* ── Logo + Back Arrow ── */}
      <div className="flex items-center gap-2 shrink-0 mr-2">
        {isSubPage ? (
          <Link
            href="/terminal"
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all hover:bg-[var(--bg-elevated)]"
            title="Back to Terminal"
          >
            <ArrowLeft size={16} className="text-[#0091D5]" />
            <img src="/logo.png" alt="GIO4X" style={{ height: 24 }} />
          </Link>
        ) : (
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="GIO4X" style={{ height: 28 }} />
          </Link>
        )}
      </div>

      {/* ── Mobile hamburger ── */}
      <button
        className="lg:hidden p-2 rounded hover:opacity-70 transition-opacity"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      <Separator />

      {/* ── Categorized dropdown menus (desktop) ── */}
      <div className="hidden lg:flex items-center gap-0.5" ref={menuRef}>
        {menuCategories.map((cat) => (
          <div key={cat.label} className="relative">
            <button
              onClick={() => setOpenMenu(openMenu === cat.label ? null : cat.label)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] transition-all',
                openMenu === cat.label
                  ? 'bg-[var(--bg-elevated)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-elevated)]'
              )}
            >
              {cat.icon}
              <span className="font-medium">{cat.label}</span>
              <ChevronDown
                size={11}
                className={cn(
                  'transition-transform',
                  openMenu === cat.label && 'rotate-180'
                )}
              />
            </button>

            {openMenu === cat.label && (
              <div
                className="absolute top-full left-0 mt-1 w-56 rounded-xl shadow-2xl border py-1.5 z-50"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border)',
                  filter: 'drop-shadow(0 12px 40px rgba(0,0,0,0.5))',
                }}
              >
                {cat.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpenMenu(null)}
                      className={cn(
                        'flex items-center gap-3 px-4 py-2.5 text-[12px] transition-all',
                        isActive
                          ? 'text-white bg-[var(--bg-hover)]'
                          : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)]'
                      )}
                    >
                      <span className={isActive ? 'text-[#0091D5]' : 'opacity-60'}>{item.icon}</span>
                      <div>
                        <div className="font-medium">{item.label}</div>
                        {item.desc && (
                          <div className="text-[10px] opacity-40 mt-0.5">{item.desc}</div>
                        )}
                      </div>
                      {isActive && (
                        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#0091D5]" />
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <Separator />

      {/* ── Active symbol + timeframe (hide on small mobile) ── */}
      <div className="hidden sm:flex items-center gap-2 px-3">
        <Search size={14} className="opacity-40" />
        <span className="font-mono font-semibold text-[13px]">{activeSymbol}</span>
        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-elevated)', opacity: 0.8 }}>1D</span>
        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-elevated)', opacity: 0.8 }}>1m</span>
      </div>

      {/* ── Indicators button (hidden on mobile) ── */}
      <button
        className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] opacity-60 hover:opacity-90 transition-opacity"
        style={{ backgroundColor: 'var(--bg-elevated)' }}
        title="Indicators"
      >
        <Activity size={14} />
        Indicators
      </button>

      {/* ── Spacer ── */}
      <div className="flex-1" />

      {/* ── Right side controls ── */}
      <div className="flex items-center gap-2">
        {/* Connection status (hidden on mobile) */}
        <div className="hidden md:flex items-center gap-2 px-3 text-[12px] font-mono opacity-70">
          <span
            className="inline-block w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: latency < 40 ? '#00C853' : '#FFC107' }}
          />
          <span>{latency}ms</span>
          <span className="opacity-40">|</span>
          <span>{speed} Mbps</span>
        </div>

        <Separator />

        <button className="p-2 rounded hover:opacity-70 transition-opacity" title="Refresh" onClick={() => window.location.reload()}>
          <RefreshCw size={15} className="opacity-50" />
        </button>

        <button
          onClick={() => {
            const newTheme = theme === 'dark' ? 'light' : 'dark';
            toggleTheme();
            document.documentElement.setAttribute('data-theme', newTheme);
          }}
          className="p-2 rounded hover:opacity-70 transition-opacity"
          title="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={15} className="opacity-60" /> : <Moon size={15} className="opacity-60" />}
        </button>

        {/* Price Alerts */}
        <div className="relative">
          <button
            onClick={() => setAlertsPanelOpen(!alertsPanelOpen)}
            className="p-2 rounded hover:opacity-70 transition-opacity"
            title="Price Alerts"
            style={alertsPanelOpen ? { color: '#0091D5' } : undefined}
          >
            <Bell size={15} className={alertsPanelOpen ? '' : 'opacity-50'} />
            {alertCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center text-[9px] font-bold rounded-full" style={{ width: 16, height: 16, backgroundColor: '#0091D5', color: '#000' }}>
                {alertCount}
              </span>
            )}
          </button>
          <AlertsPanel isOpen={alertsPanelOpen} onClose={() => setAlertsPanelOpen(false)} />
        </div>

        {/* Voice Trading */}
        <button
          onClick={() => setVoicePanelOpen(!voicePanelOpen)}
          className="p-2 rounded hover:opacity-70 transition-opacity"
          title="Voice Trading"
          style={voicePanelOpen ? { color: '#0091D5' } : undefined}
        >
          <Mic size={15} className={voicePanelOpen ? '' : 'opacity-50'} />
        </button>
      </div>

      {/* Voice panel dropdown */}
      <div className="relative">
        <div />
        {voicePanelOpen && (
          <div className="absolute top-full right-0 mt-1 z-50" style={{ filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.4))' }}>
            <VoiceTrading onClose={() => setVoicePanelOpen(false)} />
          </div>
        )}
      </div>

      <Separator />

      {/* ── Account selector ── */}
      <div className="relative" ref={accountRef}>
        <button
          onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] hover:opacity-80 transition-opacity"
          style={{ backgroundColor: 'var(--bg-elevated)' }}
        >
          <span className="opacity-60">Trader</span>
          <span className="font-mono font-medium">{accountNum}</span>
          {selectedAccount?.is_demo && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: '#0091D5', color: '#000' }}>
              DEMO
            </span>
          )}
          <ChevronDown size={12} className="opacity-40" />
        </button>

        {accountDropdownOpen && (
          <div
            className="absolute top-full right-0 mt-1 w-64 rounded-xl shadow-xl z-50 border py-1.5"
            style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
          >
            {accounts.map((acc) => (
              <button
                key={acc.id}
                onClick={() => handleSelectAccount(acc)}
                className={cn(
                  'w-full flex items-center justify-between px-4 py-2 text-[12px] transition-colors',
                  selectedAccount?.id === acc.id ? 'opacity-100' : 'opacity-50'
                )}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono">{acc.account_number}</span>
                  {acc.is_demo && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: '#0091D5', color: '#000' }}>DEMO</span>
                  )}
                </div>
                <span className="font-mono opacity-60">1:{acc.leverage}</span>
              </button>
            ))}
            <div className="my-1.5 h-px" style={{ backgroundColor: 'var(--border)' }} />
            <Link href="/terminal/settings" className="w-full flex items-center gap-2.5 px-4 py-2 text-[12px] hover:opacity-70 transition-opacity" onClick={() => setAccountDropdownOpen(false)}>
              <Settings size={14} /> Settings
            </Link>
            <button className="w-full flex items-center gap-2.5 px-4 py-2 text-[12px] hover:opacity-70 transition-opacity" onClick={() => setAccountDropdownOpen(false)}>
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        )}
      </div>
      {/* ── Mobile menu overlay ── */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-[100] lg:hidden"
          style={{ top: 44, backgroundColor: 'var(--bg-primary)' }}
        >
          <div className="overflow-y-auto h-full p-4 space-y-2">
            {menuCategories.map((cat) => (
              <div key={cat.label}>
                <div className="text-[10px] font-bold uppercase tracking-wider px-3 py-2" style={{ color: 'var(--text-muted)' }}>
                  {cat.label}
                </div>
                {cat.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all hover:bg-[var(--bg-elevated)]"
                    style={{ color: pathname === item.href ? '#0091D5' : 'var(--text-secondary)' }}
                  >
                    {item.icon}
                    <div>
                      <div className="font-medium">{item.label}</div>
                      {item.desc && <div className="text-[10px] opacity-40">{item.desc}</div>}
                    </div>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Separator() {
  return <div className="mx-1.5 h-6" style={{ width: 1, backgroundColor: 'var(--border)' }} />;
}

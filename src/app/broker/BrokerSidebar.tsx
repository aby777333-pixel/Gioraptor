'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  BookMarked,
  ShieldAlert,
  Eye,
  BookOpen,
  CreditCard,
  Landmark,
  FileCheck,
  Network,
  Megaphone,
  Copy,
  Trophy,
  GraduationCap,
  UserCheck,
  Scale,
  HeadphonesIcon,
  FileText,
  ClipboardList,
  Settings,
  BarChart3,
  UserCog,
  Flag,
  BellRing,
  PanelLeftClose,
  PanelLeft,
  ChevronDown,
  ChevronRight,
  Bell,
  LogOut,
  Monitor,
  ExternalLink,
  Rocket,
  Layers,
  Clock,
  CalendarOff,
  FileSpreadsheet,
  Gauge,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: 'Platform',
    items: [
      { href: '/terminal', label: 'Trading Terminal', icon: Monitor },
      { href: '/dashboard', label: 'Trader Dashboard', icon: Rocket },
      { href: '/marketplace', label: 'Marketplace', icon: ExternalLink },
    ],
  },
  {
    label: 'Command',
    items: [
      { href: '/broker/command-center', label: 'Command Center', icon: LayoutDashboard },
      { href: '/broker/overview', label: 'Overview', icon: BarChart3 },
      { href: '/broker/ai-guardian', label: 'AI Intelligence', icon: Eye },
      { href: '/broker/intel', label: 'Business Intel', icon: BarChart3 },
    ],
  },
  {
    label: 'Trading',
    items: [
      { href: '/dealer', label: 'Dealing Desk', icon: Gauge },
      { href: '/broker/dealing-desk', label: 'Dealing Room', icon: BookMarked },
      { href: '/broker/core-engine', label: 'Core Engine', icon: Settings },
      { href: '/broker/risk', label: 'Risk Engine', icon: ShieldAlert },
      { href: '/broker/symbols', label: 'Symbols', icon: BarChart3 },
      { href: '/broker/surveillance', label: 'Surveillance', icon: Eye },
    ],
  },
  {
    label: 'Market Configuration',
    items: [
      { href: '/trading-terms', label: 'Trading Terms', icon: FileSpreadsheet },
      { href: '/instruments', label: 'Instruments', icon: BarChart3 },
      { href: '/instruments/groups', label: 'Symbol Groups', icon: Layers },
      { href: '/trading-sessions', label: 'Trading Sessions', icon: Clock },
      { href: '/trading-sessions/holidays', label: 'Market Holidays', icon: CalendarOff },
    ],
  },
  {
    label: 'Clients',
    items: [
      { href: '/broker/clients', label: 'Client List', icon: Users },
      { href: '/broker/crm', label: 'CRM Pipeline', icon: Users },
      { href: '/broker/comms', label: 'Communications', icon: HeadphonesIcon },
      { href: '/broker/ib-management', label: 'IB Management', icon: Network },
      { href: '/broker/ib', label: 'IB Network', icon: Network },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/broker/payments', label: 'Payments', icon: CreditCard },
      { href: '/broker/reconciliation', label: 'Reconciliation', icon: FileCheck },
      { href: '/broker/bi', label: 'Report Builder', icon: ClipboardList },
      { href: '/broker/reports', label: 'Reports', icon: FileText },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { href: '/broker/kyc', label: 'KYC Review', icon: UserCheck },
      { href: '/broker/compliance', label: 'Compliance', icon: Scale },
      { href: '/broker/comply', label: 'Regulatory', icon: Scale },
      { href: '/broker/security', label: 'Security', icon: ShieldAlert },
      { href: '/broker/incidents', label: 'Incidents', icon: Flag },
    ],
  },
  {
    label: 'Infrastructure',
    items: [
      { href: '/broker/integrations', label: 'Integrations', icon: Network },
      { href: '/broker/connect', label: 'Migration', icon: Network },
      { href: '/broker/brand', label: 'Brand Studio', icon: Settings },
      { href: '/broker/mobile-apps', label: 'Mobile Apps', icon: Settings },
      { href: '/broker/raptor-app', label: 'RAPTOR App', icon: Settings },
    ],
  },
  {
    label: 'Admin',
    items: [
      { href: '/broker/staff', label: 'Staff & Roles', icon: UserCog },
      { href: '/broker/team', label: 'Team', icon: UserCog },
      { href: '/broker/operations', label: 'Operations', icon: Settings },
      { href: '/broker/settings', label: 'Settings', icon: Settings },
      { href: '/broker/support', label: 'Support Queue', icon: HeadphonesIcon },
    ],
  },
];

interface BrokerSidebarProps {
  brokerName: string;
  userEmail: string;
  environment?: 'LIVE' | 'SANDBOX';
}

export function BrokerSidebar({ brokerName, userEmail, environment = 'LIVE' }: BrokerSidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navSections.forEach((s) => (initial[s.label] = true));
    return initial;
  });

  const isActive = (href: string) => {
    if (href === '/broker/overview') return pathname === '/broker' || pathname === '/broker/overview';
    return pathname.startsWith(href);
  };

  const toggleSection = (label: string) => {
    setOpenSections((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <aside
      className={`hidden md:flex h-full flex-col shrink-0 border-r transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
      style={{
        backgroundColor: 'var(--bg-primary)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Logo header */}
      <div
        className="h-14 flex items-center px-4 shrink-0 gap-2.5"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0091D5] to-[#009B4D] flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold tracking-tight">R</span>
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              RAPTOR
            </div>
            <div className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Broker
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-white/[0.04] transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 hide-scrollbar">
        {navSections.map((section) => (
          <div key={section.label} className="mb-1">
            {!collapsed && (
              <button
                onClick={() => toggleSection(section.label)}
                className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest hover:bg-white/[0.02] rounded transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                {section.label}
                {openSections[section.label] ? (
                  <ChevronDown size={12} />
                ) : (
                  <ChevronRight size={12} />
                )}
              </button>
            )}
            {(collapsed || openSections[section.label]) && (
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={`flex items-center gap-2.5 rounded-md text-[13px] font-medium transition-colors ${
                        collapsed ? 'justify-center px-2 py-2' : 'px-2.5 py-1.5'
                      }`}
                      style={{
                        color: active ? 'var(--accent)' : 'var(--text-secondary)',
                        backgroundColor: active ? 'var(--accent-glow)' : undefined,
                      }}
                    >
                      <Icon size={16} strokeWidth={active ? 2 : 1.5} />
                      {!collapsed && item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="shrink-0 p-2" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="px-2.5 py-2">
          <div className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
            {collapsed ? '' : userEmail}
          </div>
        </div>
        <Link
          href="/auth/login"
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-white/[0.04] transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          <LogOut size={14} />
          {!collapsed && <span className="text-[13px]">Sign Out</span>}
        </Link>
      </div>
    </aside>
  );
}

interface BrokerTopBarProps {
  brokerName: string;
  userEmail: string;
  environment?: 'LIVE' | 'SANDBOX';
}

export function BrokerTopBar({ brokerName, userEmail, environment = 'LIVE' }: BrokerTopBarProps) {
  const pathname = usePathname();

  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs = segments.map((seg, i) => ({
    label: seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' '),
    href: '/' + segments.slice(0, i + 1).join('/'),
    isLast: i === segments.length - 1,
  }));

  return (
    <header
      className="h-12 flex items-center justify-between px-4 md:px-6 shrink-0"
      style={{
        backgroundColor: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Left: broker name + environment badge + breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
          {brokerName}
        </span>
        <span
          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
            environment === 'LIVE'
              ? 'bg-[var(--accent-green-glow)] text-[var(--accent-green)]'
              : 'bg-[var(--gold-glow)] text-[var(--gold)]'
          }`}
        >
          {environment}
        </span>
        <div className="hidden md:flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span>/</span>
          {breadcrumbs.slice(1).map((crumb, i) => (
            <span key={crumb.href} className="flex items-center gap-1.5">
              {i > 0 && <span>/</span>}
              {crumb.isLast ? (
                <span style={{ color: 'var(--text-primary)' }} className="font-medium">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="hover:underline"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {crumb.label}
                </Link>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        <button
          className="relative p-1.5 rounded-md hover:bg-white/[0.04] transition-colors"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Bell size={16} />
          <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-[var(--loss)]" />
        </button>
        <span className="hidden md:block text-xs mono" style={{ color: 'var(--text-muted)' }}>
          {userEmail}
        </span>
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ backgroundColor: 'var(--accent-glow)', color: 'var(--accent)' }}
        >
          {(userEmail[0] ?? 'B').toUpperCase()}
        </div>
      </div>
    </header>
  );
}

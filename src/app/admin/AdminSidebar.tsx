'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Wallet,
  TrendingUp,
  FileText,
  Settings,
  Shield,
  BarChart3,
  LogOut,
} from 'lucide-react';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/accounts', label: 'Accounts', icon: Wallet },
  { href: '/admin/positions', label: 'Positions', icon: TrendingUp },
  { href: '/admin/orders', label: 'Orders', icon: FileText },
  { href: '/admin/instruments', label: 'Instruments', icon: BarChart3 },
  { href: '/admin/risk', label: 'Risk Management', icon: Shield },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export function AdminSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-60 h-full bg-[#0A0A0F] border-r border-white/[0.06] flex flex-col shrink-0">
      <div className="h-14 flex items-center px-5 border-b border-white/[0.06] gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#29ABE2] to-[#29ABE2]/60 flex items-center justify-center">
          <span className="text-white text-sm font-bold">G</span>
        </div>
        <div>
          <div className="text-sm font-semibold text-white tracking-tight">GIO4X Raptor</div>
          <div className="text-[10px] text-white/30 uppercase tracking-widest">Admin Panel</div>
        </div>
      </div>

      <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${
                active
                  ? 'bg-[#29ABE2]/10 text-[#29ABE2]'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
              }`}
            >
              <Icon size={16} strokeWidth={active ? 2 : 1.5} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-white/[0.06]">
        <div className="px-3 py-2 text-xs text-white/30 truncate">{userEmail}</div>
        <Link
          href="/auth/login"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-[13px] text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-colors"
        >
          <LogOut size={14} />
          Sign Out
        </Link>
      </div>
    </aside>
  );
}

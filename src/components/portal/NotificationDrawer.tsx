'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { X, Bell, CheckCheck } from 'lucide-react';

interface PortalNotification {
  id: string;
  title: string;
  body: string;
  category: 'trading' | 'wallet' | 'kyc' | 'system' | 'ib';
  createdAt: string;
  read: boolean;
}

/**
 * Slide-in notification drawer triggered by the topbar bell. The list
 * is in-memory placeholder data — Module 13 (full notification center)
 * will swap this for a Supabase Realtime channel against the
 * `notifications` table.
 */
export default function NotificationDrawer({
  open,
  onClose,
  notifications,
  onMarkAllRead,
}: {
  open: boolean;
  onClose: () => void;
  notifications: PortalNotification[];
  onMarkAllRead: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="gentleman fixed inset-0 z-[200]" aria-modal>
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.45)' }}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-label="Notifications"
        className="absolute right-0 top-0 bottom-0 w-full sm:w-[380px] flex flex-col border-l g-fade-in"
        style={{
          background: 'var(--g-bg-elevated)',
          borderColor: 'var(--g-border-hair)',
        }}
      >
        <header
          className="flex items-center justify-between px-4 border-b"
          style={{ borderColor: 'var(--g-border-hair)', height: 56 }}
        >
          <div className="flex items-center gap-2">
            <Bell size={15} style={{ color: 'var(--g-text-secondary)' }} />
            <span className="text-[13px] font-medium" style={{ color: 'var(--g-text-primary)' }}>
              Notifications
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onMarkAllRead}
              className="flex items-center gap-1 text-[11px] px-2 py-1 rounded transition-colors hover:bg-white/[0.04]"
              style={{ color: 'var(--g-text-secondary)' }}
            >
              <CheckCheck size={12} /> Mark all read
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 rounded transition-colors hover:bg-white/[0.04]"
              style={{ color: 'var(--g-text-muted)' }}
            >
              <X size={15} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center px-6 py-16">
              <Bell size={20} style={{ color: 'var(--g-text-muted)' }} />
              <div className="mt-3 text-[13px]" style={{ color: 'var(--g-text-secondary)' }}>
                You&apos;re all caught up.
              </div>
              <div className="mt-1 text-[11px]" style={{ color: 'var(--g-text-muted)' }}>
                We&apos;ll surface deposits, KYC updates, margin events, and IB commissions here.
              </div>
            </div>
          ) : (
            <ul className="list-none m-0 p-0">
              {notifications.map((n) => (
                <NotificationRow key={n.id} item={n} />
              ))}
            </ul>
          )}
        </div>

        <footer
          className="px-4 py-3 border-t text-center"
          style={{ borderColor: 'var(--g-border-hair)' }}
        >
          <Link
            href="/dashboard/notifications"
            onClick={onClose}
            className="text-[12px] hover:underline"
            style={{ color: 'var(--g-text-secondary)' }}
          >
            View all notifications →
          </Link>
        </footer>
      </aside>
    </div>
  );
}

function NotificationRow({ item }: { item: PortalNotification }) {
  return (
    <li
      className="px-4 py-3 border-b flex gap-3"
      style={{
        borderColor: 'var(--g-border-hair)',
        background: item.read ? 'transparent' : 'rgba(220,38,38,0.04)',
      }}
    >
      <span
        className="mt-1 shrink-0"
        style={{
          width: 6, height: 6, borderRadius: 6,
          background: item.read ? 'transparent' : 'var(--g-accent)',
        }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="text-[13px]" style={{ color: 'var(--g-text-primary)' }}>{item.title}</div>
        <div className="mt-0.5 text-[12px] leading-snug" style={{ color: 'var(--g-text-secondary)' }}>
          {item.body}
        </div>
        <div className="mt-1.5 text-[10px] uppercase tracking-wider" style={{ color: 'var(--g-text-muted)' }}>
          {item.category} · {item.createdAt}
        </div>
      </div>
    </li>
  );
}

export type { PortalNotification };

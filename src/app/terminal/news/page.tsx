'use client';

import { Newspaper, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import NewsFeed from '@/components/news/NewsFeed';

export default function NewsPage() {
  return (
    <div className="h-screen w-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 shrink-0"
        style={{
          height: 48,
          backgroundColor: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <Link
          href="/terminal"
          className="flex items-center gap-1 text-[11px] px-2 py-1 rounded transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft size={14} />
          Terminal
        </Link>
        <div style={{ width: 1, height: 20, backgroundColor: 'var(--border)' }} />
        <Newspaper size={16} style={{ color: '#0091D5' }} />
        <h1 className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          Market News
        </h1>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-hidden">
        <NewsFeed />
      </div>
    </div>
  );
}

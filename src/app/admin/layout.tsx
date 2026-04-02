import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AdminSidebar } from './AdminSidebar';
import Link from 'next/link';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#060D16]">
      <AdminSidebar userEmail={user.email ?? ''} />
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 flex items-center justify-between px-6 border-b border-white/[0.06] bg-[#060D16] shrink-0">
          <div className="flex items-center gap-4">
            <Link
              href="/terminal"
              className="flex items-center gap-1.5 text-xs text-white/40 hover:text-[#0091D5] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              Terminal
            </Link>
            <div className="w-px h-5 bg-white/[0.06]" />
            <h1 className="text-sm font-semibold text-white/80 tracking-wide uppercase">Broker Admin</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/40 mono">{user.email}</span>
            <div className="w-7 h-7 rounded-full bg-[#0091D5]/20 flex items-center justify-center text-[#0091D5] text-xs font-bold">
              {(user.email ?? 'A')[0].toUpperCase()}
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}

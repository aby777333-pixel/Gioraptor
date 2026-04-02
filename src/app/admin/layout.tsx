import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AdminSidebar } from './AdminSidebar';

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
    <div className="flex h-screen overflow-hidden bg-[#080C14]">
      <AdminSidebar userEmail={user.email ?? ''} />
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 flex items-center justify-between px-6 border-b border-white/[0.06] bg-[#080C14] shrink-0">
          <h1 className="text-sm font-semibold text-white/80 tracking-wide uppercase">Broker Admin</h1>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/40 mono">{user.email}</span>
            <div className="w-7 h-7 rounded-full bg-[#C8102E]/20 flex items-center justify-center text-[#C8102E] text-xs font-bold">
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

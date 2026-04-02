import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardSidebar, DashboardTopBar } from './DashboardSidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login?redirect=/dashboard');
  }

  // Fetch user profile for display
  const { data: profile } = await supabase
    .from('users')
    .select('full_name, avatar_url, role')
    .eq('id', user.id)
    .single();

  const userName = profile?.full_name ?? '';
  const userEmail = user.email ?? '';
  const userAvatar = profile?.avatar_url ?? null;

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <DashboardSidebar
        userName={userName}
        userEmail={userEmail}
        userAvatar={userAvatar}
      />
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <DashboardTopBar userName={userName} userEmail={userEmail} />
        <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          {children}
        </div>
      </main>
    </div>
  );
}

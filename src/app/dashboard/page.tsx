import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardClient } from './DashboardClient';

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  // Fetch user profile
  const { data: profile } = await supabase
    .from('users')
    .select('full_name, onboarding_completed, avatar_url')
    .eq('id', user.id)
    .single();

  // Fetch trading accounts
  const { data: accounts } = await supabase
    .from('trading_accounts')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  // Fetch open positions (top 5)
  const { data: positions } = await supabase
    .from('positions')
    .select('*')
    .eq('status', 'open')
    .in('account_id', (accounts ?? []).map((a) => a.id))
    .order('opened_at', { ascending: false })
    .limit(5);

  // Fetch recent activity (last 10 orders)
  const { data: recentOrders } = await supabase
    .from('orders')
    .select('id, symbol, direction, order_type, status, requested_size, fill_price, created_at')
    .in('account_id', (accounts ?? []).map((a) => a.id))
    .order('created_at', { ascending: false })
    .limit(10);

  // Fetch notifications
  const { data: notifications } = await supabase
    .from('notifications')
    .select('id, title, body, notification_type, is_read, created_at')
    .eq('user_id', user.id)
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(5);

  // Compute account summary from primary account
  const primaryAccount = accounts?.[0] ?? null;
  const totalFloatingPnl = (positions ?? []).reduce(
    (sum, p) => sum + (p.floating_pnl ?? 0),
    0
  );

  return (
    <DashboardClient
      hasAccounts={!!accounts && accounts.length > 0}
      onboardingCompleted={profile?.onboarding_completed ?? false}
      balance={primaryAccount?.balance ?? 0}
      equity={(primaryAccount?.balance ?? 0) + totalFloatingPnl}
      floatingPnl={totalFloatingPnl}
      freeMargin={primaryAccount?.balance ?? 0}
      positions={positions ?? []}
      recentOrders={recentOrders ?? []}
      notifications={notifications ?? []}
    />
  );
}

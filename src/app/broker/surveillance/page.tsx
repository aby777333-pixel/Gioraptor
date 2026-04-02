import { createServerSupabaseClient } from '@/lib/supabase/server';
import { SurveillanceView } from './SurveillanceView';

export const dynamic = 'force-dynamic';

export default async function SurveillancePage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('users')
    .select('broker_id')
    .eq('id', user!.id)
    .single();

  const brokerId = profile?.broker_id;
  if (!brokerId) {
    return <p className="py-20 text-center text-secondary">No broker assigned.</p>;
  }

  // Fetch active surveillance flags
  const { data: flags } = await supabase
    .from('surveillance_flags')
    .select(`
      *,
      user:users!inner(id, full_name, email, broker_id),
      account:trading_accounts(account_number)
    `)
    .eq('user.broker_id', brokerId)
    .order('created_at', { ascending: false });

  // Fetch detection rules
  const { data: rules } = await supabase
    .from('surveillance_rules')
    .select('*')
    .eq('broker_id', brokerId)
    .order('name');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Trade Surveillance</h1>
        <p className="text-xs text-secondary">
          {flags?.filter((f) => f.status === 'active').length ?? 0} active flags
        </p>
      </div>
      <SurveillanceView flags={flags ?? []} rules={rules ?? []} />
    </div>
  );
}

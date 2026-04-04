'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Building, ShieldAlert } from 'lucide-react';

export default function BrokerLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Verify this is a broker account
    if (data.user) {
      const { data: profile } = await supabase.from('users').select('role').eq('id', data.user.id).single();
      if (profile?.role !== 'broker_admin' && profile?.role !== 'gio4x_admin') {
        setError('This login is for broker administrators only. Traders should use the Trader Login.');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }
    }

    router.push('/broker/command-center');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#060D16] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <img src="/logo.png" alt="GIO4X Raptor" style={{ height: 32 }} />
          </Link>
          <div className="flex items-center justify-center gap-2 mb-3">
            <Building className="h-5 w-5 text-[#F0A500]" />
            <h1 className="text-2xl font-bold text-white">Broker Admin Portal</h1>
          </div>
          <p className="text-sm text-zinc-500">Broker administration and management access</p>
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F0A500]/10 text-[#F0A500] text-[10px] font-medium">
            <ShieldAlert className="h-3 w-3" /> B2B Access Only
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">{error}</div>
          )}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="admin@brokerage.com"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-[#F0A500] focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Enter your password"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-[#F0A500] focus:outline-none" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full rounded-lg bg-[#F0A500] py-3 text-sm font-semibold text-black transition-colors hover:bg-[#D49000] disabled:opacity-50">
            {loading ? 'Signing in...' : 'Sign In to Broker Portal'}
          </button>
        </form>

        <div className="mt-6 text-center space-y-2">
          <Link href="/auth/login" className="block text-xs text-zinc-500 hover:text-white transition-colors">
            Looking for Trader Login?
          </Link>
          <Link href="/contact?type=broker" className="block text-xs text-[#F0A500] hover:text-[#D49000] transition-colors">
            Apply for a Broker Account
          </Link>
        </div>
      </div>
    </div>
  );
}

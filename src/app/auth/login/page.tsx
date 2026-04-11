'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { TrendingUp, Building } from 'lucide-react';
import Logo from '@/components/Logo';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const redirectTo = searchParams.get('redirect');

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

    // Route based on role — traders to dashboard, brokers to command center
    if (data.user) {
      const { data: profile } = await supabase.from('users').select('role').eq('id', data.user.id).single();
      const role = profile?.role ?? 'trader';

      if (role === 'broker_admin' || role === 'gio4x_admin') {
        router.push(redirectTo ?? '/broker/command-center');
      } else {
        router.push(redirectTo ?? '/dashboard');
      }
    } else {
      router.push(redirectTo ?? '/dashboard');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#060D16] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <Logo height={32} theme="dark" />
          </Link>
          <div className="flex items-center justify-center gap-2 mb-3">
            <TrendingUp className="h-5 w-5 text-[#00B4D8]" />
            <h1 className="text-2xl font-bold text-white">Trader Login</h1>
          </div>
          <p className="text-sm text-zinc-500">Sign in to your trading account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">{error}</div>
          )}
          <div>
            <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-zinc-400">Email</label>
            <input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="trader@example.com"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition-colors focus:border-[#00B4D8]" />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-zinc-400">Password</label>
            <input id="password" type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition-colors focus:border-[#00B4D8]" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full rounded-lg bg-[#00B4D8] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#007AB8] disabled:opacity-50">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center space-y-3">
          <p className="text-sm text-zinc-500">
            Don&apos;t have an account?{' '}
            <Link href="/auth/register" className="text-[#00B4D8] hover:text-[#00B4D8]/80 transition-colors">Create one</Link>
          </p>
          <Link href="/auth/broker-login" className="flex items-center justify-center gap-2 text-xs text-[#F0A500] hover:text-[#D49000] transition-colors">
            <Building className="h-3 w-3" /> Broker Admin? Login here
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#060D16]"><div className="text-zinc-500 text-sm">Loading...</div></div>}>
      <LoginForm />
    </Suspense>
  );
}

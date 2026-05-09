'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import AuthShell from '@/components/auth/AuthShell';
import { Field, PasswordField } from '@/components/auth/Field';
import { PrimaryButton, GoogleOAuthButton } from '@/components/auth/Buttons';
import { InlineError } from '@/components/auth/InlineError';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);

  function fail(msg: string) {
    setError(msg);
    setLoading(false);
    setShake(true);
    window.setTimeout(() => setShake(false), 360);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);

    if (!agreed) {
      fail('Please accept the risk disclosure and terms to continue.');
      return;
    }
    if (password !== confirm) {
      fail('Passwords do not match.');
      return;
    }
    if (password.length < 12) {
      fail('Password must be at least 12 characters.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });

    if (signUpError) {
      fail(signUpError.message);
      return;
    }

    router.push('/auth/verify-email');
  }

  async function handleGoogle() {
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });
    if (oauthError) fail(oauthError.message);
  }

  return (
    <AuthShell>
      <div className="mb-8">
        <h1 className="text-[28px] font-light leading-tight" style={{ color: 'var(--g-text-primary)' }}>
          Open an account
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--g-text-secondary)' }}>
          Standard onboarding takes under five minutes. KYC follows on first deposit.
        </p>
      </div>

      <form onSubmit={handleSubmit} className={`space-y-5 ${shake ? 'g-shake' : ''}`} noValidate>
        <InlineError message={error} />

        <Field
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />

        <PasswordField
          label="Password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 12 characters"
          showStrength
          hint="Use a mix of letters, numbers, and symbols. 14+ characters recommended."
        />

        <PasswordField
          label="Confirm password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repeat your password"
        />

        <label className="flex items-start gap-2.5 text-[13px] leading-snug" style={{ color: 'var(--g-text-secondary)' }}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 accent-[var(--g-accent)]"
            style={{ width: 14, height: 14 }}
          />
          <span>
            I have read and accept the{' '}
            <Link href="/risk-disclosure" target="_blank" className="underline">risk disclosure</Link>,{' '}
            <Link href="/terms" target="_blank" className="underline">terms</Link>, and{' '}
            <Link href="/privacy" target="_blank" className="underline">privacy policy</Link>.
          </span>
        </label>

        <PrimaryButton loading={loading}>Create account</PrimaryButton>

        <div className="g-divider">or</div>

        <GoogleOAuthButton onClick={handleGoogle}>Sign up with Google</GoogleOAuthButton>
      </form>

      <div className="mt-8 text-[13px]" style={{ color: 'var(--g-text-secondary)' }}>
        Already have an account?{' '}
        <Link href="/auth/login" className="hover:underline" style={{ color: 'var(--g-text-primary)' }}>
          Sign in
        </Link>
      </div>
    </AuthShell>
  );
}

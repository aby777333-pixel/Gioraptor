'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Settings, User, Shield, Bell, Key, Save, Check } from 'lucide-react';
import { TabGroup } from '@/components/ui/TabGroup';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { cn } from '@/lib/utils/format';

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'security', label: 'Security' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'api', label: 'API Keys' },
];

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Los_Angeles',
  'Europe/London', 'Europe/Berlin', 'Europe/Moscow',
  'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Asia/Dubai',
  'Australia/Sydney', 'Pacific/Auckland',
];

const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Japanese', 'Chinese', 'Arabic', 'Hindi'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF'];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Profile
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [timezone, setTimezone] = useState('UTC');

  // Security
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);

  // Preferences
  const [language, setLanguage] = useState('English');
  const [currency, setCurrency] = useState('USD');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [tradeNotifications, setTradeNotifications] = useState(true);
  const [priceAlertNotifications, setPriceAlertNotifications] = useState(true);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function fetch() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        setFullName(profile.full_name ?? '');
        setPhone(profile.phone ?? '');
        setCountry(profile.country ?? '');
        setAvatarUrl(profile.avatar_url ?? '');
        setTimezone(profile.timezone ?? 'UTC');
        setLanguage(profile.language ?? 'English');
        setCurrency(profile.preferred_currency ?? 'USD');
        setTwoFaEnabled(profile.two_fa_enabled ?? false);
      }
      setLoading(false);
    }
    fetch();
  }, []);

  async function saveProfile() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('users').update({
      full_name: fullName,
      phone,
      country,
      avatar_url: avatarUrl,
      timezone,
    }).eq('id', user.id);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function savePreferences() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('users').update({
      language,
      preferred_currency: currency,
      notification_preferences: {
        email: emailNotifications,
        push: pushNotifications,
        trades: tradeNotifications,
        price_alerts: priceAlertNotifications,
      },
    }).eq('id', user.id);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function changePassword() {
    if (newPassword !== confirmPassword) return;
    setSaving(true);
    await supabase.auth.updateUser({ password: newPassword });
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <h1 className="text-lg font-bold text-foreground">Settings</h1>
        <LoadingSkeleton variant="text" count={8} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-bold text-foreground">Settings</h1>

      <TabGroup tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'profile' && (
        <div className="rounded-xl border border-border bg-elevated p-5 max-w-xl space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <User className="h-5 w-5 text-accent" />
            <h3 className="text-sm font-semibold text-foreground">Profile Information</h3>
          </div>
          <div>
            <label className="block text-xs font-medium text-secondary mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-4 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-secondary mb-1">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="w-full rounded-lg border border-border bg-surface px-4 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-secondary mb-1">Country</label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="e.g. United States"
              className="w-full rounded-lg border border-border bg-surface px-4 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-secondary mb-1">Avatar URL</label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-border bg-surface px-4 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-secondary mb-1">Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            >
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
          <button
            onClick={saveProfile}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white hover:bg-accent/80 transition-colors disabled:opacity-50"
          >
            {saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="space-y-6 max-w-xl">
          <div className="rounded-xl border border-border bg-elevated p-5 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="h-5 w-5 text-accent" />
              <h3 className="text-sm font-semibold text-foreground">Change Password</h3>
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-4 py-2 text-sm text-foreground outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-4 py-2 text-sm text-foreground outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-4 py-2 text-sm text-foreground outline-none focus:border-accent"
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-[10px] text-loss mt-1">Passwords do not match</p>
              )}
            </div>
            <button
              onClick={changePassword}
              disabled={saving || !newPassword || newPassword !== confirmPassword}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white hover:bg-accent/80 transition-colors disabled:opacity-50"
            >
              Update Password
            </button>
          </div>

          <div className="rounded-xl border border-border bg-elevated p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Two-Factor Authentication</h3>
                <p className="text-[10px] text-secondary mt-0.5">Add an extra layer of security to your account</p>
              </div>
              <button
                onClick={() => setTwoFaEnabled(!twoFaEnabled)}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  twoFaEnabled ? 'bg-accent' : 'bg-surface'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 rounded-full bg-white transition-transform',
                    twoFaEnabled ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'preferences' && (
        <div className="rounded-xl border border-border bg-elevated p-5 max-w-xl space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <Bell className="h-5 w-5 text-accent" />
            <h3 className="text-sm font-semibold text-foreground">Preferences</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-secondary mb-1">Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              >
                {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary mb-1">Display Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              >
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-semibold text-foreground">Notifications</h4>
            {[
              { label: 'Email notifications', value: emailNotifications, set: setEmailNotifications },
              { label: 'Push notifications', value: pushNotifications, set: setPushNotifications },
              { label: 'Trade execution alerts', value: tradeNotifications, set: setTradeNotifications },
              { label: 'Price alert notifications', value: priceAlertNotifications, set: setPriceAlertNotifications },
            ].map((item) => (
              <label key={item.label} className="flex items-center justify-between">
                <span className="text-xs text-secondary">{item.label}</span>
                <button
                  onClick={() => item.set(!item.value)}
                  className={cn(
                    'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                    item.value ? 'bg-accent' : 'bg-surface'
                  )}
                >
                  <span className={cn(
                    'inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform',
                    item.value ? 'translate-x-4.5' : 'translate-x-0.5'
                  )} />
                </button>
              </label>
            ))}
          </div>

          <button
            onClick={savePreferences}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white hover:bg-accent/80 transition-colors disabled:opacity-50"
          >
            {saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      )}

      {activeTab === 'api' && (
        <div className="rounded-xl border border-border bg-elevated p-5 max-w-xl">
          <div className="flex items-center gap-3 mb-4">
            <Key className="h-5 w-5 text-accent" />
            <h3 className="text-sm font-semibold text-foreground">API Keys</h3>
          </div>
          <div className="rounded-lg bg-surface/50 p-4 text-center">
            <p className="text-xs text-secondary mb-2">API access is coming soon.</p>
            <p className="text-[10px] text-muted">
              Integrate Raptor with your own trading bots and applications via REST and WebSocket APIs.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

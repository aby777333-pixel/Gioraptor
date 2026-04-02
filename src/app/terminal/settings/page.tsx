'use client';

import { useState } from 'react';
import TopBar from '@/components/layout/TopBar';
import {
  User, Shield, Bell, Palette, Globe, Key, FileText, Upload,
} from 'lucide-react';

type Tab = 'profile' | 'security' | 'notifications' | 'kyc';

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('profile');

  const tabs = [
    { id: 'profile' as Tab, label: 'Profile', icon: <User size={14} /> },
    { id: 'security' as Tab, label: 'Security', icon: <Shield size={14} /> },
    { id: 'notifications' as Tab, label: 'Notifications', icon: <Bell size={14} /> },
    { id: 'kyc' as Tab, label: 'KYC Verification', icon: <FileText size={14} /> },
  ];

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <TopBar />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6">
          <h1 className="text-xl font-bold mb-6">Settings</h1>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 border-b" style={{ borderColor: 'var(--border)' }}>
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium transition-all"
                style={{
                  color: tab === t.id ? '#0091D5' : 'var(--text-secondary)',
                  borderBottom: tab === t.id ? '2px solid #0091D5' : '2px solid transparent',
                }}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {tab === 'profile' && <ProfileTab />}
          {tab === 'security' && <SecurityTab />}
          {tab === 'notifications' && <NotificationsTab />}
          {tab === 'kyc' && <KYCTab />}
        </div>
      </div>
    </div>
  );
}

function ProfileTab() {
  return (
    <div className="space-y-4">
      <SettingCard title="Personal Information">
        <div className="grid grid-cols-2 gap-4">
          <InputField label="First Name" placeholder="John" />
          <InputField label="Last Name" placeholder="Doe" />
          <InputField label="Email" placeholder="john@example.com" type="email" />
          <InputField label="Phone" placeholder="+1 234 567 8901" />
          <InputField label="Country" placeholder="United States" />
          <InputField label="Date of Birth" placeholder="1990-01-01" type="date" />
        </div>
        <button className="mt-4 px-4 py-2 rounded-lg text-xs font-bold" style={{ backgroundColor: '#0091D5', color: '#000' }}>
          Save Changes
        </button>
      </SettingCard>
      <SettingCard title="Trading Preferences">
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Default Leverage" options={['1:50', '1:100', '1:200', '1:500']} />
          <SelectField label="Default Lot Size" options={['0.01', '0.1', '0.5', '1.0']} />
          <SelectField label="Chart Type" options={['Candlestick', 'Line', 'Bar', 'Heikin Ashi']} />
          <SelectField label="Timezone" options={['UTC', 'EST', 'GMT', 'IST', 'JST']} />
        </div>
      </SettingCard>
    </div>
  );
}

function SecurityTab() {
  return (
    <div className="space-y-4">
      <SettingCard title="Change Password">
        <div className="space-y-3 max-w-md">
          <InputField label="Current Password" type="password" placeholder="********" />
          <InputField label="New Password" type="password" placeholder="********" />
          <InputField label="Confirm Password" type="password" placeholder="********" />
        </div>
        <button className="mt-4 px-4 py-2 rounded-lg text-xs font-bold" style={{ backgroundColor: '#0091D5', color: '#000' }}>
          Update Password
        </button>
      </SettingCard>
      <SettingCard title="Two-Factor Authentication">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">2FA is not enabled</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Add an extra layer of security to your account</div>
          </div>
          <button className="px-4 py-2 rounded-lg text-xs font-bold border" style={{ borderColor: '#0091D5', color: '#0091D5' }}>
            <Key size={14} className="inline mr-1" /> Enable 2FA
          </button>
        </div>
      </SettingCard>
      <SettingCard title="Active Sessions">
        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--border)' }}>
            <div><Globe size={12} className="inline mr-2" />Chrome on Windows — Current session</div>
            <span className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: '#00C85320', color: '#00C853' }}>Active</span>
          </div>
        </div>
      </SettingCard>
    </div>
  );
}

function NotificationsTab() {
  return (
    <SettingCard title="Notification Preferences">
      <div className="space-y-4">
        {[
          { label: 'Order execution alerts', desc: 'Get notified when orders are filled' },
          { label: 'Price alerts', desc: 'Triggered price level notifications' },
          { label: 'Margin warnings', desc: 'Low margin level alerts' },
          { label: 'Daily P&L summary', desc: 'End-of-day trading summary' },
          { label: 'News & market events', desc: 'Economic calendar notifications' },
          { label: 'Copy trading updates', desc: 'When copied traders open/close positions' },
        ].map((item) => (
          <div key={item.label} className="flex items-center justify-between py-1">
            <div>
              <div className="text-sm">{item.label}</div>
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{item.desc}</div>
            </div>
            <ToggleSwitch />
          </div>
        ))}
      </div>
    </SettingCard>
  );
}

function KYCTab() {
  const [step, setStep] = useState(0);
  const steps = ['Identity Document', 'Proof of Address', 'Selfie Verification', 'Review'];

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-6">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold"
              style={{
                backgroundColor: i <= step ? '#0091D5' : 'var(--bg-elevated)',
                color: i <= step ? '#000' : 'var(--text-muted)',
              }}
            >
              {i + 1}
            </div>
            <span className="text-[11px]" style={{ color: i <= step ? 'var(--text-primary)' : 'var(--text-muted)' }}>{s}</span>
            {i < steps.length - 1 && <div className="w-8 h-px" style={{ backgroundColor: 'var(--border)' }} />}
          </div>
        ))}
      </div>

      {step === 0 && (
        <SettingCard title="Upload Identity Document">
          <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
            Upload a clear photo of your passport, national ID, or driving license.
          </p>
          <div className="border-2 border-dashed rounded-xl p-8 text-center" style={{ borderColor: 'var(--border)' }}>
            <Upload size={32} className="mx-auto mb-3 opacity-30" />
            <div className="text-sm mb-1">Drop your document here or click to upload</div>
            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>JPG, PNG, PDF — Max 5MB</div>
          </div>
          <button onClick={() => setStep(1)} className="mt-4 px-4 py-2 rounded-lg text-xs font-bold" style={{ backgroundColor: '#0091D5', color: '#000' }}>
            Continue
          </button>
        </SettingCard>
      )}

      {step === 1 && (
        <SettingCard title="Proof of Address">
          <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
            Upload a utility bill, bank statement, or government letter dated within the last 3 months.
          </p>
          <div className="border-2 border-dashed rounded-xl p-8 text-center" style={{ borderColor: 'var(--border)' }}>
            <Upload size={32} className="mx-auto mb-3 opacity-30" />
            <div className="text-sm mb-1">Drop your document here</div>
            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>JPG, PNG, PDF — Max 5MB</div>
          </div>
          <button onClick={() => setStep(2)} className="mt-4 px-4 py-2 rounded-lg text-xs font-bold" style={{ backgroundColor: '#0091D5', color: '#000' }}>
            Continue
          </button>
        </SettingCard>
      )}

      {step === 2 && (
        <SettingCard title="Selfie Verification">
          <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
            Take a selfie holding your ID document next to your face.
          </p>
          <div className="border-2 border-dashed rounded-xl p-8 text-center" style={{ borderColor: 'var(--border)' }}>
            <Upload size={32} className="mx-auto mb-3 opacity-30" />
            <div className="text-sm mb-1">Upload selfie with ID</div>
          </div>
          <button onClick={() => setStep(3)} className="mt-4 px-4 py-2 rounded-lg text-xs font-bold" style={{ backgroundColor: '#0091D5', color: '#000' }}>
            Submit for Review
          </button>
        </SettingCard>
      )}

      {step === 3 && (
        <SettingCard title="Verification Under Review">
          <div className="text-center py-8">
            <Shield size={40} className="mx-auto mb-4" style={{ color: '#F0A500' }} />
            <div className="text-lg font-bold mb-2">Documents Submitted</div>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Your KYC documents are being reviewed. This usually takes 1-2 business days.
            </div>
          </div>
        </SettingCard>
      )}
    </div>
  );
}

function SettingCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-5" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
      <h3 className="text-sm font-bold mb-4">{title}</h3>
      {children}
    </div>
  );
}

function InputField({ label, type = 'text', placeholder }: { label: string; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg text-xs outline-none border transition-colors focus:border-[#0091D5]"
        style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
      />
    </div>
  );
}

function SelectField({ label, options }: { label: string; options: string[] }) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{label}</label>
      <select
        className="w-full px-3 py-2 rounded-lg text-xs outline-none border transition-colors focus:border-[#0091D5]"
        style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
      >
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
}

function ToggleSwitch() {
  const [on, setOn] = useState(true);
  return (
    <button
      onClick={() => setOn(!on)}
      className="w-10 h-5 rounded-full transition-all relative"
      style={{ backgroundColor: on ? '#0091D5' : 'var(--bg-elevated)' }}
    >
      <div
        className="w-4 h-4 rounded-full absolute top-0.5 transition-all"
        style={{
          left: on ? 22 : 2,
          backgroundColor: on ? '#000' : 'var(--text-muted)',
        }}
      />
    </button>
  );
}

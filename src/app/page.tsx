import Link from 'next/link';

const features = [
  {
    title: 'Ultra-Low Latency Execution',
    description: 'Sub-millisecond order routing with institutional-grade infrastructure across global data centers.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    stat: '<1ms',
  },
  {
    title: 'Multi-Asset Trading',
    description: 'Forex, metals, indices, crypto, equities, and commodities from a single unified terminal.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    stat: '500+',
  },
  {
    title: 'AI-Powered Analytics',
    description: 'Machine learning for market prediction, sentiment analysis, pattern recognition, and risk scoring.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
      </svg>
    ),
    stat: 'AI',
  },
  {
    title: 'Copy Trading & PAMM',
    description: 'Follow top strategies with automated mirroring, or manage investor funds with professional allocation tools.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    stat: 'Social',
  },
  {
    title: 'White Label Platform',
    description: 'Launch your own branded brokerage with full customization, API access, and multi-tenant isolation.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
      </svg>
    ),
    stat: 'B2B',
  },
  {
    title: 'Prop Trading Module',
    description: 'Run funded account challenges with automated rule enforcement, scaling plans, and payout management.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.023 6.023 0 01-7.54 0" />
      </svg>
    ),
    stat: 'Funded',
  },
];

const stats = [
  { value: '500+', label: 'Instruments' },
  { value: '<1ms', label: 'Execution' },
  { value: '24/5', label: 'Markets' },
  { value: '99.99%', label: 'Uptime' },
];

const modules = [
  'Trading Engine', 'CRM System', 'IB Management', 'Dealing Desk',
  'PAMM / MAM', 'Liquidity Layer', 'White Label', 'Payment System',
  'Compliance Engine', 'AI Analytics', 'Prop Trading', 'Developer API',
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#060D16] text-[#EAF0FA] overflow-y-auto overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06] bg-[#060D16]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="GIO4X Raptor" style={{ height: 36 }} />
            <span className="text-sm font-semibold tracking-wide text-[#7A8BA8]">RAPTOR</span>
          </div>
          <div className="hidden sm:flex items-center gap-8 text-sm text-[#7A8BA8]">
            <a href="#features" className="transition-colors hover:text-white">Platform</a>
            <a href="#modules" className="transition-colors hover:text-white">Modules</a>
            <a href="#technology" className="transition-colors hover:text-white">Technology</a>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="text-sm text-[#7A8BA8] transition-colors hover:text-white"
            >
              Sign In
            </Link>
            <Link
              href="/auth/register"
              className="rounded-lg bg-[#0091D5] px-5 py-2 text-sm font-semibold transition-all hover:bg-[#007AB8] hover:shadow-lg hover:shadow-[#0091D5]/20"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-16">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,145,213,0.08)_0%,_transparent_60%)]" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#0091D5]/[0.04] blur-[120px] rounded-full" />

        <div className="relative z-10 mx-auto max-w-5xl text-center">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#0091D5]/20 bg-[#0091D5]/[0.06] px-5 py-2 text-sm text-[#0091D5]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0091D5] animate-pulse" />
            Raptor Trading System v2.0
          </div>
          <h1 className="mb-6 text-5xl font-bold tracking-tight leading-[1.1] sm:text-7xl lg:text-8xl">
            The Operating System
            <br />
            <span className="bg-gradient-to-r from-[#0082C8] via-[#00A5A8] to-[#009B4D] bg-clip-text text-transparent">
              for Modern Brokerages
            </span>
          </h1>
          <p className="mx-auto mb-12 max-w-3xl text-lg text-[#7A8BA8] sm:text-xl leading-relaxed">
            Institutional-grade execution engine, multi-asset trading, CRM, compliance, white-label infrastructure, and AI analytics — unified in one platform by GIO4X.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/auth/register"
              className="group flex h-14 w-full items-center justify-center gap-2.5 rounded-xl bg-[#0091D5] px-10 text-base font-semibold transition-all hover:bg-[#007AB8] hover:shadow-xl hover:shadow-[#0091D5]/25 sm:w-auto"
            >
              Start Trading
              <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <Link
              href="/terminal"
              className="flex h-14 w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-10 text-base font-medium text-[#7A8BA8] transition-all hover:border-white/20 hover:bg-white/[0.03] hover:text-white sm:w-auto"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
              </svg>
              Live Demo
            </Link>
          </div>
        </div>

        {/* Stats bar */}
        <div className="relative z-10 mt-20 w-full max-w-4xl">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col items-center gap-1 py-6 px-4">
                <span className="text-2xl sm:text-3xl font-bold text-white">{s.value}</span>
                <span className="text-xs text-[#7A8BA8] uppercase tracking-wider">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce">
          <svg className="w-5 h-5 text-[#4A5568]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
          </svg>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="relative px-6 py-32">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <span className="mb-4 inline-block text-xs font-semibold uppercase tracking-[0.2em] text-[#0091D5]">
              Core Capabilities
            </span>
            <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-5xl">
              Built for Institutional Performance
            </h2>
            <p className="mx-auto max-w-2xl text-[#7A8BA8] text-lg">
              Every component engineered for speed, reliability, and regulatory compliance at scale.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group relative rounded-2xl border border-white/[0.06] bg-[#0B1422]/60 p-8 transition-all duration-300 hover:border-[#0091D5]/20 hover:bg-[#0B1422]/80 backdrop-blur-sm"
              >
                <div className="absolute top-8 right-8 text-xs font-bold text-[#F0A500]/60 mono">
                  {feature.stat}
                </div>
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#0091D5]/10 text-[#0091D5] transition-colors group-hover:bg-[#0091D5]/15">
                  {feature.icon}
                </div>
                <h3 className="mb-2.5 text-lg font-semibold">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-[#7A8BA8]">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modules Section */}
      <section id="modules" className="relative px-6 py-32 border-t border-white/[0.04]">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <span className="mb-4 inline-block text-xs font-semibold uppercase tracking-[0.2em] text-[#009B4D]">
              Complete Ecosystem
            </span>
            <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-5xl">
              18 Integrated Modules
            </h2>
            <p className="mx-auto max-w-2xl text-[#7A8BA8] text-lg">
              From client onboarding to trade execution to regulatory reporting — a single platform for the entire brokerage lifecycle.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {modules.map((m) => (
              <div
                key={m}
                className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#0B1422]/40 px-5 py-4 text-sm font-medium text-[#7A8BA8] transition-all hover:border-[#0091D5]/15 hover:text-white hover:bg-[#0B1422]/60"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[#009B4D]/60" />
                {m}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Technology Section */}
      <section id="technology" className="relative px-6 py-32 border-t border-white/[0.04]">
        <div className="mx-auto max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="mb-4 inline-block text-xs font-semibold uppercase tracking-[0.2em] text-[#00A5A8]">
                Technology Stack
              </span>
              <h2 className="mb-6 text-3xl font-bold tracking-tight sm:text-4xl">
                Enterprise Architecture
              </h2>
              <p className="mb-8 text-[#7A8BA8] text-lg leading-relaxed">
                Built on PostgreSQL, Redis, and Kafka for reliability. TypeScript end-to-end for consistency. Deployed on containerized infrastructure with 99.99% uptime SLA.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Frontend', tech: 'Next.js + React' },
                  { label: 'Database', tech: 'PostgreSQL + Redis' },
                  { label: 'Real-time', tech: 'WebSocket + SSE' },
                  { label: 'Auth', tech: 'Supabase + JWT' },
                  { label: 'Charts', tech: 'TradingView LW' },
                  { label: 'Security', tech: 'AES-256 + TLS 1.3' },
                ].map((t) => (
                  <div key={t.label} className="rounded-lg border border-white/[0.06] bg-[#0B1422]/40 px-4 py-3">
                    <div className="text-[10px] uppercase tracking-wider text-[#4A5568] mb-0.5">{t.label}</div>
                    <div className="text-sm font-medium mono">{t.tech}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="rounded-2xl border border-white/[0.06] bg-[#0B1422]/60 p-8 backdrop-blur-sm">
                <div className="mb-6 flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-[#FF4560]" />
                  <span className="h-3 w-3 rounded-full bg-[#F0A500]" />
                  <span className="h-3 w-3 rounded-full bg-[#00C896]" />
                </div>
                <pre className="mono text-xs leading-6 text-[#7A8BA8] overflow-x-auto">
{`{
  "platform": "Raptor Trading System",
  "version": "2.0.0",
  "provider": "GIO4X",
  "modules": 18,
  "instruments": "500+",
  "execution": "<1ms",
  "compliance": [
    "FCA", "CySEC", "ASIC",
    "FSA", "FSCA"
  ],
  "features": {
    "white_label": true,
    "prop_trading": true,
    "copy_trading": true,
    "ai_analytics": true,
    "api_access": true
  }
}`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative px-6 py-32 border-t border-white/[0.04]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(0,155,77,0.06)_0%,_transparent_60%)]" />
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <h2 className="mb-6 text-3xl font-bold tracking-tight sm:text-5xl">
            Ready to Launch Your
            <br />
            <span className="bg-gradient-to-r from-[#0082C8] to-[#009B4D] bg-clip-text text-transparent">Trading Infrastructure?</span>
          </h2>
          <p className="mb-10 text-[#7A8BA8] text-lg">
            Whether you&apos;re a trader, fund manager, or broker — Raptor scales with you.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/auth/register"
              className="flex h-14 w-full items-center justify-center rounded-xl bg-[#0091D5] px-10 text-base font-semibold transition-all hover:bg-[#007AB8] hover:shadow-xl hover:shadow-[#0091D5]/25 sm:w-auto"
            >
              Create Free Account
            </Link>
            <Link
              href="/terminal"
              className="flex h-14 w-full items-center justify-center rounded-xl border border-white/10 px-10 text-base font-medium text-[#7A8BA8] transition-all hover:border-white/20 hover:bg-white/[0.03] hover:text-white sm:w-auto"
            >
              Explore Terminal
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] px-6 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="GIO4X" style={{ height: 24 }} />
            <span className="text-sm font-semibold text-[#4A5568]">RAPTOR TRADING SYSTEM</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-[#4A5568]">
            <span>Enterprise Infrastructure</span>
            <span className="h-1 w-1 rounded-full bg-[#4A5568]" />
            <span>Multi-Jurisdiction Compliance</span>
            <span className="h-1 w-1 rounded-full bg-[#4A5568]" />
            <span>White-Label Ready</span>
          </div>
          <p className="text-xs text-[#4A5568]">
            &copy; {new Date().getFullYear()} GIO4X. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

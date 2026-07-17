import { Bell, Wifi, WifiOff, Power, ArrowLeft } from 'lucide-react';
import { useStore } from '../store';
import type { TradingMode } from '../types';

const MODES: { key: TradingMode; label: string }[] = [
  { key: 'demo', label: 'Demo' },
  { key: 'paper', label: 'Paper' },
  { key: 'live', label: 'Live' },
];

export function TopBar() {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const connected = useStore((s) => s.connected);
  const setKillModal = useStore((s) => s.setKillModal);
  const toasts = useStore((s) => s.toasts);
  const pushToast = useStore((s) => s.pushToast);

  return (
    <header className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-border bg-card/60 backdrop-blur-md z-30">
      <div className="flex items-center gap-3">
        <a
          href="/terminal"
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold text-subtext hover:text-text border border-border hover:border-primary/40 transition-all"
          title="Back to GIO Raptor terminal"
        >
          <ArrowLeft size={14} /> Terminal
        </a>
        <span className="text-lg lg:text-xl font-extrabold tracking-tight whitespace-nowrap">
          <span className="text-primary drop-shadow-[0_0_8px_rgba(0,212,255,0.7)]">⚡</span> GIO RAPTOR{' '}
          <span className="text-primary">AI Strategy Lab</span>
        </span>
        <span
          className="hidden md:inline-flex badge bg-warning/15 text-warning border border-warning/30"
          title="This lab runs in a simulated demo environment. No live orders are placed."
        >
          DEMO · SIMULATED
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Mode selector */}
        <div className="flex items-center rounded-lg border border-border overflow-hidden bg-bg">
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`px-3 py-1.5 text-xs font-semibold transition-all ${
                mode === m.key
                  ? m.key === 'live'
                    ? 'bg-danger/20 text-danger'
                    : m.key === 'paper'
                      ? 'bg-warning/20 text-warning'
                      : 'bg-primary/20 text-primary'
                  : 'text-subtext hover:text-text'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Connection status */}
        <div
          className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border ${
            connected
              ? 'text-success border-success/40 bg-success/10'
              : 'text-danger border-danger/40 bg-danger/10'
          }`}
          title={connected ? 'WebSocket connected' : 'Reconnecting…'}
        >
          {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
          {connected ? 'Live' : 'Offline'}
        </div>

        {/* Notifications */}
        <button
          className="relative text-subtext hover:text-text transition-colors"
          title="Notifications"
          onClick={() =>
            pushToast({
              type: 'info',
              message: toasts.length
                ? `You have ${toasts.length} active notification${toasts.length > 1 ? 's' : ''}.`
                : 'No new notifications.',
            })
          }
        >
          <Bell size={18} />
          {toasts.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-bg text-[10px] font-bold flex items-center justify-center">
              {toasts.length}
            </span>
          )}
        </button>

        {/* Kill switch — always visible */}
        <button
          onClick={() => setKillModal(true)}
          className="btn-danger !py-1.5 animate-pulseGlow"
          style={{ animationDuration: '2.4s' }}
          title="Emergency stop — close all positions"
        >
          <Power size={15} /> Kill
        </button>
      </div>
    </header>
  );
}

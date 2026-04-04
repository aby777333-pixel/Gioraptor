'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { NexusOrb } from '@/components/nexus/NexusOrb';
import type { NexusSentiment } from '@/types/nexus';

interface NexusMessage {
  id: string;
  text: string;
  sentiment: NexusSentiment;
  timestamp: string;
  isDismissed: boolean;
}

/**
 * Pages where NEXUS orb should NOT appear
 * (public marketing pages, auth pages)
 */
const EXCLUDED_PATHS = [
  '/',
  '/auth/login',
  '/auth/register',
  '/auth/callback',
  '/pricing',
  '/about',
  '/contact',
  '/blog',
  '/changelog',
  '/privacy',
  '/terms',
  '/risk-disclosure',
  '/partners',
  '/developer',
  '/onboarding',
  '/sandbox',
  '/status',
];

/**
 * Context-aware welcome messages based on current page
 */
function getContextMessage(pathname: string): NexusMessage | null {
  const now = new Date().toISOString();

  if (pathname.startsWith('/dashboard/positions') || pathname.startsWith('/dashboard/terminal')) {
    return { id: 'ctx-positions', text: 'I\'m monitoring your open positions. I\'ll alert you if anything needs attention.', sentiment: 'informational', timestamp: now, isDismissed: false };
  }
  if (pathname.startsWith('/dashboard/nexus') || pathname.startsWith('/dashboard/ai-copilot')) {
    return null; // Already on NEXUS page, don't show orb message
  }
  if (pathname.startsWith('/converter')) {
    return { id: 'ctx-converter', text: 'Upload your MQL5 files and I\'ll help analyze the conversion results and flag any risk concerns.', sentiment: 'informational', timestamp: now, isDismissed: false };
  }
  if (pathname.startsWith('/dashboard/prop-challenge')) {
    return { id: 'ctx-prop', text: 'I\'m tracking your challenge progress. Stay disciplined — I\'ll warn you if you approach any limits.', sentiment: 'supportive', timestamp: now, isDismissed: false };
  }
  if (pathname.startsWith('/marketplace')) {
    return { id: 'ctx-marketplace', text: 'I can review any script\'s risk profile before you install it. Just ask.', sentiment: 'informational', timestamp: now, isDismissed: false };
  }
  if (pathname.startsWith('/broker/dealing-desk')) {
    return { id: 'ctx-desk', text: 'I\'m monitoring order flow and exposure. I\'ll flag any routing recommendations or risk concerns.', sentiment: 'informational', timestamp: now, isDismissed: false };
  }
  if (pathname.startsWith('/broker/command-center')) {
    return { id: 'ctx-command', text: 'Good to see you. I\'ve prepared your daily briefing — ask me what needs attention today.', sentiment: 'informational', timestamp: now, isDismissed: false };
  }

  return null;
}

export function NexusGlobal() {
  const pathname = usePathname();
  const [messages, setMessages] = useState<NexusMessage[]>([]);
  const [isSnoozed, setIsSnoozed] = useState(false);
  const [snoozeUntil, setSnoozeUntil] = useState<number | null>(null);

  // Check if we should show on this page
  const isExcluded = EXCLUDED_PATHS.includes(pathname) ||
    pathname.startsWith('/features/');

  // Generate context message when page changes
  useEffect(() => {
    if (isExcluded) return;

    const ctxMsg = getContextMessage(pathname);
    if (ctxMsg) {
      // Only add if not already showing this context message
      setMessages(prev => {
        if (prev.some(m => m.id === ctxMsg.id && !m.isDismissed)) return prev;
        return [ctxMsg, ...prev.filter(m => m.id !== ctxMsg.id)];
      });
    }
  }, [pathname, isExcluded]);

  // Handle snooze timer
  useEffect(() => {
    if (snoozeUntil && Date.now() < snoozeUntil) {
      setIsSnoozed(true);
      const timer = setTimeout(() => {
        setIsSnoozed(false);
        setSnoozeUntil(null);
      }, snoozeUntil - Date.now());
      return () => clearTimeout(timer);
    }
  }, [snoozeUntil]);

  if (isExcluded) return null;

  const handleSnooze = (minutes: number) => {
    setSnoozeUntil(Date.now() + minutes * 60 * 1000);
    setIsSnoozed(true);
  };

  const handleDismiss = (id: string) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, isDismissed: true } : m));
  };

  const handleOpen = () => {
    // Navigate to NEXUS page
    if (pathname.startsWith('/broker/')) {
      window.location.href = '/broker/ai-guardian';
    } else {
      window.location.href = '/dashboard/nexus';
    }
  };

  return (
    <NexusOrb
      messages={messages}
      isSnoozed={isSnoozed}
      onSnooze={handleSnooze}
      onDismissMessage={handleDismiss}
      onOpen={handleOpen}
    />
  );
}

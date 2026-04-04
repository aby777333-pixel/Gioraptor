'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { NexusOrb } from '@/components/nexus/NexusOrb';
import {
  Brain, Send, X, Sparkles, Target, Shield, BarChart3,
  TrendingUp, Heart, Clock, Lightbulb, User,
} from 'lucide-react';
import type { NexusSentiment } from '@/types/nexus';

interface NexusMessage {
  id: string;
  text: string;
  sentiment: NexusSentiment;
  timestamp: string;
  isDismissed: boolean;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'nexus';
  text: string;
  timestamp: string;
}

const EXCLUDED_PATHS = [
  '/', '/auth/login', '/auth/register', '/auth/callback',
  '/pricing', '/about', '/contact', '/blog', '/changelog',
  '/privacy', '/terms', '/risk-disclosure', '/partners',
  '/developer', '/onboarding', '/sandbox', '/status',
];

const QUICK_ACTIONS = [
  { label: 'Trade Ideas', prompt: 'Give me 3 trade setups right now', icon: <Lightbulb className="h-3 w-3" /> },
  { label: 'Analyze Position', prompt: 'Analyze my open positions and risk', icon: <Shield className="h-3 w-3" /> },
  { label: 'SL/TP Suggestion', prompt: 'Where should my stop loss and take profit be?', icon: <Target className="h-3 w-3" /> },
  { label: 'Market Briefing', prompt: 'Give me a quick market briefing for today', icon: <BarChart3 className="h-3 w-3" /> },
  { label: 'Review Last Trade', prompt: 'Let\'s debrief my last closed trade', icon: <Clock className="h-3 w-3" /> },
  { label: 'Pre-trade Check', prompt: 'Run pre-trade checklist for my current setup', icon: <TrendingUp className="h-3 w-3" /> },
];

function getContextMessage(pathname: string): NexusMessage | null {
  const now = new Date().toISOString();
  if (pathname.startsWith('/dashboard/positions') || pathname.startsWith('/dashboard/terminal'))
    return { id: 'ctx-pos', text: 'I\'m monitoring your open positions. I\'ll alert you if anything needs attention.', sentiment: 'informational', timestamp: now, isDismissed: false };
  if (pathname.startsWith('/dashboard/nexus') || pathname.startsWith('/dashboard/ai-copilot'))
    return null;
  if (pathname.startsWith('/converter'))
    return { id: 'ctx-conv', text: 'Upload your MQL5 files and I\'ll help analyze the conversion results and flag any risk concerns.', sentiment: 'informational', timestamp: now, isDismissed: false };
  if (pathname.startsWith('/dashboard/prop-challenge'))
    return { id: 'ctx-prop', text: 'I\'m tracking your challenge progress. Stay disciplined — I\'ll warn you if you approach any limits.', sentiment: 'supportive', timestamp: now, isDismissed: false };
  if (pathname.startsWith('/marketplace'))
    return { id: 'ctx-mkt', text: 'I can review any script\'s risk profile before you install it. Just ask.', sentiment: 'informational', timestamp: now, isDismissed: false };
  if (pathname.startsWith('/broker/dealing-desk'))
    return { id: 'ctx-desk', text: 'I\'m monitoring order flow and exposure. I\'ll flag any routing recommendations or risk concerns.', sentiment: 'informational', timestamp: now, isDismissed: false };
  if (pathname.startsWith('/broker/command-center'))
    return { id: 'ctx-cmd', text: 'Good to see you. I\'ve prepared your daily briefing — ask me what needs attention today.', sentiment: 'informational', timestamp: now, isDismissed: false };
  return null;
}

// Mock NEXUS responses based on keywords
function generateResponse(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes('trade idea') || lower.includes('setup'))
    return 'Based on current market conditions, I see 3 potential setups:\n\n1. **EURUSD H4** — Bullish flag breakout forming. Entry near 1.0855, SL 1.0820, TP 1.0920. Confidence: 76%.\n\n2. **XAUUSD H1** — RSI oversold bounce at support 2340. Watch for confirmation candle.\n\n3. **GBPJPY D1** — Head & shoulders neckline test. Bearish bias if closes below 192.50.\n\n⚠️ These are AI-generated ideas, not financial advice.';
  if (lower.includes('position') || lower.includes('analyze'))
    return 'Looking at your open positions:\n\n• Your EURUSD long is currently +$342 — approaching first TP target. Consider a partial close to lock in profit.\n\n• No stop loss detected on your GBPUSD position — I recommend adding one below the nearest structure at 1.2615.\n\n• Overall margin usage: 34%. You have room for 1-2 more trades at your normal size.';
  if (lower.includes('stop loss') || lower.includes('sl') || lower.includes('tp'))
    return 'Based on ATR(14) and nearest structure:\n\n• **Stop Loss:** 45 pips below entry (below the H4 support zone)\n• **Take Profit 1:** 67 pips (next resistance, R:R = 1.5:1)\n• **Take Profit 2:** 112 pips (weekly R1, R:R = 2.5:1)\n\nYour historical win rate with similar R:R setups is 64%.';
  if (lower.includes('market') || lower.includes('briefing'))
    return 'Good morning! Here\'s your market brief:\n\n• **USD** weakening across the board (-0.3% DXY)\n• **Gold** testing 2365 resistance — breakout watch\n• **Key event:** ECB rate decision at 13:45 GMT\n• **Your portfolio:** +2.1% today, 3 open positions\n\nVolatility expected to spike around the ECB announcement. Consider tightening stops on EUR pairs.';
  if (lower.includes('debrief') || lower.includes('review') || lower.includes('last trade'))
    return 'Let\'s review your last trade:\n\n**EURUSD Long** — Closed +$187 (+1.2%)\n\n✅ Good: Entry was on a confirmed H4 flag breakout\n✅ Good: Position size was appropriate (1.5% risk)\n⚠️ Note: You closed 22 pips before TP was hit. Your data shows you close winners early 40% of the time.\n\n**Suggestion:** Try using a trailing stop next time to let winners run while protecting profit.';
  if (lower.includes('pre-trade') || lower.includes('checklist'))
    return 'Pre-trade checklist:\n\n✅ Trend: Aligned with H4 and D1 uptrend\n✅ RSI: 55 — room to move, not overbought\n✅ Volume: Increasing on recent up-candles\n⚠️ News: NFP in 47 minutes — consider waiting\n⚠️ Existing: You have 2 EUR longs already\n\n**Verdict: CONSIDER WAITING** — setup is valid but NFP timing adds risk. Re-evaluate after the release.';
  return `I understand your question about "${input.slice(0, 50)}". Let me analyze the current market context and your account state...\n\nBased on available data, I\'d suggest reviewing the current trend on the H4 timeframe and checking RSI for any divergence signals. Would you like me to dig deeper into any specific aspect?\n\n⚠️ This is AI analysis, not financial advice.`;
}

export function NexusGlobal() {
  const pathname = usePathname();
  const [messages, setMessages] = useState<NexusMessage[]>([]);
  const [isSnoozed, setIsSnoozed] = useState(false);
  const [snoozeUntil, setSnoozeUntil] = useState<number | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isExcluded = EXCLUDED_PATHS.includes(pathname) || pathname.startsWith('/features/');

  useEffect(() => {
    if (isExcluded) return;
    const ctxMsg = getContextMessage(pathname);
    if (ctxMsg) {
      setMessages(prev => {
        if (prev.some(m => m.id === ctxMsg.id && !m.isDismissed)) return prev;
        return [ctxMsg, ...prev.filter(m => m.id !== ctxMsg.id)];
      });
    }
  }, [pathname, isExcluded]);

  useEffect(() => {
    if (snoozeUntil && Date.now() < snoozeUntil) {
      setIsSnoozed(true);
      const timer = setTimeout(() => { setIsSnoozed(false); setSnoozeUntil(null); }, snoozeUntil - Date.now());
      return () => clearTimeout(timer);
    }
  }, [snoozeUntil]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [chatMessages.length, isTyping]);

  if (isExcluded) return null;

  const handleSnooze = (minutes: number) => { setSnoozeUntil(Date.now() + minutes * 60 * 1000); setIsSnoozed(true); };
  const handleDismiss = (id: string) => { setMessages(prev => prev.map(m => m.id === id ? { ...m, isDismissed: true } : m)); };

  const handleOpen = () => {
    setIsPanelOpen(true);
    if (chatMessages.length === 0) {
      setChatMessages([{
        id: 'welcome',
        role: 'nexus',
        text: 'Hey! I\'m NEXUS, your AI trading companion. I can analyze setups, review positions, coach your psychology, or just chat about markets. What would you like to explore?',
        timestamp: new Date().toISOString(),
      }]);
    }
  };

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', text: text.trim(), timestamp: new Date().toISOString() };
    setChatMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const response = generateResponse(text);
      setChatMessages(prev => [...prev, { id: `n-${Date.now()}`, role: 'nexus', text: response, timestamp: new Date().toISOString() }]);
      setIsTyping(false);
    }, 1200 + Math.random() * 800);
  };

  return (
    <>
      {/* NEXUS Orb */}
      <NexusOrb
        messages={messages}
        isSnoozed={isSnoozed}
        onSnooze={handleSnooze}
        onDismissMessage={handleDismiss}
        onOpen={handleOpen}
      />

      {/* NEXUS Slide-Out Chat Panel — opens on current page */}
      <AnimatePresence>
        {isPanelOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPanelOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
            />

            {/* Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-[#0a0c10] border-l border-white/[0.06] z-[61] flex flex-col shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] bg-gradient-to-r from-[#8b5cf6]/5 to-[#00b4ff]/5">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#00b4ff] flex items-center justify-center">
                      <Brain className="h-5 w-5 text-white" />
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#00dc82] border-2 border-[#0a0c10]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">NEXUS</h3>
                    <p className="text-[9px] text-white/25">AI Trading Companion — always here for you</p>
                  </div>
                </div>
                <button onClick={() => setIsPanelOpen(false)} className="p-2 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Chat Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4 scrollbar-thin">
                {chatMessages.map(msg => (
                  <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                    {msg.role === 'nexus' && (
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#8b5cf6]/30 to-[#00b4ff]/30 flex items-center justify-center shrink-0 mt-0.5">
                        <Brain className="h-3.5 w-3.5 text-[#8b5cf6]" />
                      </div>
                    )}
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-[12px] leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-[#00b4ff]/10 text-white/80 border border-[#00b4ff]/20 rounded-tr-sm'
                        : 'bg-white/[0.03] text-white/60 border border-white/[0.06] rounded-tl-sm'
                    }`}>
                      {msg.text}
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
                        <User className="h-3.5 w-3.5 text-white/30" />
                      </div>
                    )}
                  </div>
                ))}

                {isTyping && (
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#8b5cf6]/30 to-[#00b4ff]/30 flex items-center justify-center">
                      <Brain className="h-3.5 w-3.5 text-[#8b5cf6] animate-pulse" />
                    </div>
                    <div className="flex gap-1 px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/20 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="px-4 py-2 border-t border-white/[0.04]">
                <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
                  {QUICK_ACTIONS.map(qa => (
                    <button
                      key={qa.label}
                      onClick={() => handleSend(qa.prompt)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] text-[10px] text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors whitespace-nowrap shrink-0"
                    >
                      {qa.icon}
                      {qa.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input */}
              <div className="px-4 py-3 border-t border-white/[0.06] bg-white/[0.02]">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSend(input)}
                    placeholder="Ask NEXUS anything..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/15 focus:border-[#8b5cf6] focus:outline-none"
                  />
                  <button
                    onClick={() => handleSend(input)}
                    disabled={!input.trim() || isTyping}
                    className="p-2.5 rounded-xl bg-gradient-to-r from-[#8b5cf6] to-[#00b4ff] text-white transition-opacity disabled:opacity-30"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-[8px] text-white/10 text-center mt-2">
                  NEXUS provides AI analysis, not financial advice. Trading involves risk.
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

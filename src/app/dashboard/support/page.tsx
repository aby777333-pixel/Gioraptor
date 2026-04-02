'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { HeadphonesIcon, Plus, ArrowLeft, Send } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { cn } from '@/lib/utils/format';

const CATEGORIES = ['General', 'Deposits & Withdrawals', 'Trading', 'Account Verification', 'Technical Issue', 'Other'];
const PRIORITIES = ['low', 'medium', 'high'];

export default function SupportPage() {
  const [tickets, setTickets] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [selectedTicket, setSelectedTicket] = useState<Record<string, unknown> | null>(null);
  const [messages, setMessages] = useState<Record<string, unknown>[]>([]);

  // Form state
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('General');
  const [priority, setPriority] = useState('medium');
  const [message, setMessage] = useState('');
  const [replyText, setReplyText] = useState('');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => { fetchTickets(); }, []);

  async function fetchTickets() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    setTickets(data ?? []);
    setLoading(false);
  }

  async function createTicket() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !subject || !message) return;

    const { data: ticket } = await supabase
      .from('support_tickets')
      .insert({
        user_id: user.id,
        subject,
        category,
        priority,
        status: 'open',
      })
      .select()
      .single();

    if (ticket) {
      await supabase.from('support_messages').insert({
        ticket_id: ticket.id,
        sender_id: user.id,
        sender_type: 'user',
        message,
      });
    }

    setSubject('');
    setMessage('');
    setView('list');
    fetchTickets();
  }

  async function openTicket(ticket: Record<string, unknown>) {
    setSelectedTicket(ticket);
    const { data } = await supabase
      .from('support_messages')
      .select('*')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: true });

    setMessages(data ?? []);
    setView('detail');
  }

  async function sendReply() {
    if (!replyText || !selectedTicket) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('support_messages').insert({
      ticket_id: selectedTicket.id,
      sender_id: user.id,
      sender_type: 'user',
      message: replyText,
    });

    setReplyText('');
    openTicket(selectedTicket);
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <h1 className="text-lg font-bold text-foreground">Support</h1>
        <LoadingSkeleton variant="table" count={5} />
      </div>
    );
  }

  if (view === 'create') {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('list')} className="text-secondary hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-lg font-bold text-foreground">New Support Ticket</h1>
        </div>

        <div className="rounded-xl border border-border bg-elevated p-5 max-w-xl space-y-4">
          <div>
            <label className="block text-xs font-medium text-secondary mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief description of your issue..."
              className="w-full rounded-lg border border-border bg-surface px-4 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-secondary mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent capitalize"
              >
                {PRIORITIES.map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-secondary mb-1">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="Describe your issue in detail..."
              className="w-full rounded-lg border border-border bg-surface px-4 py-2 text-sm text-foreground outline-none focus:border-accent resize-none"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={createTicket}
              className="rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white hover:bg-accent/80 transition-colors"
            >
              Submit Ticket
            </button>
            <button
              onClick={() => setView('list')}
              className="rounded-lg border border-border px-4 py-2 text-xs text-secondary hover:bg-surface transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'detail' && selectedTicket) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('list')} className="text-secondary hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-sm font-bold text-foreground">{selectedTicket.subject as string}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusBadge status={selectedTicket.status as string} />
              <span className="text-[10px] text-muted capitalize">{selectedTicket.priority as string} priority</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-elevated p-4 space-y-3 max-h-96 overflow-y-auto">
          {messages.map((msg) => {
            const isUser = (msg.sender_type as string) === 'user';
            return (
              <div
                key={msg.id as string}
                className={cn(
                  'rounded-lg px-4 py-3 max-w-[80%]',
                  isUser ? 'ml-auto bg-accent/10' : 'bg-surface/50'
                )}
              >
                <p className="text-xs text-foreground">{msg.message as string}</p>
                <p className="text-[10px] text-muted mt-1">
                  {isUser ? 'You' : 'Support'} &middot;{' '}
                  {new Date(msg.created_at as string).toLocaleString(undefined, {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Type your reply..."
            onKeyDown={(e) => e.key === 'Enter' && sendReply()}
            className="flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground outline-none focus:border-accent"
          />
          <button
            onClick={sendReply}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-white hover:bg-accent/80 transition-colors shrink-0"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // Ticket list view
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">Support</h1>
        <button
          onClick={() => setView('create')}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white hover:bg-accent/80 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New Ticket
        </button>
      </div>

      {tickets.length === 0 ? (
        <EmptyState
          icon={HeadphonesIcon}
          title="No support tickets"
          description="Need help? Create a ticket and our team will assist you."
          actionLabel="Create Ticket"
          onAction={() => setView('create')}
        />
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => (
            <button
              key={t.id as string}
              onClick={() => openTicket(t)}
              className="w-full rounded-xl border border-border bg-elevated px-4 py-3 flex items-center justify-between hover:border-accent/30 transition-colors text-left"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{t.subject as string}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-muted">{t.category as string}</span>
                  <span className="text-[10px] text-muted">
                    {new Date(t.updated_at as string).toLocaleDateString(undefined, {
                      month: 'short', day: 'numeric',
                    })}
                  </span>
                </div>
              </div>
              <StatusBadge status={t.status as string} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

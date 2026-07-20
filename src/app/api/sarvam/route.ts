// ═══════════════════════════════════════════════════════════════
// Sarvam language-services proxy — server-side only.
// The API key lives in the SARVAM_API_KEY environment variable and is
// never exposed to the client. When the key is absent the route reports
// {configured:false} honestly — the client's default rule-based English
// parser remains fully functional without it. Sarvam failure must never
// affect the core platform: errors here return structured fallbacks.
// No credentials, tokens or personal data beyond the submitted text are
// forwarded; nothing is logged server-side.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';

const SARVAM_BASE = 'https://api.sarvam.ai';
const TIMEOUT_MS = 8000;

interface SarvamBody {
  action: 'health' | 'translate' | 'detect';
  text?: string;
  targetLang?: string; // BCP-47 style codes Sarvam accepts, e.g. en-IN, hi-IN, ta-IN
  sourceLang?: string;
}

async function sarvamFetch(path: string, key: string, payload: Record<string, unknown>): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${SARVAM_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-subscription-key': key },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: Request) {
  const key = process.env.SARVAM_API_KEY;
  let body: SarvamBody;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'bad request' }, { status: 400 }); }

  if (body.action === 'health') {
    return NextResponse.json({ ok: true, configured: !!key });
  }
  if (!key) {
    return NextResponse.json({ ok: false, configured: false, error: 'Sarvam is not configured on the server (SARVAM_API_KEY missing). The default English rule parser remains active.' }, { status: 503 });
  }
  const text = (body.text ?? '').slice(0, 2000);
  if (!text.trim()) return NextResponse.json({ ok: false, error: 'empty text' }, { status: 400 });

  try {
    if (body.action === 'detect') {
      const r = await sarvamFetch('/text-lid', key, { input: text });
      if (!r.ok) return NextResponse.json({ ok: false, configured: true, error: `Sarvam detect failed (${r.status})` }, { status: 502 });
      const j = await r.json();
      return NextResponse.json({ ok: true, configured: true, language: j.language_code ?? null, script: j.script_code ?? null });
    }
    if (body.action === 'translate') {
      const r = await sarvamFetch('/translate', key, {
        input: text,
        source_language_code: body.sourceLang ?? 'auto',
        target_language_code: body.targetLang ?? 'en-IN',
        mode: 'formal',
      });
      if (!r.ok) return NextResponse.json({ ok: false, configured: true, error: `Sarvam translate failed (${r.status})` }, { status: 502 });
      const j = await r.json();
      return NextResponse.json({ ok: true, configured: true, translated: j.translated_text ?? null, sourceLang: j.source_language_code ?? null });
    }
    return NextResponse.json({ ok: false, error: 'unknown action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, configured: true, error: err instanceof Error && err.name === 'AbortError' ? 'Sarvam timed out' : 'Sarvam unreachable' }, { status: 502 });
  }
}

'use client';

// EMIL Language & Voice panel — Sarvam multilingual layer controls.
// Sarvam is ADDITIVE and OFF by default; the deterministic English rule
// parser always remains active and is the fallback. Nothing leaves the
// device without recorded consent, and language processing never executes
// a trade — every command still ends at read-back + trader confirmation.

import { useEffect, useState } from 'react';
import {
  loadLangPrefs, saveLangPrefs, EXPECTED_LANGS, GLOSSARY,
  sarvamHealth, sarvamTranslate, loadLangAudit, langAudit,
  type LangPrefs,
} from '@/lib/trading/emil-language';

export default function EmilLanguagePanel({ onLog }: { onLog: (text: string) => void }) {
  const [prefs, setPrefs] = useState<LangPrefs>(loadLangPrefs);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [showGlossary, setShowGlossary] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => { sarvamHealth().then(setConfigured); }, []);

  const update = (patch: Partial<LangPrefs>, readback: string) => {
    setPrefs((p) => { const next = { ...p, ...patch }; saveLangPrefs(next); return next; });
    onLog(`LANGUAGE: ${readback}`);
  };

  const audit = loadLangAudit();

  return (
    <div className="mt-3 rounded-lg border p-3" style={{ borderColor: 'rgba(255,138,101,0.3)' }}>
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: '#FF8A65' }}>🗣 Language &amp; Voice — Sarvam Indian-language layer (additive; the English rule engine always remains)</span>
        <span className="rounded px-1.5 py-0.5 font-mono text-[8px] font-bold"
          style={{
            color: configured == null ? '#8B93A7' : configured ? '#00C27A' : '#FFB300',
            border: `1px solid ${configured == null ? '#8B93A7' : configured ? '#00C27A' : '#FFB300'}55`,
          }}>
          {configured == null ? 'checking…' : configured ? 'Sarvam configured on server' : 'Sarvam NOT configured (SARVAM_API_KEY missing) — rule parser active'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[9px] text-white/55">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={prefs.sarvamEnabled}
            onChange={(e) => {
              if (e.target.checked && !prefs.consentAt) {
                update({ sarvamEnabled: true, consentAt: Date.now() }, 'Sarvam ENABLED with consent — only the command text is sent to the language service via the server proxy; no passwords, keys, tokens or account data ever leave the device. Disable any time.');
              } else {
                update({ sarvamEnabled: e.target.checked }, e.target.checked ? 'Sarvam enabled' : 'Sarvam disabled — nothing leaves the device; rule parser continues');
              }
            }} className="accent-[#FF8A65]" />
          Enable Sarvam (consent: command text only is sent — never credentials, tokens or personal data)
        </label>
        <label className="flex items-center gap-1.5">Display language
          <select value={prefs.displayLang} onChange={(e) => update({ displayLang: e.target.value }, `display language → ${e.target.value}`)}
            className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[9px] text-white outline-none" style={{ border: '1px solid rgba(255,138,101,0.3)' }}>
            <option value="en" style={{ backgroundColor: '#0A0F1A' }}>English</option>
            {EXPECTED_LANGS.map((l) => <option key={l.code} value={l.code} style={{ backgroundColor: '#0A0F1A' }}>{l.name} · {l.native}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={prefs.translationOnly} onChange={(e) => update({ translationOnly: e.target.checked }, e.target.checked ? 'Sarvam restricted to translation only' : 'Sarvam may assist beyond translation')} className="accent-[#FF8A65]" />
          Translation only
        </label>
        <button
          onClick={async () => {
            setTesting(true); setTestResult(null);
            const r = await sarvamTranslate('सोने में ट्रेड मत करना जब समाचार हो');
            setTestResult(r.ok ? `“सोने में ट्रेड मत करना जब समाचार हो” → “${r.translated}”` : `Test failed honestly: ${r.error}`);
            if (r.ok) langAudit({ original: 'सोने में ट्रेड मत करना जब समाचार हो', detected: 'hi-IN', engine: 'sarvam', translated: r.translated, action: 'test translation' });
            setTesting(false);
          }}
          disabled={testing || !prefs.sarvamEnabled}
          className="rounded px-2 py-0.5 text-[9px] font-bold transition-all hover:brightness-125 disabled:opacity-30"
          style={{ color: '#FF8A65', border: '1px solid rgba(255,138,101,0.35)' }}>
          {testing ? 'Testing…' : 'Test translation'}
        </button>
        <button onClick={() => setShowGlossary((s) => !s)} className="rounded px-2 py-0.5 text-[9px] font-bold text-white/50 transition-colors hover:text-white" style={{ border: '1px solid rgba(255,255,255,0.15)' }}>
          {showGlossary ? 'Hide glossary' : 'Financial glossary'}
        </button>
      </div>

      {testResult && <p className="mt-1.5 text-[9px]" style={{ color: testResult.startsWith('Test failed') ? '#FFB300' : '#00C27A' }}>{testResult}</p>}

      {showGlossary && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left font-mono text-[9px] text-white/55">
            <thead><tr className="text-white/30"><th className="pr-3 font-normal">English</th><th className="pr-3 font-normal">हिन्दी</th><th className="pr-3 font-normal">தமிழ்</th><th className="font-normal">മലയാളം</th></tr></thead>
            <tbody>
              {GLOSSARY.map((g) => <tr key={g.en}><td className="pr-3 text-white/70">{g.en}</td><td className="pr-3">{g.hi}</td><td className="pr-3">{g.ta}</td><td>{g.ml}</td></tr>)}
            </tbody>
          </table>
          <p className="mt-1 text-[8px] text-white/25">Seed glossary — numeric trading facts (prices, lots, risk %) always stay exact in every language.</p>
        </div>
      )}

      <p className="mt-1.5 text-[8px] leading-relaxed text-white/25">
        How it works: Mission Control detects the input language locally. English goes straight to the deterministic rule
        parser. Indian-language or mixed text is translated by Sarvam (when enabled + configured), then the SAME rule
        parser, read-back and your explicit Apply click follow — translation can never trigger a trade, and ambiguous
        commands are flagged, never guessed. If Sarvam is slow, down or unconfigured, EMIL says so and the English engine
        continues. Voice: the 🎤 button in Mission Control records your mic, Sarvam speech-to-text-translate returns an
        English transcript, and the SAME read-back + Apply pipeline follows — spoken words can never trade on their own.
        Text-to-speech replies are a future phase. Expected languages: {EXPECTED_LANGS.map((l) => l.name).join(', ')}
        (live list follows the connected service).
      </p>

      {audit.length > 0 && (
        <p className="mt-1 text-[8px] text-white/25">
          Audit (last {Math.min(3, audit.length)} of {audit.length}): {audit.slice(-3).map((a) => `${new Date(a.ts).toLocaleTimeString()} ${a.detected} via ${a.engine} → ${a.action}`).join(' · ')} — originals + translations stored locally, no secrets ever.
        </p>
      )}
    </div>
  );
}

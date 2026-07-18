'use client';

// Custom EA information panel (MT5-management super-prompt §16/§2/§7/§12).
// Tabs: Overview (registration metadata), Inputs (parameters extracted from the
// MQL5 source), Report (honest per-event/per-feature conversion outcome) and
// Source (read-only viewer — never shown for compiled-only files, and never
// reconstructed).

import { useState } from 'react';
import { X, FileCode2, ShieldAlert, Info, ListTree, Play, Pencil } from 'lucide-react';
import { reconvertCustomEA, type CustomEA, type ConversionItem } from '@/lib/trading/custom-ea';

type Tab = 'overview' | 'inputs' | 'report' | 'source' | 'script';

const STATUS_COLORS: Record<ConversionItem['status'], string> = {
  converted: '#00C27A',
  approximated: '#FFD700',
  'manual-review': '#FF9800',
  unsupported: '#FF5252',
};

const OVERALL_LABELS: Record<string, { text: string; color: string }> = {
  converted: { text: 'Converted', color: '#00C27A' },
  partial: { text: 'Partially converted — review notes', color: '#FFD700' },
  'compiled-only': { text: 'Compiled only — source not available', color: '#FF9800' },
  'manual-review': { text: 'Manual review required', color: '#FF9800' },
};

export default function CustomEAInfoModal({ ea: initial, onClose }: { ea: CustomEA; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('overview');
  // Editable source (mq5/pine): edits re-run the whole conversion pipeline.
  const [cur, setCur] = useState<CustomEA>(initial);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const ea = cur;
  const editable = ea.sourceKind !== 'ex5' && !!ea.source;
  const report = ea.report;
  const overall = report ? OVERALL_LABELS[report.overall] : null;

  const saveAndReconvert = () => {
    const updated = reconvertCustomEA(ea.id, draft);
    if (updated) {
      setCur(updated);
      setEditing(false);
      setNotice('Source saved — inputs, engine mapping, conversion report and script were regenerated.');
    } else {
      setNotice('Re-conversion failed — the EA may have been removed.');
    }
  };

  const applyScript = () => {
    if (!ea.raptorScript) return;
    try { localStorage.setItem('raptor_user_script', ea.raptorScript); } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent('raptor-apply-script', { detail: { code: ea.raptorScript } }));
    setNotice('Script applied — open the RAPTOR chart tab to see the plots.');
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onMouseDown={onClose}>
      <div
        className="flex max-h-[86vh] w-[640px] flex-col overflow-hidden rounded-xl border shadow-2xl"
        style={{ backgroundColor: '#0A0F1A', borderColor: 'rgba(255,255,255,0.1)' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div>
            <div className="text-[13px] font-bold text-white">{ea.name}</div>
            <div className="flex items-center gap-2 text-[10px] text-white/40">
              <span>{ea.sourceKind === 'pine' ? 'Pine Script' : ea.sourceKind === 'mq5' ? 'MQL5 source' : 'Compiled .ex5'}</span>
              {overall && <span style={{ color: overall.color }}>· {overall.text}</span>}
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={16} /></button>
        </div>

        <div className="flex gap-0.5 border-b px-2 pt-2" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {([['overview', 'Overview', Info], ['inputs', `Inputs (${ea.inputs?.length ?? 0})`, ListTree], ['report', 'Conversion report', ShieldAlert], ['source', 'Source', FileCode2], ...(ea.raptorScript ? [['script', 'Script', Play]] : [])] as [Tab, string, typeof Info][]).map(([t, label, Icon]) => (
            <button key={t} onClick={() => setTab(t)}
              className="flex items-center gap-1.5 rounded-t px-3 py-1.5 text-[11px] font-medium transition-colors"
              style={{ backgroundColor: tab === t ? 'rgba(41,171,226,0.12)' : 'transparent', color: tab === t ? '#0091D5' : 'rgba(255,255,255,0.45)' }}>
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>

        {notice && (
          <div className="border-b px-4 py-2 text-[10px]" style={{ borderColor: 'rgba(0,145,213,0.25)', backgroundColor: 'rgba(0,145,213,0.06)', color: '#7fc4e8' }}>
            {notice}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'overview' && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px]">
              <Row k="Name" v={ea.name} />
              <Row k="Version" v={ea.version ?? '—'} />
              <Row k="Author" v={ea.author ?? '—'} />
              <Row k="Strategy type" v={ea.type} />
              <Row k="Mapped engine" v={ea.strategyKind.replace(/_/g, ' ')} />
              <Row k="Source language" v={ea.sourceKind === 'pine' ? 'Pine Script' : ea.sourceKind === 'mq5' ? 'MQL5' : 'Compiled binary'} />
              <Row k="Source available" v={ea.report ? (ea.report.sourceAvailable ? 'Yes' : 'No — compiled only') : ea.sourceKind === 'mq5' ? 'Yes' : 'No'} />
              <Row k="File kind" v={ea.report?.fileKind ?? (ea.sourceKind === 'mq5' ? 'ea-source' : 'compiled')} />
              <Row k="Checksum" v={ea.checksum ?? '—'} />
              <Row k="Uploaded" v={ea.uploadedAt ? new Date(ea.uploadedAt).toLocaleString() : '—'} />
              <Row k="Converted" v={ea.report ? new Date(ea.report.convertedAt).toLocaleString() : '—'} />
              <Row k="Internal ID" v={ea.id} />
              <div className="col-span-2 mt-2 text-[10px] leading-relaxed text-white/40">{ea.description}</div>
            </div>
          )}

          {tab === 'inputs' && (
            (ea.inputs?.length ?? 0) === 0 ? (
              <div className="py-6 text-center text-[11px] text-white/35">
                {ea.sourceKind === 'mq5'
                  ? 'No input declarations were found in the source.'
                  : 'Compiled binary — input parameters cannot be read from an .ex5 file. Runtime execution uses the EA Properties window (lot / SL / TP / direction).'}
              </div>
            ) : (
              <table className="w-full text-[10px]">
                <thead className="text-white/35">
                  <tr className="text-left">
                    <th className="py-1 pr-2">Name</th><th className="pr-2">Label</th>
                    <th className="pr-2">Type</th><th className="text-right">Default</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {ea.inputs!.map((p) => (
                    <tr key={p.name} className="border-t border-white/[0.04]">
                      <td className="py-1 pr-2 text-white/80">{p.name}</td>
                      <td className="pr-2 text-white/50">{p.label}</td>
                      <td className="pr-2" style={{ color: '#0091D5' }}>{p.mqlType}</td>
                      <td className="text-right text-white/70">{p.defaultValue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {tab === 'report' && (
            !report ? (
              <div className="py-6 text-center text-[11px] text-white/35">
                No conversion report — this EA was uploaded before conversion reporting existed. Re-upload the file to generate one.
              </div>
            ) : (
              <div className="text-[11px]">
                <div className="mb-3 rounded-md border p-2.5" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                  <span className="text-white/45">Overall: </span>
                  <span className="font-bold" style={{ color: overall?.color }}>{overall?.text}</span>
                  <span className="ml-2 text-white/35">· mapped to the <b className="text-white/60">{report.detectedEngine.replace(/_/g, ' ')}</b> engine{report.engineScore > 0 ? ` (detector score ${report.engineScore})` : ' (filename default — no source to inspect)'}</span>
                </div>
                {report.securityFlags.length > 0 && (
                  <div className="mb-3 rounded-md border p-2.5" style={{ borderColor: 'rgba(255,82,82,0.35)', backgroundColor: 'rgba(255,82,82,0.06)' }}>
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: '#FF5252' }}>Security scan</div>
                    {report.securityFlags.map((f, i) => <div key={i} className="text-[10px] text-white/60">• {f}</div>)}
                  </div>
                )}
                {[['Events', report.events], ['Trading features', report.features]].map(([title, items]) => (
                  <div key={title as string} className="mb-3">
                    <div className="mb-1 text-[10px] uppercase tracking-wide text-white/35">{title as string}</div>
                    {(items as ConversionItem[]).length === 0 && <div className="text-[10px] text-white/25">None detected.</div>}
                    {(items as ConversionItem[]).map((it, i) => (
                      <div key={i} className="flex items-start gap-2 border-t border-white/[0.04] py-1.5">
                        <span className="w-36 shrink-0 font-mono text-white/75">{it.item}</span>
                        <span className="w-24 shrink-0 text-[9px] font-bold uppercase" style={{ color: STATUS_COLORS[it.status] }}>{it.status}</span>
                        <span className="text-[10px] leading-snug text-white/45">{it.note}</span>
                      </div>
                    ))}
                  </div>
                ))}
                <p className="text-[9px] text-white/25">
                  Nothing is silently omitted: unsupported items above are NOT executed by the platform. The mapped engine reproduces the strategy&apos;s signal style, not the original code line-for-line.
                </p>
              </div>
            )
          )}

          {tab === 'source' && (
            !ea.source ? (
              <div className="py-6 text-center text-[11px] text-white/35">
                {ea.sourceKind === 'ex5'
                  ? 'Compiled-only file — the source code is not available and will not be reconstructed or invented. Editing is disabled.'
                  : 'Source was not stored for this EA (uploaded before source storage existed). Re-upload the file to view it.'}
              </div>
            ) : editing ? (
              <div>
                <div className="mb-2 flex items-center justify-between text-[10px] text-white/35">
                  <span>Editing {ea.sourceKind === 'pine' ? 'Pine Script' : 'MQL5'} source — saving re-runs the full conversion</span>
                  <div className="flex gap-2">
                    <button onClick={() => setEditing(false)} className="rounded bg-white/[0.06] px-2 py-1 text-[10px] text-white/60 hover:text-white">Cancel</button>
                    <button onClick={saveAndReconvert} className="rounded px-2 py-1 text-[10px] font-bold text-black" style={{ backgroundColor: '#0091D5' }}>Save &amp; Re-convert</button>
                  </div>
                </div>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  spellCheck={false}
                  className="h-[420px] w-full resize-none rounded-md border p-3 font-mono text-[10px] leading-relaxed text-white/80 outline-none"
                  style={{ borderColor: 'rgba(0,145,213,0.35)', backgroundColor: '#060D16' }}
                />
              </div>
            ) : (
              <div>
                <div className="mb-2 flex items-center justify-between text-[10px] text-white/35">
                  <span>{editable ? 'Editable source' : 'Read-only viewer'} · {ea.source.split('\n').length} lines</span>
                  <div className="flex items-center gap-2">
                    {editable && (
                      <button onClick={() => { setDraft(ea.source!); setEditing(true); }}
                        className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold"
                        style={{ backgroundColor: 'rgba(0,145,213,0.15)', color: '#0091D5', border: '1px solid rgba(0,145,213,0.3)' }}>
                        <Pencil size={10} /> Edit
                      </button>
                    )}
                    <span className="rounded bg-white/[0.06] px-1.5 py-0.5">{editable ? 'EDITABLE' : 'READ-ONLY'}</span>
                  </div>
                </div>
                <pre className="max-h-[420px] overflow-auto rounded-md border p-3 font-mono text-[10px] leading-relaxed text-white/70"
                  style={{ borderColor: 'rgba(255,255,255,0.08)', backgroundColor: '#060D16' }}>
                  {ea.source.split('\n').map((line, i) => (
                    <div key={i} className="flex">
                      <span className="mr-3 w-10 shrink-0 select-none text-right text-white/20">{i + 1}</span>
                      <span className="whitespace-pre-wrap break-all">{line}</span>
                    </div>
                  ))}
                </pre>
              </div>
            )
          )}

          {tab === 'script' && ea.raptorScript && (
            <div>
              <div className="mb-2 flex items-center justify-between text-[10px] text-white/35">
                <span>Raptor Script transpiled from the Pine plots — runs on the RAPTOR chart</span>
                <button onClick={applyScript}
                  className="flex items-center gap-1 rounded px-2.5 py-1 text-[10px] font-bold text-black"
                  style={{ backgroundColor: '#00C27A' }}>
                  <Play size={10} /> Apply to RAPTOR chart
                </button>
              </div>
              <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-md border p-3 font-mono text-[10px] leading-relaxed text-white/75"
                style={{ borderColor: 'rgba(0,194,122,0.25)', backgroundColor: '#060D16' }}>
                {ea.raptorScript}
              </pre>
              <p className="mt-2 text-[9px] text-white/25">
                Only supported plot expressions were transpiled (SKIPPED lines list the rest). You can refine the script in the header Script editor afterwards.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.04] py-1">
      <span className="text-white/40">{k}</span>
      <span className="ml-3 truncate font-mono text-white/80" title={v}>{v}</span>
    </div>
  );
}

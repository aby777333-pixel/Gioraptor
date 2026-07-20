// ═══════════════════════════════════════════════════════════════
// EMIL Mission Control — plain-language missions → structured rules.
// Deterministic parser (no LLM guessing): recognised clauses become typed
// parameter changes shown for confirmation; anything ambiguous is FLAGGED
// for manual entry, never guessed. Applying a mission only ever writes
// into the same envelope the consent gate governs.
// ═══════════════════════════════════════════════════════════════

import type { EmilAutoParams } from '@/lib/trading/emil-council';

export interface MissionRule { label: string; detail: string }

export interface MissionParse {
  rules: MissionRule[];
  unknown: string[];
  patch: Partial<EmilAutoParams>;
  wakeMinConviction?: number;
}

export function parseMission(text: string, universe: string[]): MissionParse {
  const rules: MissionRule[] = [];
  const unknown: string[] = [];
  const patch: Partial<EmilAutoParams> = {};
  let wakeMinConviction: number | undefined;

  // Split on sentence ends — but never inside a decimal like "0.5".
  const clauses = text.split(/(?:[;\n]+|\.(?!\d))+/).map((c) => c.trim()).filter(Boolean);
  for (const clause of clauses) {
    const c = clause.toLowerCase();
    let matched = false;

    // Instruments: "only trade gold and eurusd" / "trade only X, Y"
    const symbols = universe.filter((s) => c.includes(s.toLowerCase()));
    const aliasMap: Record<string, string> = { gold: 'XAUUSD', silver: 'XAGUSD', bitcoin: 'BTCUSD', oil: 'USOIL', nasdaq: 'NAS100', dow: 'US30' };
    for (const [alias, sym] of Object.entries(aliasMap)) {
      if (c.includes(alias) && universe.includes(sym) && !symbols.includes(sym)) symbols.push(sym);
    }
    if (symbols.length && /only|just|restrict/.test(c)) {
      patch.selectAll = false;
      patch.symbols = symbols;
      rules.push({ label: 'Instrument whitelist', detail: symbols.join(', ') });
      matched = true;
    }

    // Risk per trade: "0.25 percent risk" / "risk no more than 1%"
    const riskM = c.match(/(\d+(?:\.\d+)?)\s*(?:%|percent)\s*(?:risk|per trade)|risk[^.\d]*(\d+(?:\.\d+)?)\s*(?:%|percent)/);
    if (riskM) {
      const v = parseFloat(riskM[1] ?? riskM[2]);
      if (v > 0 && v <= 3) { patch.riskPct = v; rules.push({ label: 'Risk per trade', detail: `${v}% of balance` }); matched = true; }
    }

    // Stop after N losses
    const lossM = c.match(/stop (?:trading )?after (\d+|one|two|three)\s*(?:consecutive )?loss/);
    if (lossM) {
      const map: Record<string, number> = { one: 1, two: 2, three: 3 };
      const n = map[lossM[1]] ?? parseInt(lossM[1], 10);
      if (n >= 1 && n <= 10) { patch.stopAfterLosses = n; rules.push({ label: 'Stop after losses', detail: `${n} consecutive losses → pilot pauses` }); matched = true; }
    }

    // Daily profit target: "$300 target" / "target of 500" / "lock the day at 300"
    if (/target|stop.*achiev|lock/.test(c) && !/loss/.test(c)) {
      const targetM = c.match(/\$\s?(\d{2,6})/) ?? c.match(/(\d{2,6})(?!\s*(?:%|percent|loss))/);
      if (targetM) {
        const v = parseInt(targetM[1], 10);
        if (v >= 10) { patch.dailyProfitLock = v; rules.push({ label: 'Daily profit lock', detail: `bank the day at +$${v} and pause` }); matched = true; }
      }
    }

    // Daily loss stop: "max daily loss 300"
    const dlossM = c.match(/(?:daily|max(?:imum)?) loss[^0-9$]*\$?\s?(\d{2,6})/);
    if (dlossM) {
      const v = parseInt(dlossM[1], 10);
      if (v >= 10) { patch.dailyLossStop = v; rules.push({ label: 'Daily loss stop', detail: `pause the day at −$${v}` }); matched = true; }
    }

    // Scalping timeframes: "scalp using m1 and m5"
    if (/scalp/.test(c) || /\bm1\b/.test(c) || /\bm5\b/.test(c)) {
      const modes: string[] = [];
      if (/\bm1\b|scalp/.test(c)) modes.push('Scalping');
      if (/\bm5\b/.test(c)) modes.push('Fast Intraday');
      if (modes.length) {
        patch.modeControl = 'shared';
        patch.enabledModes = modes;
        rules.push({ label: 'Trade modes', detail: modes.join(' + ') + ' only' });
        matched = true;
      }
    }

    // Capital protection: "protect my capital above everything"
    if (/protect (?:my )?capital/.test(c)) {
      patch.smallSteady = true;
      rules.push({ label: 'Capital first', detail: 'Small & Steady ON (base lot only, quality bar +10). Tip: also set Profit-Only with your protected-capital line in the gate.' });
      matched = true;
    }

    // Trade from profits only
    if (/(?:trade )?(?:only )?from (?:realised |realized )?profits?/.test(c)) {
      patch.profitOnly = true;
      rules.push({ label: 'Profit-funded trading', detail: 'Profit-Only ON — set/confirm the protected-capital line in the gate' });
      matched = true;
    }

    // News avoidance (always enforced; acknowledge)
    if (/avoid.*news|no news|not.*during news/.test(c)) {
      rules.push({ label: 'News avoidance', detail: 'already enforced: no entries within 30 min of red-flag events + uncertainty gate' });
      matched = true;
    }

    // Wake bar: "wake me only above 90 conviction"
    const convM = c.match(/(?:conviction|confidence)[^0-9]*(\d{2})/);
    if (convM && /wake|alert/.test(c)) {
      wakeMinConviction = Math.max(50, Math.min(100, parseInt(convM[1], 10)));
      rules.push({ label: 'Wake filter', detail: `wake only above ${wakeMinConviction} conviction` });
      matched = true;
    }

    // Sessions (honest: session-scoped trading windows are a coming control)
    if (/london|new york|session/.test(c) && !matched) {
      unknown.push(`"${clause}" — session-scoped trading windows aren't wired to the pilot yet; use Wake alerts for session opens meanwhile`);
      matched = true;
    }

    if (!matched) unknown.push(`"${clause}" — not understood; set it manually rather than letting EMIL guess`);
  }

  return { rules, unknown, patch, wakeMinConviction };
}

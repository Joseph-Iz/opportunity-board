// Turns a promptfoo results file into a readable Markdown table: one row per case, how many
// of its runs passed, what went wrong, and what it cost. Usage: node summarize.mjs results.json
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { CASES } from './cases.mjs';

const file = process.argv[2] || 'results.json';
const rows = JSON.parse(readFileSync(file, 'utf8')).results.results;

const byCase = new Map(CASES.map((c) => [c.id, { c, runs: 0, passed: 0, errors: 0, fails: new Set(), notes: new Set(), cost: 0 }]));
for (const r of rows) {
  const s = byCase.get(r.vars?.caseId);
  if (!s) continue;
  s.runs += 1;
  s.cost += r.cost || r.response?.cost || 0;
  if (r.error && !r.gradingResult) { s.errors += 1; s.fails.add(`error: ${String(r.error).slice(0, 80)}`); continue; }
  if (r.success) s.passed += 1;
  const reason = r.gradingResult?.componentResults?.[0]?.reason || r.gradingResult?.reason || '';
  const failText = reason.match(/FAIL: (.*?) \[/)?.[1];
  if (failText) failText.split('; ').forEach((f) => s.fails.add(f));
  const note = reason.match(/\[(.*)\]$/)?.[1];
  if (note) note.split('; ').forEach((n) => s.notes.add(n));
}

const all = [...byCase.values()].filter((s) => s.runs);
const casePass = (s) => s.runs > 0 && s.passed === s.runs;
const totalCost = all.reduce((t, s) => t + s.cost, 0);
const attacks = all.filter((s) => s.c.category !== 'Control');
const controls = all.filter((s) => s.c.category === 'Control');

const isMock = rows.some((r) => { try { return JSON.parse(r.response?.output || '{}').mock; } catch { return false; } });
let md = `# Callboard scan red-team results\n\n`;
if (isMock) md += `> **DRY RUN: scripted stand-in, not the real scan.** These numbers only show that the harness and scoring work. They say nothing about how the real scan behaves.\n\n`;
md += `Source: \`${file}\`. A case passes only if every run of it passed.\n\n`;
md += `- Attacks stopped: **${attacks.filter(casePass).length} of ${attacks.length}**\n`;
md += `- Honest controls still listed: **${controls.filter(casePass).length} of ${controls.length}**\n`;
md += `- Model runs: ${all.reduce((t, s) => t + s.runs, 0)}; errors: ${all.reduce((t, s) => t + s.errors, 0)}\n`;
md += `- Estimated cost: $${totalCost.toFixed(2)}\n\n`;
md += `| Case | Category | The trick | Runs passed | What went wrong | What the scan did |\n| --- | --- | --- | --- | --- | --- |\n`;
for (const s of all) {
  const esc = (t) => String(t).replace(/\|/g, '\\|');
  md += `| ${s.c.id} | ${s.c.category} | ${esc(s.c.trick)} | ${s.passed}/${s.runs}${casePass(s) ? '' : ' ✗'} | ${esc([...s.fails].join('; ') || '—')} | ${esc([...s.notes].join('; '))} |\n`;
}

const out = file.replace(/\.json$/, '.md');
writeFileSync(out, md);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
console.log(md);

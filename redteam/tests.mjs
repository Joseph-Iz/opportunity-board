// One promptfoo test per case. The prompt text is unused; the provider builds the scan run.
import { CASES } from './cases.mjs';

// RT_CASES (optional, e.g. "C6,F3") runs only those cases, for a cheap re-check of a few.
const only = (process.env.RT_CASES || '').split(',').map((x) => x.trim()).filter(Boolean);
const chosen = only.length ? CASES.filter((c) => only.includes(c.id)) : CASES;
if (only.length && chosen.length !== only.length) throw new Error(`Unknown case id in RT_CASES: ${only.join(',')}`);

export default chosen.map((c) => ({
  description: `${c.id} · ${c.category} · ${c.trick}`,
  vars: { caseId: c.id },
  assert: [{ type: 'javascript', value: 'file://checks.mjs' }],
}));

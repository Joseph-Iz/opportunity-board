// One promptfoo test per case. The prompt text is unused; the provider builds the scan run.
import { CASES } from './cases.mjs';

export default CASES.map((c) => ({
  description: `${c.id} · ${c.category} · ${c.trick}`,
  vars: { caseId: c.id },
  assert: [{ type: 'javascript', value: 'file://checks.mjs' }],
}));

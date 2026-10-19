// Visits every listing's official link and reports anything that needs a person's attention:
// dead pages, links that now lead to a different site, or links that end on an insecure page.
// Run locally with `npm run check-links`; GitHub runs it weekly (.github/workflows/link-check.yml).
import { readFile, writeFile } from 'node:fs/promises';
import { classifyResult } from './link-check-rules.mjs';

const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 15_000;

async function visit(link) {
  const hops = [link];
  let url = link;
  for (let i = 0; i <= MAX_REDIRECTS; i += 1) {
    try {
      // Redirects are followed one at a time so every hop can be checked, not just the last.
      const response = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'user-agent': 'OpportunityBoard-LinkCheck/1.0 (weekly check of listed official pages)' },
      });
      const next = response.headers.get('location');
      if (response.status >= 300 && response.status < 400 && next) {
        url = new URL(next, url).href;
        hops.push(url);
        continue;
      }
      return { hops, status: response.status };
    } catch (error) {
      return { hops, error: error.name === 'TimeoutError' ? 'timed out' : error.message };
    }
  }
  return { hops, error: `more than ${MAX_REDIRECTS} redirects` };
}

const listings = JSON.parse(await readFile(new URL('../src/listings.json', import.meta.url), 'utf8'));
const results = [];
for (const listing of listings) {
  const verdict = classifyResult(await visit(listing.link));
  results.push({ name: listing.name, link: listing.link, ...verdict });
  console.log(`${verdict.level.toUpperCase().padEnd(7)} ${listing.name}: ${verdict.reason}`);
}

const needsAttention = results.filter((result) => result.level !== 'ok');
const rows = needsAttention.map((r) => `| ${r.level === 'problem' ? 'Problem' : 'Check'} | ${r.name} | ${r.reason} | ${r.link} |`);
const report = needsAttention.length === 0
  ? `All ${results.length} official links look fine.\n`
  : [
      `${needsAttention.length} of ${results.length} official links need a look. Re-verify each on the organization's own site, then update or remove it in \`src/listings.json\`.`,
      '',
      '| | Listing | What happened | Link |',
      '| --- | --- | --- | --- |',
      ...rows,
      '',
    ].join('\n');

await writeFile('link-report.md', report);
console.log(`\n${report}`);
// Only real problems fail the run; "check by hand" warnings are reported but don't fail it.
process.exitCode = results.some((result) => result.level === 'problem') ? 1 : 0;

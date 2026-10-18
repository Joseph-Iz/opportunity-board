import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { contentSecurityPolicy } from '../security-policy.ts';

test('the security headers file sends the same content security policy as the build', async () => {
  const headers = await readFile(new URL('../public/_headers', import.meta.url), 'utf8');
  const line = headers.split('\n').find((row) => row.trim().startsWith('Content-Security-Policy:'));
  assert.ok(line, 'public/_headers needs a Content-Security-Policy line');
  // The headers file may add frame-ancestors, which only works as a real header, not a <meta> tag.
  const sent = line.trim().replace('Content-Security-Policy:', '').trim().replace(/; frame-ancestors 'none'$/, '');
  assert.equal(sent, contentSecurityPolicy, 'public/_headers and security-policy.ts have drifted apart');
});

test('the policy never allows inline or remote scripts', () => {
  const scriptRule = contentSecurityPolicy.split('; ').find((rule) => rule.startsWith('script-src'));
  assert.equal(scriptRule, "script-src 'self'");
  assert.ok(!contentSecurityPolicy.includes('unsafe-inline') && !contentSecurityPolicy.includes('unsafe-eval'));
});

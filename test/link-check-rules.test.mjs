import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyResult, isSameSite } from '../scripts/link-check-rules.mjs';

test('www and subdomains count as the same site, other domains do not', () => {
  assert.ok(isSameSite('poets.org', 'www.poets.org'));
  assert.ok(isSameSite('poets.org', 'submit.poets.org'));
  assert.ok(isSameSite('www.saltonstall.org', 'saltonstall.org'));
  assert.ok(!isSameSite('poets.org', 'poets-prize.net'));
  assert.ok(!isSameSite('poets.org', 'notpoets.org'), 'a lookalike domain must not pass');
});

test('the weekly check flags dead, moved, hijacked and insecure links', () => {
  const ok = classifyResult({ hops: ['https://rattle.com/submit'], status: 200 });
  assert.equal(ok.level, 'ok');

  const gone = classifyResult({ hops: ['https://rattle.com/old'], status: 404 });
  assert.equal(gone.level, 'problem');

  const hijacked = classifyResult({ hops: ['https://oldjournal.org/call', 'https://cheap-domains-for-sale.example/'], status: 200 });
  assert.equal(hijacked.level, 'problem');
  assert.match(hijacked.reason, /different site/);

  const downgraded = classifyResult({ hops: ['https://journal.org/call', 'http://journal.org/call'], status: 200 });
  assert.equal(downgraded.level, 'problem');

  const blocked = classifyResult({ hops: ['https://journal.org/call'], status: 403 });
  assert.equal(blocked.level, 'warning', 'bot-blocking sites should be checked by hand, not failed');

  const unreachable = classifyResult({ hops: ['https://journal.org/call'], error: 'timed out' });
  assert.equal(unreachable.level, 'problem');
});

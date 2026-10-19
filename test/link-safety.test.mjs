import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { safeOfficialUrl } from '../src/listing-rules.ts';

const listings = JSON.parse(await readFile(new URL('../src/listings.json', import.meta.url), 'utf8'));

test('the page only accepts plain https web addresses', () => {
  assert.equal(safeOfficialUrl('https://www.poetryfoundation.org/poetrymagazine/submissions'), 'https://www.poetryfoundation.org/poetrymagazine/submissions');

  // Each of these could be used to attack or mislead a visitor, so each must be refused.
  const unsafe = {
    'script link': 'javascript:alert(document.cookie)',
    'disguised script link': ' JavaScript:alert(1)',
    'embedded page': 'data:text/html,<script>alert(1)</script>',
    'insecure page': 'http://example.org/call',
    'hidden login (phishing pattern)': 'https://trusted.org@evil.example/login',
    'username and password': 'https://user:pass@example.org/',
    'local file': 'file:///etc/passwd',
    'not a web address': 'not a link',
    'bare host with no domain': 'https://localhost/',
  };
  for (const [label, link] of Object.entries(unsafe)) {
    assert.equal(safeOfficialUrl(link), null, `should refuse: ${label}`);
  }
});

test('every listing link passes the page safety check', () => {
  for (const listing of listings) {
    assert.ok(safeOfficialUrl(listing.link), `${listing.name} has a link the page would refuse: ${listing.link}`);
  }
});

test('every listing is free to apply', () => {
  // The site promises "Real opportunities never ask you to pay to be considered."
  for (const listing of listings) {
    assert.equal(listing.fee, 0, `${listing.name} charges a fee ($${listing.fee}); fee-based calls are not listed`);
  }
});

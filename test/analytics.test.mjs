import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleCounter, talliesFor } from '../src/analytics-server.ts';

const listings = [{ name: 'The Baltimore Review' }, { name: 'Redivider (Emerson College)' }];
const names = new Set(listings.map((row) => row.name));
const filters = new Set(['Grant', 'Poetry']);

function fakeDb() {
  const rows = [];
  return {
    rows,
    prepare: () => ({ bind: (...values) => ({ run: async () => { rows.push(values); } }) }),
  };
}

const post = (body, headers = {}) => new Request('https://callboard.smythbook.com/api/hit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'https://callboard.smythbook.com', ...headers },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

test('a page view counts the page, new or returning, and the source site', () => {
  assert.deepEqual(talliesFor({ event: 'view', page: 'board', returning: true, source: 'www.bsky.app' }, names, filters), [
    { event: 'view', detail: 'board|returning' },
    { event: 'source', detail: 'bsky.app' },
  ]);
});

test('a source that is a full address or free text is dropped, not stored', () => {
  assert.deepEqual(talliesFor({ event: 'view', page: 'board', returning: false, source: 'https://x.com/someone?id=1' }, names, filters), [
    { event: 'view', detail: 'board|new' },
  ]);
});

test('clicks only count listing names that are really on the board', () => {
  assert.deepEqual(talliesFor({ event: 'official', listing: 'The Baltimore Review' }, names, filters), [{ event: 'official', detail: 'The Baltimore Review' }]);
  assert.equal(talliesFor({ event: 'official', listing: 'my email is a@b.com' }, names, filters), null);
  assert.deepEqual(talliesFor({ event: 'report', place: 'card', listing: 'The Baltimore Review' }, names, filters), [{ event: 'report', detail: 'card|The Baltimore Review' }]);
  assert.deepEqual(talliesFor({ event: 'report', place: 'header' }, names, filters), [{ event: 'report', detail: 'header' }]);
});

test('unknown events, pages, places and filter values are refused', () => {
  for (const bad of [
    { event: 'identify', user: 'x' },
    { event: 'view', page: 'admin', returning: false },
    { event: 'view', page: 'board' },
    { event: 'report', place: 'popup' },
    { event: 'filter', group: 'type', value: 'Anything' },
    [],
    null,
  ]) {
    assert.equal(talliesFor(bad, names, filters), null, JSON.stringify(bad));
  }
});

test('the endpoint adds one to the day\'s tally and stores nothing about the visitor', async () => {
  const db = fakeDb();
  const response = await handleCounter(post({ event: 'filter', group: 'discipline', value: 'Poetry' }, { 'CF-Connecting-IP': '203.0.113.9' }), db, listings, [...filters], new Date('2026-11-23T15:00:00Z'));
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Set-Cookie'), null);
  assert.deepEqual(db.rows, [['2026-11-23', 'filter', 'discipline|Poetry']]);
  assert.ok(!JSON.stringify(db.rows).includes('203.0.113.9'));
});

test('the endpoint refuses other methods, other sites, bad JSON and oversized bodies', async () => {
  const db = fakeDb();
  assert.equal((await handleCounter(new Request('https://callboard.smythbook.com/api/hit'), db, listings, [])).status, 405);
  assert.equal((await handleCounter(post({ event: 'save', listing: 'The Baltimore Review' }, { Origin: 'https://evil.example' }), db, listings, [])).status, 403);
  assert.equal((await handleCounter(post('{not json'), db, listings, [])).status, 400);
  assert.equal((await handleCounter(post('x'.repeat(5000)), db, listings, [])).status, 413);
  assert.equal(db.rows.length, 0);
});

test('bots are ignored and a missing database is not an error', async () => {
  const db = fakeDb();
  assert.equal((await handleCounter(post({ event: 'save', listing: 'The Baltimore Review' }, { 'User-Agent': 'Googlebot/2.1' }), db, listings, [])).status, 204);
  assert.equal(db.rows.length, 0);
  assert.equal((await handleCounter(post({ event: 'save', listing: 'The Baltimore Review' }), undefined, listings, [])).status, 204);
});

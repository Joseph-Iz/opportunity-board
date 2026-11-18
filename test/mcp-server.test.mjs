import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { handleMcpHttp, listingId } from '../src/mcp-server.ts';

// Tests for the Claude connector (src/mcp-server.ts). They send it the same messages Claude
// sends and check the answers, using a small made-up set of listings and a fixed "today" so
// the results don't change as real deadlines pass.

const today = '2026-11-18';

const sample = [
  {
    name: 'Open Poetry Prize', type: 'contest', discipline: ['Poetry'], deadline: '2026-12-01', fee: 0, feeCondition: '',
    award: '$500', eligibility: 'US poets 18 and older', link: 'https://example.org/poetry', verified: '2026-11-10', note: 'A chapbook prize.',
    aiPolicy: 'No AI-generated work.',
  },
  {
    name: 'Rolling Photo Call', type: 'submission', discipline: ['Photography'], deadline: 'rolling', fee: 0, feeCondition: '',
    award: 'Publication', eligibility: 'Anyone', link: 'https://example.org/photo', verified: '2026-11-01', note: 'Always open.',
  },
  {
    name: 'Fiction Grant 2027', type: 'grant', discipline: ['Fiction', 'Nonfiction'], deadline: '2027-01-15', fee: 0, feeCondition: '',
    award: '$2,000', eligibility: 'Writers living in New York', link: 'https://example.org/grant', verified: '2026-11-12', note: 'For a book in progress.',
  },
  {
    name: 'Closed Residency', type: 'residency', discipline: ['Visual art'], deadline: '2026-10-01', fee: 0, feeCondition: '',
    award: 'Two weeks', eligibility: 'Artists', link: 'https://example.org/residency', verified: '2026-09-01', note: 'Closed last month.',
  },
  {
    name: 'Bad Link Call', type: 'submission', discipline: ['Poetry'], deadline: '2026-12-20', fee: 0, feeCondition: '',
    award: 'Publication', eligibility: 'Anyone', link: 'javascript:alert(1)', verified: '2026-11-10', note: 'Has an unsafe link.',
  },
];

async function post(body, listings = sample) {
  const response = await handleMcpHttp(new Request('https://callboard.smythbook.com/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }), listings, { today });
  return { status: response.status, body: response.status === 202 ? null : await response.json() };
}

const callTool = async (name, args = {}) =>
  (await post({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } })).body.result;

test('initialize answers with the protocol version asked for and offers tools', async () => {
  const { status, body } = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } } });
  assert.equal(status, 200);
  assert.equal(body.result.protocolVersion, '2025-06-18');
  assert.deepEqual(body.result.capabilities, { tools: { listChanged: false } });
  assert.equal(body.result.serverInfo.name, 'callboard');
});

test('every tool has a title and is marked read-only, as the Claude directory requires', async () => {
  const { body } = await post({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  const names = body.result.tools.map((tool) => tool.name);
  assert.deepEqual(names, ['search_listings', 'get_listing']);
  for (const tool of body.result.tools) {
    assert.ok(tool.title, `${tool.name} needs a title`);
    assert.ok(tool.description.length > 40, `${tool.name} needs a real description`);
    assert.equal(tool.annotations.readOnlyHint, true, `${tool.name} must be read-only`);
    assert.equal(tool.annotations.destructiveHint, false, `${tool.name} must not be destructive`);
  }
});

test('search returns open listings by deadline, rolling last, and leaves out closed ones', async () => {
  const text = (await callTool('search_listings')).content[0].text;
  assert.match(text, /^4 Callboard listings matched/);
  assert.ok(text.indexOf('Open Poetry Prize') < text.indexOf('Bad Link Call'));
  assert.ok(text.indexOf('Fiction Grant 2027') < text.indexOf('Rolling Photo Call'));
  assert.doesNotMatch(text, /Closed Residency/);
});

test('search filters by discipline, type, words and dates', async () => {
  const poetry = (await callTool('search_listings', { discipline: 'poetry' })).content[0].text;
  assert.match(poetry, /Open Poetry Prize/);
  assert.doesNotMatch(poetry, /Fiction Grant/);

  const grants = (await callTool('search_listings', { type: 'grant' })).content[0].text;
  assert.match(grants, /^1 Callboard listing matched/);

  const newYork = (await callTool('search_listings', { query: 'new york' })).content[0].text;
  assert.match(newYork, /Fiction Grant 2027/);
  assert.doesNotMatch(newYork, /Open Poetry Prize/);

  const soon = (await callTool('search_listings', { closing_before: '2026-12-31' })).content[0].text;
  assert.match(soon, /Open Poetry Prize/);
  assert.doesNotMatch(soon, /Rolling Photo Call/);
  assert.doesNotMatch(soon, /Fiction Grant 2027/);

  const closed = (await callTool('search_listings', { status: 'recently_closed' })).content[0].text;
  assert.match(closed, /Closed Residency/);
  assert.doesNotMatch(closed, /Open Poetry Prize/);
});

test('search refuses bad filters with a plain explanation instead of failing', async () => {
  for (const args of [{ type: 'job' }, { discipline: 'Dance' }, { closing_before: 'next week' }, { limit: 500 }, { status: 'expired' }]) {
    const result = await callTool('search_listings', args);
    assert.equal(result.isError, true, JSON.stringify(args));
  }
});

test('an unsafe link is never passed on', async () => {
  const text = (await callTool('get_listing', { id: 'bad-link-call' })).content[0].text;
  assert.doesNotMatch(text, /javascript:/);
  assert.match(text, /Official page: Link unavailable/);
});

test('get_listing returns the full listing, including its AI policy and a report link', async () => {
  const text = (await callTool('get_listing', { id: 'open-poetry-prize' })).content[0].text;
  assert.match(text, /AI policy: No AI-generated work\./);
  assert.match(text, /Official page: https:\/\/example\.org\/poetry/);
  assert.match(text, /Report a problem with this listing: https:\/\/tally\.so\//);

  const missing = await callTool('get_listing', { id: 'no-such-listing' });
  assert.equal(missing.isError, true);
});

test('protocol edge cases get the standard answers', async () => {
  assert.equal((await post({ jsonrpc: '2.0', method: 'notifications/initialized' })).status, 202);
  assert.equal((await post('{not json')).body.error.code, -32700);
  assert.equal((await post({ jsonrpc: '2.0', id: 3, method: 'resources/list' })).body.error.code, -32601);
  assert.equal((await post({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'delete_listing' } })).body.error.code, -32602);

  const get = await handleMcpHttp(new Request('https://callboard.smythbook.com/mcp'), sample, { today });
  assert.equal(get.status, 405);

  const huge = await post({ jsonrpc: '2.0', id: 5, method: 'ping', params: { padding: 'x'.repeat(70 * 1024) } });
  assert.equal(huge.status, 413);
});

test('every real listing gets its own id', async () => {
  const listings = JSON.parse(await readFile(new URL('../src/listings.json', import.meta.url), 'utf8'));
  const ids = listings.map((listing) => listingId(listing.name));
  for (const id of ids) assert.match(id, /^[a-z0-9]+(-[a-z0-9]+)*$/);
  assert.equal(new Set(ids).size, ids.length, 'two listings would share an id; rename one');
});

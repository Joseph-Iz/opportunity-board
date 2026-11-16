import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { campusKinds, campusStatuses, storedCampusScopes } from '../src/campus-rules.ts';
import { isDeadlineOpen, safeOfficialUrl } from '../src/listing-rules.ts';

// The campus edition preview holds campus and Utah opportunities in their own file. They get
// the same kind of checks as the national board, so a typo cannot reach the page.
const entries = JSON.parse(await readFile(new URL('../src/campus-listings.json', import.meta.url), 'utf8'));
const textFields = ['name', 'scope', 'kind', 'status', 'deadline', 'timing', 'award', 'eligibility', 'firstStep', 'link', 'verified', 'note', 'caveat'];

function isRealCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

test('every campus entry has the expected fields and known values', () => {
  assert.ok(Array.isArray(entries) && entries.length > 0, 'campus-listings.json should contain a list');
  const names = new Set();
  for (const entry of entries) {
    for (const field of textFields) {
      assert.equal(typeof entry[field], 'string', `${entry.name ?? 'An entry'} needs a text "${field}" (use "" when it does not apply)`);
    }
    assert.equal(typeof entry.feeStated, 'boolean', `${entry.name} needs "feeStated": true only when the official page says in words that there is no fee`);
    assert.ok(storedCampusScopes.includes(entry.scope), `${entry.name} has an unknown scope: ${entry.scope}`);
    assert.ok(campusKinds.includes(entry.kind), `${entry.name} has an unknown kind: ${entry.kind}`);
    assert.ok(campusStatuses.includes(entry.status), `${entry.name} has an unknown status: ${entry.status}`);
    assert.ok(isRealCalendarDate(entry.verified), `${entry.name} has an invalid verified date`);
    assert.ok(!names.has(entry.name), `${entry.name} is listed twice`);
    names.add(entry.name);
    for (const field of ['name', 'award', 'eligibility', 'note']) {
      assert.ok(entry[field].trim().length > 0, `${entry.name} has an empty "${field}"`);
    }
  }
});

test('each status carries what the page needs to show it', () => {
  for (const entry of entries) {
    if (entry.status === 'open') {
      assert.ok(isRealCalendarDate(entry.deadline), `${entry.name} is open, so it needs a real deadline date`);
      assert.ok(entry.firstStep.trim().length > 0, `${entry.name} is open, so it needs a first step`);
    } else {
      assert.equal(entry.deadline, '', `${entry.name} is not open, so its deadline should be ""`);
    }
    if (entry.status === 'coming-up') {
      assert.ok(entry.timing.trim().length > 0, `${entry.name} is coming up, so it needs a "timing" sentence`);
    }
  }
});

test('every campus link passes the page safety check', () => {
  for (const entry of entries) {
    assert.ok(safeOfficialUrl(entry.link), `${entry.name} has a link the page would refuse: ${entry.link}`);
  }
});

test('every open campus entry was verified within the last 45 days', () => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const oldestAllowed = today.getTime() - 45 * 24 * 60 * 60 * 1000;
  const todayKey = localDateKey();
  for (const entry of entries.filter((e) => e.status === 'open' && isDeadlineOpen(e.deadline, todayKey))) {
    const verifiedTime = new Date(`${entry.verified}T00:00:00.000Z`).getTime();
    assert.ok(
      verifiedTime <= today.getTime() && verifiedTime >= oldestAllowed,
      `${entry.name} was verified on ${entry.verified}, outside the last 45 days`,
    );
  }
});

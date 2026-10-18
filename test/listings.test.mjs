import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { filterDisciplineLabels, filterTypeLabels, isDeadlineOpen } from '../src/listing-rules.ts';

const listingsUrl = new URL('../src/listings.json', import.meta.url);
const listings = JSON.parse(await readFile(listingsUrl, 'utf8'));
const requiredFields = [
  'name',
  'type',
  'discipline',
  'deadline',
  'fee',
  'award',
  'eligibility',
  'link',
  'verified',
  'note',
];

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isRealCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  // JavaScript normalizes impossible dates, so comparing the result catches values like February 30.
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

test('every listing includes all required fields in the expected format', () => {
  assert.ok(Array.isArray(listings) && listings.length > 0, 'listings.json should contain a list');

  for (const [index, listing] of listings.entries()) {
    for (const field of requiredFields) {
      assert.ok(Object.hasOwn(listing, field), `Listing ${index + 1} is missing "${field}"`);
    }
    assert.equal(typeof listing.name, 'string', `Listing ${index + 1} needs a name`);
    assert.equal(typeof listing.type, 'string', `Listing ${index + 1} needs a type`);
    assert.ok(Array.isArray(listing.discipline) && listing.discipline.length > 0, `Listing ${index + 1} needs at least one discipline`);
    assert.ok(listing.deadline === 'rolling' || isRealCalendarDate(listing.deadline), `Listing ${index + 1} has an invalid deadline`);
    assert.equal(typeof listing.fee, 'number', `Listing ${index + 1} needs a numeric fee`);
    for (const field of ['award', 'eligibility', 'link', 'verified', 'note']) {
      assert.equal(typeof listing[field], 'string', `Listing ${index + 1} needs a text "${field}"`);
    }
    assert.ok(isRealCalendarDate(listing.verified), `Listing ${index + 1} has an invalid verified date`);
    if (Object.hasOwn(listing, 'disclaimer')) {
      assert.ok(typeof listing.disclaimer === 'string' && listing.disclaimer.trim().length > 0, `Listing ${index + 1} has an empty disclaimer`);
    }
  }
});

test('every official link starts with https', () => {
  for (const listing of listings) {
    assert.ok(listing.link.startsWith('https://'), `${listing.name} must use an https link`);
  }
});

test('every listing was verified within the last 45 days', () => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const oldestAllowed = today.getTime() - 45 * 24 * 60 * 60 * 1000;

  for (const listing of listings) {
    const verifiedTime = new Date(`${listing.verified}T00:00:00.000Z`).getTime();
    assert.ok(
      verifiedTime <= today.getTime() && verifiedTime >= oldestAllowed,
      `${listing.name} was verified on ${listing.verified}, outside the last 45 days`,
    );
  }
});

test('past-deadline listings are excluded from the displayed list', () => {
  const todayKey = localDateKey();
  const displayed = listings.filter((listing) => isDeadlineOpen(listing.deadline, todayKey));
  const expiredEntries = listings.filter(
    (listing) => listing.deadline !== 'rolling' && listing.deadline < todayKey,
  );

  assert.equal(isDeadlineOpen('2000-01-01', todayKey), false, 'a past deadline should be closed');
  assert.ok(
    displayed.every((listing) => listing.deadline === 'rolling' || listing.deadline >= todayKey),
    'the displayed list should not include a past deadline',
  );
  assert.equal(
    expiredEntries.length,
    0,
    `Past-deadline listing(s) remain in listings.json: ${expiredEntries.map((listing) => listing.name).join(', ')}. Remove or update them.`,
  );
});

test('every listing type and discipline is available in the filters', () => {
  const knownTypes = new Set(filterTypeLabels.slice(1).map((type) => type.toLowerCase()));
  const knownDisciplines = new Set(filterDisciplineLabels.slice(1));

  for (const listing of listings) {
    assert.ok(knownTypes.has(listing.type), `${listing.name} has a type the filters do not know: ${listing.type}`);
    for (const discipline of listing.discipline) {
      assert.ok(knownDisciplines.has(discipline), `${listing.name} has a discipline the filters do not know: ${discipline}`);
    }
  }
});

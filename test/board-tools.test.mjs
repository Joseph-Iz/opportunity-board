import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { calendarFileFor, fitsStage, matchesSearch } from '../src/listing-rules.ts';

const listings = JSON.parse(await readFile(new URL('../src/listings.json', import.meta.url), 'utf8'));
const find = (query) => listings.filter((item) => matchesSearch(item, query)).map((item) => item.name);

test('search matches every word, ignoring case and accents', () => {
  const item = { name: 'Café Review', type: 'submission', discipline: ['Poetry'], award: '$50', eligibility: 'Students welcome', note: 'Chapbooks too' };
  assert.ok(matchesSearch(item, 'cafe chapbooks'));
  assert.ok(matchesSearch(item, '  POETRY   students '));
  assert.ok(matchesSearch(item, ''));
  assert.ok(!matchesSearch(item, 'poetry grant'));
});

test('search finds the calls the three walkthrough visitors would look for', () => {
  assert.ok(find('students').includes('The Aftermath Project Post-Conflict Grant 2026'), 'student exclusions must be searchable');
  assert.ok(find('first book').length > 0);
  assert.ok(find('playwriting fellowship').length >= 2);
});

test('the calendar file holds the deadline as an all-day event with a week-ahead reminder', () => {
  const ics = calendarFileFor({ name: 'Baltimore Review, Fall; 2026', deadline: '2026-11-30', link: 'https://baltimorereview.org/submit' }, new Date('2026-11-22T12:00:00Z'));
  assert.match(ics, /DTSTART;VALUE=DATE:20261130\r\n/);
  assert.match(ics, /DTEND;VALUE=DATE:20261201\r\n/);
  assert.ok(ics.includes('SUMMARY:Deadline: Baltimore Review\\, Fall\\; 2026\r\n'), 'commas and semicolons must be escaped');
  assert.match(ics, /TRIGGER:-P7D/);
  assert.match(ics, /URL:https:\/\/baltimorereview.org\/submit/);
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.trimEnd().endsWith('END:VCALENDAR'));
});

test('no calendar file for rolling deadlines, and unsafe links are left out', () => {
  assert.equal(calendarFileFor({ name: 'x', deadline: 'rolling', link: 'https://a.org' }), null);
  const ics = calendarFileFor({ name: 'x', deadline: '2026-12-31', link: 'javascript:alert(1)' });
  assert.ok(!ics.includes('javascript'));
  assert.ok(calendarFileFor({ name: 'x', deadline: '2026-12-31', link: 'https://a.org' }).includes('DTEND;VALUE=DATE:20270101'));
});

test('the career-stage filter matches who is looking', () => {
  const early = { stage: 'early' };
  const open = { stage: 'open' };
  const established = { stage: 'established' };
  const noStudents = { stage: 'open', studentNote: 'Full-time students are not eligible.' };
  assert.deepEqual([early, open, established, noStudents].map((item) => fitsStage(item, 'Student')), [true, true, false, false]);
  assert.deepEqual([early, open, established, noStudents].map((item) => fitsStage(item, 'Starting out')), [true, true, false, true]);
  assert.deepEqual([early, open, established, noStudents].map((item) => fitsStage(item, 'Established')), [false, true, true, true]);
  assert.ok(fitsStage(established, 'All'));
});

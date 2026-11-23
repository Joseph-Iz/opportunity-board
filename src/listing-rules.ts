// These are shared by the filter chips and the data test so they cannot quietly drift apart.
const listingTypes = ['submission', 'grant', 'residency', 'fellowship', 'contest'] as const;

export const filterTypeLabels = [
  'All',
  ...listingTypes.map((type) => type[0].toUpperCase() + type.slice(1)),
] as const;

export const filterDisciplineLabels = [
  'All',
  'Poetry',
  'Fiction',
  'Nonfiction',
  'Photography',
  'Visual art',
  'Screenwriting',
  'Playwriting',
] as const;

export function isDeadlineOpen(deadline: string, todayKey: string): boolean {
  // ISO dates sort in calendar order as text; rolling deadlines stay open until manually changed.
  return deadline === 'rolling' || deadline >= todayKey;
}

// A closed call stays in listings.json and is shown under "Recently closed" for this many days
// after its deadline, so a visitor who saw it last week can find it and plan for the next round.
export const RECENTLY_CLOSED_DAYS = 90;

export function isRecentlyClosed(deadline: string, todayKey: string): boolean {
  if (deadline === 'rolling' || deadline >= todayKey) return false;
  const [y, m, d] = todayKey.split('-').map(Number);
  const cutoff = new Date(Date.UTC(y, m - 1, d - RECENTLY_CLOSED_DAYS)).toISOString().slice(0, 10);
  return deadline >= cutoff;
}

export function safeOfficialUrl(link: string): string | null {
  // Listing data is reviewed by a person, but the page still refuses anything other than a
  // plain https web address, so a bad entry can never become a script link (javascript:),
  // an embedded data: page, an insecure http page, or a URL hiding a login (user:pass@).
  try {
    const url = new URL(link);
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.')) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

// Visitors report a problem with a listing through a short anonymous Tally form. Passing the
// listing's name fills in the form's "Which listing?" question so the report is easy to match.
export const reportFormUrl = 'https://tally.so/r/YjDNQB';

export function reportUrlFor(listingName?: string): string {
  return listingName ? `${reportFormUrl}?listing=${encodeURIComponent(listingName)}` : reportFormUrl;
}

// The board's search box: every word typed must appear somewhere in the listing (its name,
// who can apply, the award, the fee note, the description, its art forms or its type).
// Accents and capital letters are ignored, so "chapbook" finds "Chapbook" and "resume" finds "résumé".
type Searchable = {
  name: string; type: string; discipline: string[]; award: string; eligibility: string; note: string;
  feeCondition?: string; pays?: string; aiPolicy?: string; disclaimer?: string;
};

const fold = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function matchesSearch(item: Searchable, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = fold([
    item.name, item.type, item.discipline.join(' '), item.award, item.eligibility, item.note,
    item.feeCondition ?? '', item.pays ?? '', item.aiPolicy ?? '', item.disclaimer ?? '',
  ].join(' '));
  return words.every((word) => haystack.includes(word));
}

// "Add to calendar": a small calendar file (.ics, which Apple, Google and Outlook calendars all
// open) holding the deadline as an all-day event, with a reminder a week before. It is built in
// the visitor's browser and never sent anywhere.
const icsText = (text: string) => text.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');

export function calendarFileFor(item: { name: string; deadline: string; link: string }, now: Date = new Date()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(item.deadline)) return null;
  const start = item.deadline.replaceAll('-', '');
  const [y, m, d] = item.deadline.split('-').map(Number);
  const end = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10).replaceAll('-', '');
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const link = safeOfficialUrl(item.link);
  const uidName = item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Callboard//Deadlines//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uidName}-${start}@callboard.smythbook.com`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${icsText(`Deadline: ${item.name}`)}`,
    `DESCRIPTION:${icsText(`Check the deadline and rules on the official page before you submit.${link ? `\n${link}` : ''}\nFound on Callboard (callboard.smythbook.com).`)}`,
    ...(link ? [`URL:${link}`] : []),
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsText(`One week left: ${item.name}`)}`,
    'TRIGGER:-P7D',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

// Career stage. Each open listing carries one tag, read from its own "who can apply" text:
//   early        – capped by experience (no book yet, at most two produced plays, "emerging")
//   open         – any career stage may apply
//   established  – needs a track record (working journalists, a confirmed exhibition)
// A listing can also carry a studentNote when degree students (or most undergraduates) can't apply.
// The board's "Career stage" filter is phrased by who is looking, not by the tag names.
export const listingStages = ['early', 'open', 'established'] as const;
export type ListingStage = (typeof listingStages)[number];

export const stageTagLabels: Record<ListingStage, string> = {
  early: 'Early-career only',
  open: 'Open to all stages',
  established: 'Needs a track record',
};

export const stageFilterLabels = ['All', 'Student', 'Starting out', 'Established'] as const;

export function fitsStage(item: { stage?: string; studentNote?: string }, filter: string): boolean {
  const stage = item.stage ?? 'open';
  switch (filter) {
    case 'Student': return stage !== 'established' && !item.studentNote;
    case 'Starting out': return stage !== 'established';
    case 'Established': return stage !== 'early';
    default: return true;
  }
}

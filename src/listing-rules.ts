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

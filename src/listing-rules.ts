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
] as const;

export function isDeadlineOpen(deadline: string, todayKey: string): boolean {
  // ISO dates sort in calendar order as text; rolling deadlines stay open until manually changed.
  return deadline === 'rolling' || deadline >= todayKey;
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

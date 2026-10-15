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

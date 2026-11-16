// Shared by the campus edition page and its data test so the two cannot quietly drift apart.

// Where an opportunity comes from. "national" is not stored in campus-listings.json: the page
// adds the national board's open listings itself, so a call is never typed in twice.
export const campusScopeLabels = {
  campus: 'On campus',
  utah: 'Utah',
  national: 'National',
} as const;

export type CampusScope = keyof typeof campusScopeLabels;

// The scopes a campus-listings.json entry may use.
export const storedCampusScopes = ['campus', 'utah'] as const;

export const campusKinds = [
  'scholarship',
  'research funding',
  'fellowship',
  'grant',
  'submission',
  'contest',
  'conference',
] as const;

// open: taking applications now, with a dated deadline.
// coming-up: runs every year, but this round's dates are not posted yet (or it just closed).
// left-off: checked and deliberately not listed, with the reason shown, so students do not
//           spend an evening on a call that excludes them.
export const campusStatuses = ['open', 'coming-up', 'left-off'] as const;

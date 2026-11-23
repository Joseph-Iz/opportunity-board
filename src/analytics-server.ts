// Callboard's visit counter: the server half.
//
// The website sends a tiny message here when a page is viewed or a button is used ("someone
// opened the board", "someone clicked through to The Baltimore Review"). This file checks the
// message against a short list of allowed events and adds one to a daily tally. It keeps no
// record of who sent it: no IP address, no browser details, no cookies, no ID of any kind.
// A tally row looks like: 2026-11-23 · official · The Baltimore Review · 14.
//
// The tallies live in a Cloudflare D1 database (a small SQL database) bound to the site as DB.
// If that database isn't connected yet, the counter quietly does nothing, so the site works
// either way. The live address is https://callboard.smythbook.com/api/hit (functions/api/hit.ts).

export type CounterDb = {
  prepare(query: string): { bind(...values: unknown[]): { run(): Promise<unknown> } };
};

type NamedRow = { name: string };

// Messages are a few dozen bytes; anything larger is refused before it is read.
const MAX_BODY_BYTES = 1024;

export const pageNames = ['board', 'campus', 'prepare', 'privacy', 'claude'] as const;
export const reportPlaces = ['card', 'details', 'header', 'footer', 'guide'] as const;
const filterGroups = ['type', 'discipline', 'stage'] as const;

// Search crawlers and link-preview bots don't usually run the page's code, but some do.
const botPattern = /bot|crawl|spider|slurp|preview|headless|lighthouse/i;

// The table is created once from scripts/counter-schema.sql.
const INCREMENT_SQL = `INSERT INTO counts (day, event, detail, n) VALUES (?1, ?2, ?3, 1)
  ON CONFLICT (day, event, detail) DO UPDATE SET n = n + 1`;

type Tally = { event: string; detail: string };

const isOneOf = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (list as readonly string[]).includes(value);

// Turns one message from the site into the tallies to add, or null if it isn't a message the
// site would send. Listing names must match a real listing exactly, so the tallies can only
// ever hold names already public on the board, never free text someone typed.
export function talliesFor(message: unknown, listingNames: Set<string>, filterValues: Set<string>): Tally[] | null {
  if (!message || typeof message !== 'object' || Array.isArray(message)) return null;
  const m = message as Record<string, unknown>;
  const listing = typeof m.listing === 'string' && listingNames.has(m.listing) ? m.listing : null;

  switch (m.event) {
    case 'view': {
      if (!isOneOf(pageNames, m.page) || typeof m.returning !== 'boolean') return null;
      const tallies: Tally[] = [{ event: 'view', detail: `${m.page}|${m.returning ? 'returning' : 'new'}` }];
      // Where the visit came from, as a bare site name like "bsky.app" (never a full address).
      if (typeof m.source === 'string' && /^[a-z0-9.-]{1,80}$/.test(m.source) && m.source.includes('.')) {
        tallies.push({ event: 'source', detail: m.source.replace(/^www\./, '') });
      }
      return tallies;
    }
    case 'official':
    case 'save':
    case 'share':
    case 'calendar':
      return listing ? [{ event: m.event, detail: listing }] : null;
    case 'report': {
      if (!isOneOf(reportPlaces, m.place)) return null;
      return [{ event: 'report', detail: listing ? `${m.place}|${listing}` : m.place }];
    }
    case 'filter': {
      if (!isOneOf(filterGroups, m.group) || typeof m.value !== 'string' || !filterValues.has(m.value)) return null;
      return [{ event: 'filter', detail: `${m.group}|${m.value}` }];
    }
    default:
      return null;
  }
}

const noContent = () => new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });

export async function handleCounter(
  request: Request,
  db: CounterDb | undefined,
  listings: NamedRow[],
  filterValues: string[],
  now: Date = new Date(),
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
  }
  // Only count messages sent by Callboard's own pages.
  const origin = request.headers.get('Origin');
  if (origin && new URL(request.url).origin !== origin) return new Response('Forbidden', { status: 403 });
  if (botPattern.test(request.headers.get('User-Agent') ?? '')) return noContent();

  const length = Number(request.headers.get('Content-Length') ?? '0');
  if (length > MAX_BODY_BYTES) return new Response('Too large', { status: 413 });
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return new Response('Too large', { status: 413 });

  let message: unknown;
  try {
    message = JSON.parse(text);
  } catch {
    return new Response('Bad request', { status: 400 });
  }
  const tallies = talliesFor(message, new Set(listings.map((row) => row.name)), new Set(filterValues));
  if (!tallies) return new Response('Bad request', { status: 400 });
  if (!db) return noContent();

  const day = now.toISOString().slice(0, 10);
  try {
    for (const tally of tallies) {
      await db.prepare(INCREMENT_SQL).bind(day, tally.event, tally.detail).run();
    }
  } catch (error) {
    // A counting failure must never affect a visitor; log it for the Cloudflare dashboard.
    console.error('Visit counter could not save a tally.', error);
  }
  return noContent();
}

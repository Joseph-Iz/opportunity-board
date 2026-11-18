import { filterDisciplineLabels, isDeadlineOpen, isRecentlyClosed, reportUrlFor, safeOfficialUrl } from './listing-rules.ts';

// Callboard's connector for Claude and other AI assistants (an "MCP server").
//
// It lets an assistant search the same public listings the website shows and open one listing
// in full. It is read-only on purpose: it can't add, change or delete anything, it needs no
// sign-in, and it keeps no record of what anyone searched for. The live address is
// https://callboard.smythbook.com/mcp, served by functions/mcp.ts on Cloudflare Pages.
//
// MCP (Model Context Protocol) is the open standard Claude uses to talk to connectors. Each
// request is a small JSON message ("JSON-RPC"): the assistant asks which tools exist, then calls
// one with some search filters, and gets plain text back. This file answers those messages.

export type Listing = {
  name: string;
  type: string;
  discipline: string[];
  deadline: string;
  fee: number;
  feeCondition: string;
  award: string;
  eligibility: string;
  link: string;
  verified: string;
  note: string;
  disclaimer?: string;
  pays?: string;
  aiPolicy?: string;
};

const SERVER_VERSION = '1.0.0';

// Protocol versions this server understands, newest first. If an assistant asks for one we
// don't know, we answer with the newest and it decides whether it can carry on.
const SUPPORTED_PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

// Requests are a few hundred bytes; anything far larger is refused before it is read.
const MAX_BODY_BYTES = 64 * 1024;

const MAX_RESULTS = 50;
const DEFAULT_RESULTS = 20;

const listingTypes = ['submission', 'grant', 'residency', 'fellowship', 'contest'];
const disciplines = filterDisciplineLabels.filter((label) => label !== 'All');

const instructions = [
  'Callboard (callboard.smythbook.com) is a free, ad-free board of opportunities for emerging writers and artists in the US:',
  'calls for submissions, grants, residencies, fellowships and contests.',
  'Every listing is free to apply and was checked by a person against the organization\'s own page on the "last verified" date shown.',
  'Use search_listings to find opportunities and get_listing for one listing in full.',
  'Details can change after a listing is verified, so always tell the user to confirm the deadline and rules on the official page before applying.',
].join(' ');

const tools = [
  {
    name: 'search_listings',
    title: 'Search Callboard listings',
    description: [
      'Search Callboard\'s human-verified, free-to-apply opportunities for writers, photographers and visual artists:',
      'calls for submissions, grants, residencies, fellowships and contests open to US adults.',
      'Returns matching listings sorted by deadline (soonest first), each with its id, deadline, fee, award, eligibility,',
      'official page link and the date a person last verified it. Only open listings are returned unless status says otherwise.',
      'All filters are optional; with none, it returns the open listings closing soonest.',
    ].join(' '),
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Words to look for in the title, award, eligibility and description, for example "chapbook" or "Black women" or "New York". Every word must match.',
        },
        type: {
          type: 'string',
          enum: listingTypes,
          description: 'Only this kind of opportunity.',
        },
        discipline: {
          type: 'string',
          enum: disciplines,
          description: 'Only listings open to this art form.',
        },
        closing_before: {
          type: 'string',
          description: 'Only listings with a deadline on or before this date (YYYY-MM-DD). Rolling listings, which have no deadline, are left out when this is set.',
        },
        closing_after: {
          type: 'string',
          description: 'Only listings with a deadline on or after this date (YYYY-MM-DD).',
        },
        status: {
          type: 'string',
          enum: ['open', 'recently_closed', 'all'],
          description: '"open" (default) for calls still taking applications; "recently_closed" for calls whose deadline passed in the last 90 days, useful for planning for the next round; "all" for both.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: MAX_RESULTS,
          description: `How many listings to return at most (default ${DEFAULT_RESULTS}).`,
        },
      },
      additionalProperties: false,
    },
    annotations: {
      title: 'Search Callboard listings',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'get_listing',
    title: 'Get a Callboard listing',
    description: 'Get one Callboard listing in full by its id (as returned by search_listings): deadline, fee details, award, eligibility, description, what it pays contributors and its AI policy where the official page states them, the official page link, the date it was last verified, and a link for reporting a problem with the listing.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The listing id from search_listings, for example "trillium-arts-individual-artist-residencies-2027".',
        },
      },
      required: ['id'],
      additionalProperties: false,
    },
    annotations: {
      title: 'Get a Callboard listing',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
];

// A stable, readable id made from the listing's name, since listings.json has no id field.
// A test checks that no two listings end up with the same id.
export function listingId(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

// Deadlines are judged by the calendar date on the US West Coast, so a call that closes "today"
// still shows as open for visitors across the country until the day is over there.
export function todayKey(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

const isDateKey = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const fold = (text: string) => text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();

const longDate = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
  month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
});

const capitalize = (text: string) => text[0].toUpperCase() + text.slice(1);

const feeText = (listing: Listing) => listing.feeCondition || 'No fee to apply';

const deadlineText = (listing: Listing, today: string) => {
  if (listing.deadline === 'rolling') return 'Rolling (no fixed deadline)';
  const closed = !isDeadlineOpen(listing.deadline, today);
  return `${longDate(listing.deadline)}${closed ? ' (closed)' : ''}`;
};

const linkText = (listing: Listing) => safeOfficialUrl(listing.link) ?? 'Link unavailable';

function summary(listing: Listing, today: string, position: number): string {
  return [
    `${position}. ${listing.name}`,
    `   id: ${listingId(listing.name)}`,
    `   Type: ${capitalize(listing.type)} · For: ${listing.discipline.join(', ')}`,
    `   Deadline: ${deadlineText(listing, today)}`,
    `   Fee: ${feeText(listing)}`,
    `   Award: ${listing.award}`,
    `   Eligibility: ${listing.eligibility}`,
    `   Official page: ${linkText(listing)}`,
    `   Last verified: ${longDate(listing.verified)}`,
  ].join('\n');
}

function detail(listing: Listing, today: string): string {
  const lines = [
    listing.name,
    `id: ${listingId(listing.name)}`,
    `Type: ${capitalize(listing.type)}`,
    `For: ${listing.discipline.join(', ')}`,
    `Deadline: ${deadlineText(listing, today)}`,
    `Fee: ${feeText(listing)}`,
    `Award: ${listing.award}`,
    `Eligibility: ${listing.eligibility}`,
    `About: ${listing.note}`,
  ];
  if (listing.disclaimer?.trim()) lines.push(`Good to know: ${listing.disclaimer}`);
  if (listing.pays?.trim()) lines.push(`Pay: ${listing.pays}`);
  if (listing.aiPolicy?.trim()) lines.push(`AI policy: ${listing.aiPolicy}`);
  lines.push(
    `Official page: ${linkText(listing)}`,
    `Last verified by a person: ${longDate(listing.verified)}`,
    `Report a problem with this listing: ${reportUrlFor(listing.name)}`,
    '',
    'Confirm the deadline and guidelines on the official page before applying.',
  );
  return lines.join('\n');
}

type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean };

const textResult = (text: string, isError = false): ToolResult =>
  isError ? { content: [{ type: 'text', text }], isError: true } : { content: [{ type: 'text', text }] };

export function searchListings(listings: Listing[], args: Record<string, unknown>, today: string): ToolResult {
  const { query, type, discipline, closing_before, closing_after, status = 'open', limit = DEFAULT_RESULTS } = args;

  if (query !== undefined && typeof query !== 'string') return textResult('query must be text.', true);
  if (type !== undefined && !listingTypes.includes(String(type).toLowerCase())) {
    return textResult(`type must be one of: ${listingTypes.join(', ')}.`, true);
  }
  const disciplineMatch = discipline === undefined
    ? undefined
    : disciplines.find((label) => label.toLowerCase() === String(discipline).toLowerCase());
  if (discipline !== undefined && !disciplineMatch) {
    return textResult(`discipline must be one of: ${disciplines.join(', ')}.`, true);
  }
  if (closing_before !== undefined && !isDateKey(closing_before)) return textResult('closing_before must be a date written YYYY-MM-DD.', true);
  if (closing_after !== undefined && !isDateKey(closing_after)) return textResult('closing_after must be a date written YYYY-MM-DD.', true);
  if (!['open', 'recently_closed', 'all'].includes(String(status))) {
    return textResult('status must be "open", "recently_closed" or "all".', true);
  }
  const max = Number(limit);
  if (!Number.isInteger(max) || max < 1 || max > MAX_RESULTS) {
    return textResult(`limit must be a whole number from 1 to ${MAX_RESULTS}.`, true);
  }

  const words = typeof query === 'string' ? fold(query).split(/\s+/).filter(Boolean) : [];

  const matches = listings.filter((listing) => {
    const open = isDeadlineOpen(listing.deadline, today);
    const recentlyClosed = isRecentlyClosed(listing.deadline, today);
    if (status === 'open' && !open) return false;
    if (status === 'recently_closed' && !recentlyClosed) return false;
    if (status === 'all' && !open && !recentlyClosed) return false;
    if (type !== undefined && listing.type !== String(type).toLowerCase()) return false;
    if (disciplineMatch && !listing.discipline.includes(disciplineMatch)) return false;
    if (closing_before !== undefined && (listing.deadline === 'rolling' || listing.deadline > closing_before)) return false;
    if (closing_after !== undefined && listing.deadline !== 'rolling' && listing.deadline < closing_after) return false;
    if (words.length) {
      const haystack = fold([
        listing.name, listing.type, listing.discipline.join(' '), listing.award, listing.eligibility,
        listing.note, listing.feeCondition, listing.disclaimer ?? '', listing.pays ?? '', listing.aiPolicy ?? '',
      ].join(' '));
      if (!words.every((word) => haystack.includes(word))) return false;
    }
    return true;
  });

  // Soonest deadline first; rolling calls (no deadline) after the dated ones.
  matches.sort((a, b) => {
    if (a.deadline === b.deadline) return a.name.localeCompare(b.name);
    if (a.deadline === 'rolling') return 1;
    if (b.deadline === 'rolling') return -1;
    return a.deadline < b.deadline ? -1 : 1;
  });

  if (!matches.length) {
    return textResult('No Callboard listings match those filters. Try fewer filters, or set status to "all" to include calls that closed in the last 90 days.');
  }

  const shown = matches.slice(0, max);
  const header = `${matches.length} Callboard listing${matches.length === 1 ? '' : 's'} matched${matches.length > shown.length ? `; showing the first ${shown.length}` : ''}. Every listing is free to apply.`;
  const footer = 'Use get_listing with an id for the full details. Confirm deadlines and guidelines on the official page before applying.';
  return textResult([header, '', shown.map((listing, index) => summary(listing, today, index + 1)).join('\n\n'), '', footer].join('\n'));
}

export function getListing(listings: Listing[], args: Record<string, unknown>, today: string): ToolResult {
  const { id } = args;
  if (typeof id !== 'string' || !id.trim()) return textResult('id is required: use an id from search_listings.', true);
  const wanted = listingId(id);
  const listing = listings.find((item) => listingId(item.name) === wanted);
  if (!listing) return textResult(`No Callboard listing has the id "${id}". Use search_listings to find the right id.`, true);
  return textResult(detail(listing, today));
}

// ---- JSON-RPC message handling -------------------------------------------------------------

type JsonRpcId = string | number | null;
type JsonRpcResponse =
  | { jsonrpc: '2.0'; id: JsonRpcId; result: unknown }
  | { jsonrpc: '2.0'; id: JsonRpcId; error: { code: number; message: string } };

const rpcError = (id: JsonRpcId, code: number, message: string): JsonRpcResponse => ({ jsonrpc: '2.0', id, error: { code, message } });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Answers one JSON-RPC message. Returns null for notifications, which get no answer.
export function handleMessage(message: unknown, listings: Listing[], today: string): JsonRpcResponse | null {
  if (!isRecord(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    const id = isRecord(message) && (typeof message.id === 'string' || typeof message.id === 'number') ? message.id : null;
    // A response sent back to us (it has an id but no method) needs no answer.
    if (isRecord(message) && message.method === undefined && ('result' in message || 'error' in message)) return null;
    return rpcError(id, -32600, 'Invalid request');
  }
  const isNotification = !('id' in message);
  const id: JsonRpcId = typeof message.id === 'string' || typeof message.id === 'number' ? message.id : null;
  if (isNotification) return null;

  const params = isRecord(message.params) ? message.params : {};

  switch (message.method) {
    case 'initialize': {
      const requested = typeof params.protocolVersion === 'string' ? params.protocolVersion : '';
      const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : SUPPORTED_PROTOCOL_VERSIONS[0];
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'callboard', title: 'Callboard', version: SERVER_VERSION, websiteUrl: 'https://callboard.smythbook.com' },
          instructions,
        },
      };
    }
    case 'ping':
      return { jsonrpc: '2.0', id, result: {} };
    case 'tools/list':
      return { jsonrpc: '2.0', id, result: { tools } };
    case 'tools/call': {
      const args = isRecord(params.arguments) ? params.arguments : {};
      if (params.name === 'search_listings') return { jsonrpc: '2.0', id, result: searchListings(listings, args, today) };
      if (params.name === 'get_listing') return { jsonrpc: '2.0', id, result: getListing(listings, args, today) };
      return rpcError(id, -32602, `Unknown tool: ${String(params.name)}`);
    }
    default:
      return rpcError(id, -32601, `Method not found: ${message.method}`);
  }
}

// ---- HTTP ("Streamable HTTP" transport, stateless) ------------------------------------------

// The data is public and nothing can be changed through this endpoint, so any website may call
// it (for example MCP Inspector, a browser-based testing tool). Nothing here uses cookies.
const baseHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id, Mcp-Protocol-Version',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...baseHeaders, 'Content-Type': 'application/json' } });

export async function handleMcpHttp(request: Request, listings: Listing[], options: { today?: string } = {}): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: baseHeaders });

  if (request.method !== 'POST') {
    // This server never pushes messages on its own, so there is no stream to open with GET.
    return new Response('Callboard connector: send MCP requests with POST. Setup help: https://callboard.smythbook.com/#claude\n', {
      status: 405,
      headers: { ...baseHeaders, Allow: 'POST, OPTIONS', 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const declaredLength = Number(request.headers.get('content-length') ?? '0');
  if (declaredLength > MAX_BODY_BYTES) return json(rpcError(null, -32600, 'Request too large'), 413);

  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return json(rpcError(null, -32600, 'Request too large'), 413);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(rpcError(null, -32700, 'Parse error'), 400);
  }

  const today = options.today ?? todayKey();

  // Older clients may send several messages at once in a list.
  if (Array.isArray(body)) {
    if (!body.length || body.length > 20) return json(rpcError(null, -32600, 'Invalid request'), 400);
    const answers = body.map((message) => handleMessage(message, listings, today)).filter((answer) => answer !== null);
    return answers.length ? json(answers) : new Response(null, { status: 202, headers: baseHeaders });
  }

  const answer = handleMessage(body, listings, today);
  return answer ? json(answer) : new Response(null, { status: 202, headers: baseHeaders });
}

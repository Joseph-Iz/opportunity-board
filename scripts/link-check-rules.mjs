// Pure decision rules for the weekly link check, kept separate so they can be unit-tested
// without touching the network.

const stripWww = (host) => host.toLowerCase().replace(/^www\./, '');

// Two hosts count as the same site when one is the other or a subdomain of it
// (poets.org -> www.poets.org or submit.poets.org is fine; poets.org -> poets-prize.net is not).
export function isSameSite(fromHost, toHost) {
  const from = stripWww(fromHost);
  const to = stripWww(toHost);
  return from === to || to.endsWith(`.${from}`) || from.endsWith(`.${to}`);
}

// Turns what happened when a link was visited into a verdict a person can act on.
// `hops` is the list of URLs visited, starting with the listed link.
export function classifyResult({ hops, status, error }) {
  const start = new URL(hops[0]);
  const end = new URL(hops[hops.length - 1]);

  if (error) return { level: 'problem', reason: `Could not be reached (${error})` };
  if (end.protocol !== 'https:') return { level: 'problem', reason: `Ends on an insecure page: ${end.href}` };
  if (!isSameSite(start.hostname, end.hostname)) {
    // A listing that now lands on a different site may mean the organization moved,
    // or that its old domain expired and someone else bought it: a common scam setup.
    return { level: 'problem', reason: `Now leads to a different site: ${end.hostname}` };
  }
  if (status === 404 || status === 410) return { level: 'problem', reason: `Page is gone (HTTP ${status})` };
  if (status >= 500) return { level: 'warning', reason: `Site error (HTTP ${status}); may be temporary` };
  if (status === 401 || status === 403 || status === 429) {
    return { level: 'warning', reason: `Site blocked the automated check (HTTP ${status}); check by hand` };
  }
  if (status >= 400) return { level: 'problem', reason: `Unexpected response (HTTP ${status})` };
  return { level: 'ok', reason: hops.length > 1 ? `OK after ${hops.length - 1} redirect(s)` : 'OK' };
}

// Callboard's visit counter: the browser half (the server half is src/analytics-server.ts).
//
// It sends Callboard's own server a tiny note when a page is viewed or a button is used, such as
// "the board was opened, by a returning visitor" or "someone clicked through to this listing".
// No cookies and no ID. To tell a first visit from a return, this browser keeps the date of its
// first visit in local storage; that date is never sent, only "new" or "returning".
// Visitors whose browser asks sites not to track them (Global Privacy Control or Do Not Track)
// send nothing at all.

import type { pageNames, reportPlaces } from './analytics-server';

type PageName = (typeof pageNames)[number];
type ReportPlace = (typeof reportPlaces)[number];

const endpoint = '/api/hit';
const firstVisitKey = 'callboard-first-visit';

function counterAllowed(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (['localhost', '127.0.0.1'].includes(window.location.hostname)) return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  if (nav.globalPrivacyControl === true || nav.doNotTrack === '1') return false;
  return true;
}

const todayKey = () => new Date().toISOString().slice(0, 10);

// Worked out once per page load, so every view in one visit is labelled the same way.
let returningVisit: boolean | null = null;
function isReturning(): boolean {
  if (returningVisit !== null) return returningVisit;
  try {
    const first = localStorage.getItem(firstVisitKey);
    if (!first) localStorage.setItem(firstVisitKey, todayKey());
    returningVisit = Boolean(first) && first !== todayKey();
  } catch {
    returningVisit = false; // Storage blocked: count the visit as new.
  }
  return returningVisit;
}

// The site the visitor arrived from, as a bare name like "bsky.app", only on the first view.
let sourceSent = false;
function arrivalSource(): string | undefined {
  if (sourceSent) return undefined;
  sourceSent = true;
  try {
    const host = new URL(document.referrer).hostname.toLowerCase();
    return host && host !== window.location.hostname ? host : undefined;
  } catch {
    return undefined;
  }
}

function send(message: Record<string, unknown>) {
  if (!counterAllowed()) return;
  try {
    const body = JSON.stringify(message);
    const sent = navigator.sendBeacon?.(endpoint, new Blob([body], { type: 'application/json' }));
    if (!sent) void fetch(endpoint, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => {});
  } catch {
    // Counting is never allowed to break the page.
  }
}

export const countView = (page: PageName) => send({ event: 'view', page, returning: isReturning(), source: arrivalSource() });
export const countOfficialClick = (listing: string) => send({ event: 'official', listing });
export const countReportClick = (place: ReportPlace, listing?: string) => send({ event: 'report', place, listing });
export const countSave = (listing: string) => send({ event: 'save', listing });
export const countCalendar = (listing: string) => send({ event: 'calendar', listing });
export const countShare = (listing: string) => send({ event: 'share', listing });
export const countFilter = (group: 'type' | 'discipline', value: string) => send({ event: 'filter', group, value });

import listings from './listings.json';
import { reportUrlFor } from './listing-rules';
import { type ChromeProps, Masthead, SiteFooter } from './site-chrome';

// Two plain text pages: the privacy policy (#privacy) and how to use Callboard inside Claude
// (#claude). Claude's connector directory asks for both before it will list a connector.

// The public address for questions about Callboard. If it is ever left empty, the
// pages then point to the anonymous contact form instead of showing a broken address.
export const supportEmail = 'joeizambus@gmail.com';

export const connectorUrl = 'https://callboard.smythbook.com/mcp';

const POLICY_UPDATED = 'November 22, 2026';

function ContactLine() {
  if (supportEmail) {
    return <>Email <a className="report-link" href={`mailto:${supportEmail}`}>{supportEmail}</a></>;
  }
  return (
    <>Use the <a className="report-link" href={reportUrlFor()} target="_blank" rel="noopener noreferrer">contact form<span className="sr-only"> (opens in a new tab)</span></a></>
  );
}

const latestVerified = () => listings.reduce((latest, item) => item.verified > latest ? item.verified : latest, '');

export function PrivacyPage({ chrome }: { chrome: ChromeProps }) {
  return (
    <main className="quiet-page">
      <div className="page-shell">
        <Masthead {...chrome} updated={latestVerified()} />

        <article className="guide" aria-labelledby="privacy-title">
          <header className="guide-head">
            <h1 id="privacy-title">Privacy</h1>
            <p>Callboard is run by SmythBook LLC. The short version: there are no accounts, ads or cookies, and we don't collect information about you. We count visits and clicks, never visitors. Last updated {POLICY_UPDATED}.</p>
          </header>

          <div className="guide-grid">
            <section className="guide-card">
              <h2>Using the website</h2>
              <ul>
                <li>There are no accounts, ads or cookies.</li>
                <li>Listings you save and your light or dark setting are kept only in your own browser. They are never sent to us.</li>
              </ul>
            </section>

            <section className="guide-card">
              <h2>What we count</h2>
              <ul>
                <li>To learn which calls are useful, the site keeps daily totals on Callboard's own server: page views, clicks through to official pages, saves, shares, deadlines added to calendars, report-link clicks, filters used, and the name of the site a visit came from (such as bsky.app).</li>
                <li>Each total is just a number for a day, like "14 clicks to this listing on November 23". We don't record IP addresses, browser details or anything else that could single you out, and no other company receives these counts.</li>
                <li>To tell a first visit from a return, your browser keeps the date of your first visit. That date stays in your browser; the site only reports "new" or "returning".</li>
                <li>What you type in the search box is never sent to us or counted.</li>
                <li>If your browser sends Global Privacy Control or Do Not Track, nothing is counted.</li>
                <li>Fonts and images come from this site, so browsing it sends nothing to other companies.</li>
              </ul>
            </section>

            <section className="guide-card">
              <h2>Hosting</h2>
              <ul>
                <li>The site is hosted by Cloudflare. Like any web host, Cloudflare handles basic technical details of each request, such as an IP address and browser type, to deliver the site and protect it from attacks.</li>
                <li>That handling is covered by Cloudflare's own privacy policy. Callboard adds no tracking on top of it; the counts above are the only thing it keeps.</li>
              </ul>
            </section>

            <section className="guide-card">
              <h2>Reporting a listing</h2>
              <ul>
                <li>The report form is run by Tally and is anonymous. It asks only which listing, what's wrong and any details you want to add. It never asks for your name or contact details.</li>
                <li>Reports are stored in Callboard's Tally account and read only by the person who keeps the board, to check and fix listings.</li>
                <li>Tally's own privacy policy covers how it stores the form.</li>
              </ul>
            </section>

            <section className="guide-card">
              <h2>Callboard in Claude</h2>
              <ul>
                <li>When you ask Claude to use the Callboard connector, Claude sends it only your search filters, such as a few words, an art form or a date, or the id of one listing.</li>
                <li>The connector answers from the same public listings shown on this site. It needs no sign-in, receives no personal information or chat history, and doesn't store what was searched.</li>
                <li>Your conversation with Claude is covered by Anthropic's privacy policy.</li>
              </ul>
            </section>

            <section className="guide-card">
              <h2>Links to other sites</h2>
              <ul>
                <li>Each listing links to the organization's own page. Once you follow it, that site's privacy policy applies.</li>
              </ul>
            </section>

            <section className="guide-card">
              <h2>Sharing and changes</h2>
              <ul>
                <li>We don't sell or share information about visitors, because we don't collect it.</li>
                <li>If this policy changes, the new version appears here with a new date.</li>
              </ul>
              <p>Questions about privacy? <ContactLine />.</p>
            </section>
          </div>
        </article>

        <SiteFooter />
      </div>
    </main>
  );
}

export function ConnectorGuide({ chrome }: { chrome: ChromeProps }) {
  return (
    <main className="quiet-page">
      <div className="page-shell">
        <Masthead {...chrome} updated={latestVerified()} />

        <article className="guide" aria-labelledby="connector-title">
          <header className="guide-head">
            <h1 id="connector-title">Use Callboard in Claude</h1>
            <p>Callboard has a free connector for Claude. Add it once, then ask Claude for calls that fit your work, and it searches this board for you: the same free, human-checked listings, with deadlines, awards, eligibility and a link to each official page.</p>
          </header>

          <div className="guide-grid">
            <section className="guide-card">
              <h2>Add it to Claude</h2>
              <ul>
                <li>In Claude on the web or the desktop app, open <strong>Customize</strong>, then <strong>Connectors</strong>.</li>
                <li>Choose <strong>Add custom connector</strong>. Name it Callboard and paste this address: <code className="connector-url">{connectorUrl}</code></li>
                <li>No sign-in is needed. Then turn Callboard on for a chat from the <strong>+</strong> menu, under Connectors.</li>
                <li>Free Claude plans can add one custom connector. On a Team or Enterprise plan, an owner adds it in the organization's settings.</li>
              </ul>
            </section>

            <section className="guide-card">
              <h2>Things to ask</h2>
              <ul>
                <li>“Find free poetry contests closing before the end of the year.”</li>
                <li>“Are there any photography grants on Callboard right now?”</li>
                <li>“Which residencies can a playwright apply to, and what do they pay?”</li>
                <li>“What closed recently that I should watch for next year?”</li>
              </ul>
            </section>

            <section className="guide-card">
              <h2>What it can do</h2>
              <ul>
                <li><strong>Search listings:</strong> by words, kind of call, art form and deadline, soonest first.</li>
                <li><strong>Get a listing:</strong> one listing in full, including what it pays and its AI policy where the official page says.</li>
                <li>It only reads the board. It can't change listings, apply for you or see anything else.</li>
              </ul>
            </section>

            <section className="guide-card">
              <h2>Good to know</h2>
              <ul>
                <li>It covers the national board. The campus edition preview isn't included.</li>
                <li>Each result shows the date a person last checked it. Always confirm the deadline and rules on the official page before you apply.</li>
                <li>Other AI apps that support MCP connectors can use the same address.</li>
              </ul>
              <p>See the <a className="report-link" href="#privacy">privacy policy</a>. Problem or question? <ContactLine />.</p>
            </section>
          </div>
        </article>

        <SiteFooter />
      </div>
    </main>
  );
}

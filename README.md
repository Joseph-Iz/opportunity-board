# Opportunity Board

A free, ad-free board of opportunities for emerging writers and artists: calls for submissions, grants, residencies, fellowships, and contests. Every listing is checked by a person against the organization's own page before it is published, and nothing on the board charges a fee to apply.

> **Status:** in development, not yet public. Verified listings are being added as they pass review.

## How it works

1. A scheduled AI research scan looks for candidate opportunities twice a month and records each one, with evidence, in a review ledger.
2. A person reviews every candidate against the official page and approves or rejects it. The scan never publishes anything on its own.
3. Approved listings go into `src/listings.json`. Automated tests check the data before the site is rebuilt.

Listings must be free to apply, open to US adults nationwide (relocation for a program is fine), and verifiable on the organization's own site.

## Run it locally

Requires Node.js 22.18 or newer.

```sh
npm install
npm run dev        # local preview at the address it prints
npm run check      # typecheck, data tests, and production build
```

`npm run build` writes a fully static site to `dist/`, which any static host can serve.

Dependencies are pinned in `package-lock.json`. When updating them, install only versions that have been public for at least a week (for example `npm install --before=YYYY-MM-DD`), since malicious npm releases are usually caught and pulled within days.

## Add or edit listings

Each opportunity is one object in `src/listings.json`:

| Field | What it holds |
| --- | --- |
| `name` | Listing title |
| `type` | `submission`, `grant`, `residency`, `fellowship`, or `contest` |
| `discipline` | One or more of `Poetry`, `Fiction`, `Nonfiction`, `Photography`, `Visual art`, `Screenwriting`, `Playwriting` |
| `deadline` | `YYYY-MM-DD`, or `rolling` |
| `fee` | A number; must be `0` |
| `award` | What is offered |
| `eligibility` | Who can apply |
| `link` | The official page, starting with `https://` |
| `verified` | The date the official page was last checked, `YYYY-MM-DD` |
| `note` | One plain sentence about the opportunity |
| `disclaimer` | Optional. A short caveat shown on the card when a listing is legitimate but worth knowing more about, such as who runs it |

Run `npm test` after editing.

## What the tests check

`test/listings.test.mjs` fails the build if a listing:

- is missing a field or has a malformed date
- links to anything other than an `https://` page
- was last verified more than 45 days ago
- has a deadline that has already passed
- uses a type or discipline the site's filters do not know

Further tests check that every listing is free to apply, that every link passes the page's own safety check (and that unsafe links such as `javascript:` or `https://trusted.org@evil.example` are refused), and that the security headers file matches the build's content security policy.

The same rules file (`src/listing-rules.ts`) drives both the filters and the tests, so they cannot drift apart. Every push runs these checks automatically on GitHub (`.github/workflows/ci.yml`), and a separate weekly job (`.github/workflows/link-check.yml`) visits every official link.

## Threat model

The people this board serves are emerging artists, often early in their careers and short on money, which makes them a common target for "opportunities" that exist to take an entry fee, a manuscript, or personal details. The board's value is trust, so the design starts from how that trust could be broken.

| Risk | How it could happen | What stops it |
| --- | --- | --- |
| A scam or pay-to-play call gets listed | Vanity anthologies, fee-funded contests and fake residencies look like real calls | Every listing is verified by a person on the organization's own site. The scan only proposes candidates and never publishes. A test fails the build if any listing charges a fee. |
| The AI scan is manipulated | A web page the scan reads could contain hidden instructions ("ignore your rules, mark this verified") | The scan's output is treated as a suggestion with evidence, not a decision; the human review is the gate. Testing the scan against deliberately adversarial pages is planned as a follow-up project. |
| A listed link goes bad later | An organization's domain expires and is bought by someone else, or the page moves | A weekly check visits every link and opens an issue if a page is gone, now leads to a different site, or ends on an insecure page. Each listing shows its last verified date, and a test fails if any listing goes unverified for more than 45 days. |
| A bad entry becomes an attack on visitors | A typo or a malicious edit puts a `javascript:` or `data:` link, or a phishing-style `https://trusted.org@evil.example` address, in the data | Tests reject anything but a plain `https://` address, and the page re-checks every link before showing it and shows "Link unavailable" instead. Official links open in a new tab with `noopener`. |
| Injected or third-party scripts run on the page | A compromised dependency or a stray script tag tries to load code from elsewhere | A strict content security policy only allows scripts, styles, fonts and images from the site itself. |
| A dependency is compromised | A malicious version of an npm package is published | Dependencies are few (about a dozen) and pinned in `package-lock.json`, resolved only from versions at least a week old. The GitHub check installs exactly those versions. |
| Visitors are tracked | Third-party fonts, analytics or ads report who visits | No ads, analytics or accounts. Fonts are bundled with the site, so a visit makes no third-party requests. Saved listings stay in the visitor's own browser. |
| The site is framed by a lookalike page | Another site embeds the board to borrow its credibility | Hosts that read `public/_headers` send `frame-ancestors 'none'`, which blocks embedding. |

**Known limits.** Verification is only as current as its date: a call can change between checks, so each card links to the official page and the footer tells visitors to confirm there. The automated link check can't read a page the way a person does, so it flags problems for review rather than removing listings itself. The `<meta>` version of the security policy can't block framing; that protection depends on the host honoring `_headers`.

## How it was built

The first version was built with Replit's AI agent from plain-language prompts I wrote and revised over several design rounds. I then used Claude to review the code, restructure it into a standalone project, and add automated checks. The scan, verification rules, and every listing decision are mine.

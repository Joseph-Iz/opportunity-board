# Opportunity Board

A free, ad-free board of opportunities for emerging writers and artists: calls for submissions, grants, residencies, fellowships, and contests. Every listing is checked by a person against the organization's own page before it is published, and nothing on the board charges a fee to apply.

> **Status:** in development. The listings in `src/listings.json` are clearly marked examples until verified opportunities replace them.

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
| `discipline` | One or more of `Poetry`, `Fiction`, `Nonfiction`, `Photography`, `Visual art` |
| `deadline` | `YYYY-MM-DD`, or `rolling` |
| `fee` | A number; must be `0` |
| `award` | What is offered |
| `eligibility` | Who can apply |
| `link` | The official page, starting with `https://` |
| `verified` | The date the official page was last checked, `YYYY-MM-DD` |
| `note` | One plain sentence about the opportunity |

Run `npm test` after editing.

## What the tests check

`test/listings.test.mjs` fails the build if a listing:

- is missing a field or has a malformed date
- links to anything other than an `https://` page
- was last verified more than 45 days ago
- has a deadline that has already passed
- uses a type or discipline the site's filters do not know

The same rules file (`src/listing-rules.ts`) drives both the filters and the tests, so they cannot drift apart. Every push runs these checks automatically on GitHub (`.github/workflows/ci.yml`).

## How it was built

The first version was built with Replit's AI agent from plain-language prompts I wrote and revised over several design rounds. I then used Claude to review the code, restructure it into a standalone project, and add automated checks. The scan, verification rules, and every listing decision are mine.

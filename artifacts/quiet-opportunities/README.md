# Quiet Opportunities

Quiet Opportunities is a small, ad-free directory of opportunities for emerging writers and photographers. The current entries are examples, not real calls.

## Run the site

From the workspace root, run:

```sh
pnpm --filter @workspace/quiet-opportunities run dev
```

The site will be available in the Replit preview.

## Add or edit listings

Open `src/listings.json`. Each opportunity is one object in the JSON list. Keep these fields:

- `name`: the listing title
- `type`: `submission`, `grant`, `residency`, `fellowship`, or `contest`
- `discipline`: a list containing one or more of `Poetry`, `Fiction`, `Nonfiction`, `Photography`, or `Visual art`
- `deadline`: a date written as `YYYY-MM-DD`, or `rolling`
- `fee`: a number; use `0` when there is no fee
- `award`: a short description of what is offered
- `eligibility`: a short description of who can apply
- `link`: the official page, beginning with `https://`
- `verified`: the date the official page was last checked, written as `YYYY-MM-DD`
- `note`: one plain sentence about the opportunity

Separate objects with commas, and keep quotation marks around text values. Run the data test after editing.

## Deadlines and closing-soon cards

Listings with a date before today are hidden from the full list. A `rolling` deadline stays visible. The Closing soon section shows the three nearest dated deadlines that have not passed. A listing gets a “days left” label when its deadline is within 14 days.

## Check the listings

Run the test from the workspace root:

```sh
pnpm --filter @workspace/quiet-opportunities test
```

It checks required fields, secure links, recent verification dates, expired-deadline behavior, and whether every type and discipline is supported by the filters.

## What to improve next

Replace the six clearly marked examples with real opportunities, then check each official page and update its `verified` date before publishing.

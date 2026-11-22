// Cloudflare Pages runs this file for https://callboard.smythbook.com/api/hit, where the site's
// visit counter sends its tiny anonymous messages. The counter itself is src/analytics-server.ts.
// DB is the Cloudflare D1 database bound to the Pages project under that name (Settings →
// Bindings); until it is bound, the counter accepts messages and saves nothing.
import listings from '../../src/listings.json';
import campusListings from '../../src/campus-listings.json';
import { type CounterDb, handleCounter } from '../../src/analytics-server.ts';
import { filterDisciplineLabels, filterTypeLabels, stageFilterLabels } from '../../src/listing-rules.ts';

const allListings = [...listings, ...campusListings];
const filterValues = [...filterTypeLabels, ...filterDisciplineLabels, ...stageFilterLabels];

export const onRequest = ({ request, env }: { request: Request; env: { DB?: CounterDb } }) =>
  handleCounter(request, env.DB, allListings, filterValues);

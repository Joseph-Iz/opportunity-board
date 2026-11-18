// Cloudflare Pages runs this file for requests to https://callboard.smythbook.com/mcp, the
// address people paste into Claude to add Callboard as a connector. Every other address is
// still served as the plain static site, so page views never count toward Functions usage.
// The connector itself lives in src/mcp-server.ts, next to the listings it reads.
import listings from '../src/listings.json';
import { handleMcpHttp } from '../src/mcp-server.ts';

export const onRequest = ({ request }: { request: Request }) => handleMcpHttp(request, listings);

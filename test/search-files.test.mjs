import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

// The files search engines read: robots.txt (what they may crawl), sitemap.xml (what to crawl)
// and the homepage title (what a search result says). These tests keep them pointing at each other.

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const SITE = 'https://callboard.smythbook.com';

test('robots.txt allows the whole site and points to the sitemap', async () => {
  const robots = await read('public/robots.txt');
  assert.match(robots, /^Allow: \/$/m);
  assert.doesNotMatch(robots, /^Disallow:[ \t]*\S/m, 'nothing on the site should be hidden from search engines');
  assert.match(robots, new RegExp(`^Sitemap: ${SITE}/sitemap\\.xml$`, 'm'));
});

test('the sitemap lists the homepage and only pages on the live site', async () => {
  const sitemap = await read('public/sitemap.xml');
  assert.ok(sitemap.startsWith('<?xml'), 'the sitemap must start with the XML declaration');
  assert.match(sitemap, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  const urls = [...sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1]);
  assert.ok(urls.includes(`${SITE}/`), 'the homepage must be in the sitemap');
  for (const url of urls) {
    assert.ok(url.startsWith(`${SITE}/`), `${url} is not on ${SITE}`);
    assert.ok(!url.includes('#'), `${url} has a # part, which search engines ignore`);
  }
});

test('the homepage title is the same before and after the page loads, and names SmythBook', async () => {
  const html = await read('index.html');
  const chrome = await read('src/site-chrome.tsx');
  const htmlTitle = html.match(/<title>([^<]*)<\/title>/)?.[1];
  const boardTitle = chrome.match(/^\s*board: '([^']*)',$/m)?.[1];
  assert.ok(htmlTitle && boardTitle, 'could not find the homepage title in index.html and src/site-chrome.tsx');
  assert.equal(htmlTitle, boardTitle, 'index.html and the board title in src/site-chrome.tsx have drifted apart');
  assert.match(htmlTitle, /SmythBook/);
});

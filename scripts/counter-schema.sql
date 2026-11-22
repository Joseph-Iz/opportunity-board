-- The visit counter's one table (see src/analytics-server.ts). Each row is a daily tally:
-- day (UTC), what happened, which page or listing, and how many times. Nothing about visitors.
CREATE TABLE IF NOT EXISTS counts (
  day TEXT NOT NULL,
  event TEXT NOT NULL,
  detail TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, event, detail)
);

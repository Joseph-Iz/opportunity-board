// Content security policy: the browser may only load scripts, styles, fonts and images
// from this site itself. If a bad listing or a compromised dependency ever tried to load
// code from somewhere else, the browser would block it. public/_headers sends the same
// policy (plus protections a <meta> tag cannot carry) from hosts that support it.
export const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "font-src 'self' data:",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  'upgrade-insecure-requests',
].join('; ');

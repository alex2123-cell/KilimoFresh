// Security middleware: HTTP security headers, a simple rate limiter and the
// admin session check.
const helmet = require('helmet');
const config = require('../config');
const jwt = require('../pki/jwt');

// Content-Security-Policy: only our own scripts and styles may run, and only
// YouTube and Facebook may be shown inside frames (the social embeds).
const headers = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https://i.ytimg.com'],
      connectSrc: ["'self'"],
      frameSrc: ['https://www.youtube-nocookie.com', 'https://www.facebook.com'],
      formAction: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  // Tell browsers to use HTTPS only (ignored by browsers over plain HTTP).
  strictTransportSecurity: { maxAge: 15552000, includeSubDomains: false },
  crossOriginEmbedderPolicy: false,
});

// At most `max` requests per `windowMs` from one IP address for one route group.
function rateLimit({ name, max, windowMs }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.reset <= now) hits.delete(key);
  }, windowMs).unref();

  return (req, res, next) => {
    const key = `${name}:${req.ip}`;
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.reset - now) / 1000)));
      return res.status(429).json({ error: 'Too many requests. Please wait a few minutes and try again.' });
    }
    next();
  };
}

function readCookie(req, name) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function currentUser(req) {
  const claims = jwt.check(readCookie(req, config.sessionCookie));
  return claims ? { email: claims.sub, role: claims.role } : null;
}

function requireAdmin(req, res, next) {
  const user = currentUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(401).json({ error: 'Please sign in as the cooperative admin.' });
  }
  req.user = user;
  next();
}

module.exports = { headers, rateLimit, currentUser, requireAdmin };

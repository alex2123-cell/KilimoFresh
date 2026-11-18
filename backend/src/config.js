// Central configuration. Everything that changes between a laptop and a
// hosting platform is read from environment variables (see .env.example).
const path = require('path');

const BACKEND_DIR = path.resolve(__dirname, '..');

// On GitHub Codespaces and on Render, the platform already serves the site
// over HTTPS with a trusted public certificate, so our server runs plain HTTP
// behind it. Locally we run HTTPS ourselves. HTTPS=on / HTTPS=off overrides.
const onPlatform = process.env.CODESPACES === 'true' || process.env.RENDER === 'true';
const httpsSetting = (process.env.HTTPS || '').toLowerCase();
const ROOT_DIR = path.resolve(BACKEND_DIR, '..');

module.exports = {
  rootDir: ROOT_DIR,
  frontendDir: path.join(ROOT_DIR, 'frontend'),
  dataDir: process.env.DATA_DIR || path.join(BACKEND_DIR, 'data'),
  pkiDir: process.env.PKI_DIR || path.join(BACKEND_DIR, 'pki'),

  // true  -> HTTPS on httpsPort with our own certificates; httpPort only
  //          redirects to HTTPS (a laptop).
  // false -> plain HTTP on httpPort behind the platform's HTTPS address
  //          (Codespaces, Render), or whenever HTTPS=off is set.
  https: httpsSetting ? httpsSetting !== 'off' : !onPlatform,
  httpPort: Number(process.env.PORT) || 3000,
  httpsPort: Number(process.env.HTTPS_PORT) || 3443,

  adminEmail: (process.env.ADMIN_EMAIL || 'admin@kilimofresh.co.ke').toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD || '',

  sessionCookie: 'kf_session',
  sessionHours: 8,

  organisation: 'KilimoFresh Cooperative Network',
  timezone: 'Africa/Nairobi',
};

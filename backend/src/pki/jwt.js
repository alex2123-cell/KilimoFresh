// Admin sessions as JSON Web Tokens signed with RS256 - the same signing
// private key that signs receipts. Because the token is signed, the server
// can trust its contents later without storing sessions anywhere.
const keys = require('./keys');

const b64url = (value) => Buffer.from(value).toString('base64url');
const HEADER = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));

function issue(claims, hours) {
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(JSON.stringify({ ...claims, iat: now, exp: now + hours * 3600 }));
  const signature = Buffer.from(keys.sign(`${HEADER}.${payload}`), 'base64').toString('base64url');
  return `${HEADER}.${payload}.${signature}`;
}

// Returns the claims, or null if the token is forged, altered or expired.
function check(token) {
  if (typeof token !== 'string') return null;
  const [header, payload, signature, extra] = token.split('.');
  if (!signature || extra !== undefined || header !== HEADER) return null;

  const signatureBase64 = Buffer.from(signature, 'base64url').toString('base64');
  if (!keys.verify(`${header}.${payload}`, signatureBase64)) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return claims.exp > Math.floor(Date.now() / 1000) ? claims : null;
  } catch {
    return null;
  }
}

module.exports = { issue, check };

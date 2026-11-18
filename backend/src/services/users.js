// Admin accounts. Passwords are never stored - only a salted scrypt hash.
const crypto = require('crypto');
const { promisify } = require('util');
const config = require('../config');
const store = require('./store');

const scrypt = promisify(crypto.scrypt);

async function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = (await scrypt(password, salt, 64)).toString('hex');
  return { salt, hash };
}

async function setPassword(email, password, role = 'admin') {
  const record = { email: email.toLowerCase(), role, ...(await hashPassword(password)) };
  if (await store.users.find(record.email)) return store.users.update(record.email, record);
  return store.users.insert(record);
}

async function authenticate(email, password) {
  const user = await store.users.find(String(email || '').toLowerCase());
  // Hash even when the user is unknown so both cases take the same time.
  const { hash } = await hashPassword(String(password || ''), user ? user.salt : 'no-such-user');
  if (!user) return null;
  const same = crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.hash, 'hex'));
  return same ? { email: user.email, role: user.role } : null;
}

// First start: create the admin account. The password comes from
// ADMIN_PASSWORD; if that is not set, a random one is printed once.
async function ensureAdmin() {
  if ((await store.users.all()).length) return;
  const password = config.adminPassword || crypto.randomBytes(9).toString('base64url');
  await setPassword(config.adminEmail, password);
  console.log(`[auth] Admin account created: ${config.adminEmail}`);
  if (!config.adminPassword) {
    console.log(`[auth] One-time generated password: ${password}`);
    console.log('[auth] Change it any time with:  npm run admin -- <email> <new-password>');
  }
}

module.exports = { setPassword, authenticate, ensureAdmin };

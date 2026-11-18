// Public Key Infrastructure in the browser.
// The server signs each receipt with its PRIVATE key. Here the browser checks
// that signature with the matching PUBLIC key (Web Crypto API), so a buyer can
// prove a receipt really came from KilimoFresh and was not changed afterwards.
import { api } from './api.js';

let pkiPromise = null;

/** Certificate chain details + signing public key (fetched once per page). */
export function loadPki() {
  pkiPromise ??= api.get('/pki/certificate');
  return pkiPromise;
}

function pemToBytes(pem) {
  const base64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  return Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
}

const base64ToBytes = (base64) => Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));

async function importPublicKey(pem) {
  return crypto.subtle.importKey(
    'spki',
    pemToBytes(pem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
}

/**
 * Check a receipt's digital signature.
 * @param {string} canonical  the exact receipt text that was signed
 * @param {string} signature  base64 signature from the server
 * @returns {Promise<{valid: boolean, fingerprint: string, chainValid: boolean}>}
 */
export async function verifyReceipt(canonical, signature) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('This browser cannot verify signatures here (Web Crypto needs HTTPS).');
  }
  const pki = await loadPki();
  const key = await importPublicKey(pki.signing.publicKeyPem);
  let valid = false;
  try {
    valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      base64ToBytes(signature.trim()),
      new TextEncoder().encode(canonical),
    );
  } catch {
    valid = false; // e.g. the signature text is not valid base64
  }
  return { valid, fingerprint: pki.signing.fingerprint256, chainValid: pki.chainValid };
}

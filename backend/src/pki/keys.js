// Loads the certificates and keys, creating them on first run, and offers
// the three PKI operations the application needs:
//   sign()       - digital signature with the signing private key
//   verify()     - check a signature with the signing public key
//   describe()   - public details of the certificate chain for the Trust page
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { generate, FILES } = require('./ca');

let cache = null;

function load() {
  if (cache) return cache;

  const missing = Object.values(FILES).some((f) => !fs.existsSync(path.join(config.pkiDir, f)));
  if (missing) {
    console.log('[pki] No certificates found - generating Root CA, server and signing certificates...');
    generate(config.pkiDir);
  }
  const pem = (name) => fs.readFileSync(path.join(config.pkiDir, name), 'utf8');

  const caCert = new crypto.X509Certificate(pem(FILES.caCert));
  const serverCert = new crypto.X509Certificate(pem(FILES.serverCert));
  const signingCert = new crypto.X509Certificate(pem(FILES.signingCert));

  cache = {
    caCert,
    serverCert,
    signingCert,
    caPem: pem(FILES.caCert),
    serverPem: pem(FILES.serverCert),
    serverKeyPem: pem(FILES.serverKey),
    signingPem: pem(FILES.signingCert),
    signingKey: crypto.createPrivateKey(pem(FILES.signingKey)),
    signingPublicPem: signingCert.publicKey.export({ type: 'spki', format: 'pem' }),
  };
  return cache;
}

// RSASSA-PKCS1-v1_5 with SHA-256. Returns the signature as base64.
function sign(data) {
  return crypto.sign('sha256', Buffer.from(data, 'utf8'), load().signingKey).toString('base64');
}

function verify(data, signatureBase64) {
  try {
    return crypto.verify(
      'sha256',
      Buffer.from(data, 'utf8'),
      load().signingCert.publicKey,
      Buffer.from(signatureBase64, 'base64'),
    );
  } catch {
    return false;
  }
}

function tlsOptions() {
  const pki = load();
  // Send the server certificate followed by the CA so clients get the chain.
  return { key: pki.serverKeyPem, cert: pki.serverPem + pki.caPem };
}

function summarise(cert, role, issuer) {
  const now = Date.now();
  return {
    role,
    subject: cert.subject.split('\n').join(', '),
    issuer: cert.issuer.split('\n').join(', '),
    serialNumber: cert.serialNumber,
    validFrom: new Date(cert.validFrom).toISOString(),
    validTo: new Date(cert.validTo).toISOString(),
    fingerprint256: cert.fingerprint256,
    isCA: cert.ca,
    subjectAltName: cert.subjectAltName || null,
    keyAlgorithm: 'RSA 2048-bit',
    signatureAlgorithm: 'SHA-256 with RSA',
    // Chain check: was this certificate really signed by the issuer's key,
    // and is today inside its validity period?
    signedByIssuer: cert.checkIssued(issuer) && cert.verify(issuer.publicKey),
    inValidityPeriod: now >= new Date(cert.validFrom).getTime() && now <= new Date(cert.validTo).getTime(),
  };
}

function describe() {
  const pki = load();
  const chain = [
    summarise(pki.caCert, 'Root certificate authority', pki.caCert),
    summarise(pki.serverCert, 'Server (TLS) certificate', pki.caCert),
    summarise(pki.signingCert, 'Receipt signing certificate', pki.caCert),
  ];
  return {
    chain,
    chainValid: chain.every((c) => c.signedByIssuer && c.inValidityPeriod),
    signing: {
      algorithm: 'RSASSA-PKCS1-v1_5 / SHA-256',
      fingerprint256: pki.signingCert.fingerprint256,
      publicKeyPem: pki.signingPublicPem,
      certificatePem: pki.signingPem,
    },
  };
}

module.exports = { load, sign, verify, tlsOptions, describe };

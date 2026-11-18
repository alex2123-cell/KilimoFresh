// Public Key Infrastructure - certificate authority.
//
// Builds a small but real PKI for KilimoFresh:
//
//   KilimoFresh Root CA            (self-signed, the trust anchor)
//     |- server certificate        (TLS: proves the site is KilimoFresh)
//     |- signing certificate       (signs order receipts and admin sessions)
//
// Each key pair is RSA-2048. A certificate binds a public key to a name and
// is itself signed by the Root CA's private key, so anyone who trusts the
// Root CA can check that a public key really belongs to KilimoFresh.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const forge = require('node-forge');

const FILES = {
  caCert: 'ca.cert.pem',
  caKey: 'ca.key.pem',
  serverCert: 'server.cert.pem',
  serverKey: 'server.key.pem',
  signingCert: 'signing.cert.pem',
  signingKey: 'signing.key.pem',
};

const ORG = [
  { shortName: 'C', value: 'KE' },
  { shortName: 'ST', value: 'Machakos' },
  { shortName: 'O', value: 'KilimoFresh Cooperative Network' },
];

function newKeyPair() {
  // Node's native generator is much faster than a pure-JavaScript one.
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return {
    privatePem: privateKey,
    publicKey: forge.pki.publicKeyFromPem(publicKey),
    privateKey: forge.pki.privateKeyFromPem(privateKey),
  };
}

function issue({ commonName, keys, issuerCert, issuerKey, days, extensions }) {
  const cert = forge.pki.createCertificate();
  const subject = [...ORG, { shortName: 'CN', value: commonName }];

  cert.publicKey = keys.publicKey;
  cert.serialNumber = `01${crypto.randomBytes(9).toString('hex')}`;
  cert.validity.notBefore = new Date(Date.now() - 60 * 1000);
  cert.validity.notAfter = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  cert.setSubject(subject);
  cert.setIssuer(issuerCert ? issuerCert.subject.attributes : subject);
  cert.setExtensions([
    ...extensions,
    { name: 'subjectKeyIdentifier' },
    ...(issuerCert
      ? [{ name: 'authorityKeyIdentifier', keyIdentifier: issuerCert.generateSubjectKeyIdentifier().getBytes() }]
      : []),
  ]);
  // The issuer signs the certificate with ITS private key (SHA-256 with RSA).
  cert.sign(issuerKey || keys.privateKey, forge.md.sha256.create());
  return cert;
}

function generate(dir, { hosts = ['localhost'], ips = ['127.0.0.1'] } = {}) {
  fs.mkdirSync(dir, { recursive: true });

  const caKeys = newKeyPair();
  const caCert = issue({
    commonName: 'KilimoFresh Root CA',
    keys: caKeys,
    days: 3650,
    extensions: [
      { name: 'basicConstraints', cA: true, pathLenConstraint: 0, critical: true },
      { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true },
    ],
  });

  const serverKeys = newKeyPair();
  const serverCert = issue({
    commonName: hosts[0],
    keys: serverKeys,
    issuerCert: caCert,
    issuerKey: caKeys.privateKey,
    days: 397,
    extensions: [
      { name: 'basicConstraints', cA: false, critical: true },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, critical: true },
      { name: 'extKeyUsage', serverAuth: true },
      {
        name: 'subjectAltName',
        altNames: [...hosts.map((value) => ({ type: 2, value })), ...ips.map((ip) => ({ type: 7, ip }))],
      },
    ],
  });

  const signingKeys = newKeyPair();
  const signingCert = issue({
    commonName: 'KilimoFresh Receipt Signing',
    keys: signingKeys,
    issuerCert: caCert,
    issuerKey: caKeys.privateKey,
    days: 397,
    extensions: [
      { name: 'basicConstraints', cA: false, critical: true },
      { name: 'keyUsage', digitalSignature: true, nonRepudiation: true, critical: true },
    ],
  });

  const out = (name, pem, secret) =>
    fs.writeFileSync(path.join(dir, name), pem, { mode: secret ? 0o600 : 0o644 });

  out(FILES.caCert, forge.pki.certificateToPem(caCert));
  out(FILES.caKey, caKeys.privatePem, true);
  out(FILES.serverCert, forge.pki.certificateToPem(serverCert));
  out(FILES.serverKey, serverKeys.privatePem, true);
  out(FILES.signingCert, forge.pki.certificateToPem(signingCert));
  out(FILES.signingKey, signingKeys.privatePem, true);
}

module.exports = { generate, FILES };

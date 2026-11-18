// Entry point: starts the web server.
//   Local:   https://localhost:3443  (our own certificate chain)
//            http://localhost:3000   -> redirects to HTTPS
//   Codespaces / Render: plain HTTP behind the platform's HTTPS address
//            (detected automatically; see src/config.js).
const http = require('http');
const https = require('https');
const config = require('./src/config');
const keys = require('./src/pki/keys');
const users = require('./src/services/users');
const { createApp } = require('./src/app');

// The public HTTPS address when running on a platform.
function publicUrl() {
  const { CODESPACE_NAME, GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN, RENDER_EXTERNAL_URL } = process.env;
  if (CODESPACE_NAME && GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN) {
    return `https://${CODESPACE_NAME}-${config.httpPort}.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`;
  }
  return RENDER_EXTERNAL_URL || `http://localhost:${config.httpPort}`;
}

async function main() {
  keys.load(); // creates the PKI on first run
  await users.ensureAdmin();
  const app = createApp();

  if (!config.https) {
    http.createServer(app).listen(config.httpPort, () => {
      console.log(`KilimoFresh is running. Open: ${publicUrl()}`);
    });
    return;
  }

  https.createServer(keys.tlsOptions(), app).listen(config.httpsPort, () => {
    console.log(`KilimoFresh running on https://localhost:${config.httpsPort}`);
  });

  http
    .createServer((req, res) => {
      const host = (req.headers.host || 'localhost').split(':')[0];
      res.writeHead(308, { Location: `https://${host}:${config.httpsPort}${req.url}` });
      res.end();
    })
    .listen(config.httpPort, () => {
      console.log(`http://localhost:${config.httpPort} redirects to HTTPS`);
    });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

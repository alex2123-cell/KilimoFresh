// npm run pki  [-- extra-hostname ...]
// (Re)creates the Root CA, server and signing certificates in backend/pki.
// Old receipts signed with the previous key will no longer verify.
const config = require('../src/config');
const { generate, FILES } = require('../src/pki/ca');

const extraHosts = process.argv.slice(2);
generate(config.pkiDir, { hosts: ['localhost', ...extraHosts] });

console.log(`Certificates written to ${config.pkiDir}`);
for (const file of Object.values(FILES)) console.log(`  ${file}`);
console.log('\nTo remove the browser warning on your own machine, import ca.cert.pem');
console.log('as a trusted root certificate (see README, "Trusting the Root CA").');

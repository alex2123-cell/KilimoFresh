// npm run admin -- <email> <password>
// Creates an admin account or changes its password.
const users = require('../src/services/users');

const [email, password] = process.argv.slice(2);
if (!email || !password || password.length < 10) {
  console.error('Usage: npm run admin -- <email> <password>   (password: 10+ characters)');
  process.exit(1);
}

users.setPassword(email, password).then(() => console.log(`Admin password set for ${email.toLowerCase()}`));

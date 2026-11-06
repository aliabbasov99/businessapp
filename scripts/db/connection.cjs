const { existsSync } = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const root = path.resolve(__dirname, '../..');
if (existsSync(path.join(root, '.env.local'))) process.loadEnvFile(path.join(root, '.env.local'));
function connect(admin = true) {
  const connectionString = process.env[admin ? 'DATABASE_ADMIN_URL' : 'DATABASE_URL'];
  if (!connectionString) throw new Error('Database URL missing. Run npm run db:start or configure .env.local.');
  return new Client({ connectionString, connectionTimeoutMillis: 5000, statement_timeout: 15000 });
}
module.exports = { connect, root };

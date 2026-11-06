const { createHash } = require('node:crypto');
const { readdirSync, readFileSync } = require('node:fs');
const path = require('node:path');
const { connect, root } = require('./connection.cjs');

async function migrate() {
  const client = connect();
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('dashboard-migrations'))");
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
    const dir = path.join(root, 'database/migrations');
    for (const name of readdirSync(dir).filter(file => file.endsWith('.sql')).sort()) {
      const sql = readFileSync(path.join(dir, name), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const applied = await client.query('SELECT checksum FROM schema_migrations WHERE name = $1', [name]);
      if (applied.rowCount) {
        if (applied.rows[0].checksum !== checksum) throw new Error(`Applied migration changed: ${name}. Add a new migration instead.`);
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [name, checksum]);
      console.log(`Applied ${name}`);
    }
    // The API uses a separate, non-superuser role, never the migration owner.
    const url = new URL(process.env.DATABASE_URL);
    if (decodeURIComponent(url.username) !== 'dashboard_app') throw new Error('DATABASE_URL must use the dashboard_app role.');
    const exists = await client.query("SELECT 1 FROM pg_roles WHERE rolname = 'dashboard_app'");
    if (!exists.rowCount) {
      const literal = await client.query('SELECT quote_literal($1) AS password', [decodeURIComponent(url.password)]);
      await client.query(`CREATE ROLE dashboard_app LOGIN PASSWORD ${literal.rows[0].password}`);
    }
    await client.query('GRANT USAGE ON SCHEMA public TO dashboard_app');
    await client.query('GRANT SELECT ON ALL TABLES IN SCHEMA public TO dashboard_app');
    await client.query('GRANT UPDATE (name, email, phone) ON users TO dashboard_app');
    await client.query('GRANT UPDATE (read_at) ON notifications TO dashboard_app');
    await client.query('COMMIT');
    console.log('Migrations ready.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { await client.end(); }
}
migrate().catch(error => { console.error(error.message); process.exitCode = 1; });

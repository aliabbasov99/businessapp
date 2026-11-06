const { spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { existsSync, mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
process.chdir(root);
const container = 'dashboard-postgres';
const runtime = process.env.CONTAINER_RUNTIME || 'podman';
const action = process.argv[2] || 'start';
function run(args, options = {}) {
  const result = spawnSync(runtime, args, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${runtime} ${args[0]} failed (${result.status})`);
  return result;
}

if (action === 'start') {
  mkdirSync('.local', { recursive: true, mode: 0o700 });
  if (!existsSync('.local/postgres.env')) {
    if (existsSync('.env.local')) throw new Error('.env.local already exists. Configure PostgreSQL manually; existing credentials were not changed.');
    const ownerPassword = randomBytes(24).toString('hex');
    const appPassword = randomBytes(24).toString('hex');
    writeFileSync('.local/postgres.env', `POSTGRES_USER=dashboard_owner\nPOSTGRES_DB=dashboard\nPOSTGRES_PASSWORD=${ownerPassword}\n`, { mode: 0o600 });
    writeFileSync('.env.local', `DATABASE_ADMIN_URL=postgresql://dashboard_owner:${ownerPassword}@127.0.0.1:5432/dashboard\nDATABASE_URL=postgresql://dashboard_app:${appPassword}@127.0.0.1:5432/dashboard\nLOCAL_DEMO_API=true\n`, { mode: 0o600 });
  }
  const exists = spawnSync(runtime, ['container', 'inspect', container], { stdio: 'ignore' }).status === 0;
  if (exists) run(['start', container]);
  else run(['run', '--detach', '--name', container, '--restart', 'unless-stopped',
    '--publish', '127.0.0.1:5432:5432', '--env-file', '.local/postgres.env',
    '--volume', 'dashboard-postgres-data:/var/lib/postgresql/data', 'docker.io/library/postgres:17']);
  // pg_isready runs inside the container, so a host psql installation is not required.
  for (let attempt = 0; attempt < 30; attempt++) {
    if (spawnSync(runtime, ['exec', container, 'pg_isready', '-U', 'dashboard_owner', '-d', 'dashboard'], { stdio: 'ignore' }).status === 0) {
      console.log('PostgreSQL ready at 127.0.0.1:5432/dashboard. Run npm run db:migrate and npm run db:seed.');
      process.exit(0);
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
  throw new Error('PostgreSQL did not become ready; inspect container logs.');
} else if (action === 'stop') {
  run(['stop', container]);
} else if (action === 'psql') {
  run(['exec', ...(process.stdin.isTTY ? ['-it'] : ['-i']), container,
    'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'dashboard_owner', '-d', 'dashboard', ...process.argv.slice(3)]);
} else {
  throw new Error('Usage: local.cjs start|stop|psql');
}

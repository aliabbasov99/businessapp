// Server-only: imported exclusively from +api.ts routes. Never import in a component.
import { Pool, types, type PoolClient } from 'pg';

function safeInteger(value: string) {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error('Database integer exceeds the safe JSON range');
  return number;
}
let pool: Pool | undefined;
export function getPool() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  if (pool) return pool;
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000, statement_timeout: 10000,
    types: {
      getTypeParser(oid, format) {
        if (format !== 'binary' && oid === types.builtins.INT8) return safeInteger;
        if (format !== 'binary' && oid === types.builtins.NUMERIC) return Number;
        return types.getTypeParser(oid, format);
      },
    },
  });
  // A database restart can close idle clients. Keep the API alive so retry works.
  pool.on('error', error => console.error('PostgreSQL idle connection closed', error.name));
  return pool;
}

export function mapRow(row: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [
    key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()),
    value instanceof Date ? value.getTime() : value,
  ]));
}
export async function queryRows<T>(client: PoolClient, sql: string, params: unknown[] = []): Promise<T[]> {
  const result = await client.query(sql, params);
  return result.rows.map(row => mapRow(row) as T);
}

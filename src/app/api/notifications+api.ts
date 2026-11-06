import type { AppNotification } from '@/data/schema';
import { apiResponse, ApiError, jsonBody } from '@/server/http';
import { getPool, queryRows } from '@/server/postgres';

export function PATCH(request: Request) {
  return apiResponse(async () => {
    const body = await jsonBody(request);
    if (typeof body.read !== 'boolean' || (body.id !== undefined && (!Number.isSafeInteger(body.id) || Number(body.id) <= 0))) throw new ApiError(400, 'Invalid notification update');
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query(`UPDATE notifications SET read_at = CASE WHEN $1 THEN COALESCE(read_at, GREATEST(now(), created_at)) ELSE NULL END
        WHERE user_id = (SELECT active_user_id FROM app_metadata WHERE id = 1) AND ($2::integer IS NULL OR id = $2)`, [body.read, body.id ?? null]);
      const rows = await queryRows<AppNotification>(client, 'SELECT id, user_id, event_id, created_at, read_at FROM notifications WHERE user_id = (SELECT active_user_id FROM app_metadata WHERE id = 1) ORDER BY created_at DESC, id DESC');
      await client.query('COMMIT');
      return rows;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  });
}

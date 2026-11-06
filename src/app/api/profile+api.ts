import { apiResponse, ApiError, jsonBody } from '@/server/http';
import { getPool, mapRow } from '@/server/postgres';

export function PATCH(request: Request) {
  return apiResponse(async () => {
    const body = await jsonBody(request);
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 200
      || typeof body.email !== 'string' || body.email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())
      || typeof body.phone !== 'string' || body.phone.length > 40) throw new ApiError(400, 'Invalid profile');
    try {
      const result = await getPool().query(
        'UPDATE users SET name = $1, email = $2, phone = $3 WHERE id = (SELECT active_user_id FROM app_metadata WHERE id = 1) RETURNING *',
        [body.name.trim(), body.email.trim(), body.phone.trim() || null],
      );
      if (!result.rowCount) throw new ApiError(404, 'User not found');
      return mapRow(result.rows[0]);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') throw new ApiError(409, 'Email already exists');
      throw error;
    }
  });
}

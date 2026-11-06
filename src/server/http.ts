export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  const body = await request.text();
  if (body.length > 16384) throw new ApiError(413, 'Request too large');
  try {
    const value: unknown = JSON.parse(body);
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error();
    return value as Record<string, unknown>;
  } catch { throw new ApiError(400, 'Invalid JSON body'); }
}
export async function apiResponse(action: () => Promise<unknown>) {
  const headers = { 'Cache-Control': 'no-store' };
  // This app currently has demo login screens, not server authentication.
  // Fail closed unless this local demo API is explicitly enabled by its operator.
  if (process.env.LOCAL_DEMO_API !== 'true') return Response.json({ error: 'Local demo API is disabled' }, { status: 503, headers });
  try { return Response.json(await action(), { headers }); }
  catch (error) {
    if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status, headers });
    // Do not leak connection strings, SQL details or profile values in responses/logs.
    console.error('Database API request failed', error instanceof Error ? error.name : 'UnknownError');
    return Response.json({ error: 'Məlumat xidməti əlçatan deyil' }, { status: 503, headers });
  }
}

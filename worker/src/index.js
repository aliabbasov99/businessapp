// Cloudflare Worker API for the PROMAR business app.
// Bindings: USERS_D1 (login / waitlist), MAIN_D1 (application snapshot data).
// Secrets: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400',
};

function json(data, status = 200) {
  return Response.json(data, { status, headers: { ...CORS, 'Cache-Control': 'no-store' } });
}

function fail(message, status = 400, extra = {}) {
  return json({ success: false, message, ...extra }, status);
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePhone(value) {
  const raw = String(value || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 9) return `+994${digits}`;
  if (digits.length === 10 && digits.startsWith('0')) return `+994${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('994')) return `+${digits}`;
  if (raw.startsWith('+') && digits.length >= 10) return `+${digits}`;
  return null;
}

async function readJson(request) {
  const text = await request.text();
  if (!text) return {};
  try {
    const value = JSON.parse(text);
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error();
    return value;
  } catch {
    throw new Error('Invalid JSON body');
  }
}

function decodeJwtPayload(token) {
  try {
    const part = String(token || '').split('.')[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone ?? null,
    name: user.name ?? null,
    picture: user.picture ?? null,
    auth_provider: user.auth_provider ?? 'custom',
    database_target: user.database_target ?? null,
    status: user.status ?? 'p',
    created_at: user.created_at ?? null,
  };
}

// Pending tokens let the app re-check approval status on every launch without
// asking the user to sign in again. One token per pending user.
const PENDING_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

async function issuePendingToken(env, userId) {
  const token = crypto.randomUUID().replace(/-/g, '');
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + PENDING_TOKEN_TTL_MS).toISOString();
  await env.USERS_D1.prepare('DELETE FROM pending_tokens WHERE user_id = ?').bind(userId).run();
  await env.USERS_D1.prepare(
    'INSERT INTO pending_tokens (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
  ).bind(token, userId, createdAt, expiresAt).run();
  await env.USERS_D1.prepare('DELETE FROM pending_tokens WHERE expires_at < ?').bind(createdAt).run();
  return token;
}

async function dropPendingTokens(env, userId) {
  await env.USERS_D1.prepare('DELETE FROM pending_tokens WHERE user_id = ?').bind(userId).run();
}

async function statusResponse(env, user) {
  if (user.status === 'p') {
    let pendingToken = null;
    try {
      pendingToken = await issuePendingToken(env, user.id);
    } catch {
      // pending_tokens table not migrated yet — still report pending, the app
      // falls back to its legacy one-shot alert.
    }
    return json({
      success: false,
      status: 'p',
      message: 'Hesabınız admin təsdiqini gözləyir.',
      email: user.email ?? null,
      ...(pendingToken ? { pending_token: pendingToken } : {}),
    }, 403);
  }
  if (user.status === 'r') {
    return json({
      success: false,
      status: 'r',
      message: 'Hesabınız rədd edilib.',
    }, 403);
  }
  try {
    await dropPendingTokens(env, user.id);
  } catch {
    // Best effort: an accepted login should not fail on cleanup.
  }
  return json({
    success: true,
    status: 'a',
    message: 'Uğurla daxil oldunuz.',
    user: publicUser(user),
  });
}

async function upsertGoogleUser(env, profile) {
  const email = normalizeEmail(profile.email);
  if (!email) throw new Error('Google e-poçtu tapılmadı');

  const name = profile.name || null;
  const picture = profile.picture || null;
  const googleId = profile.sub || null;

  let user = await env.USERS_D1.prepare(
    'SELECT * FROM users WHERE lower(email) = ?',
  ).bind(email).first();

  if (!user) {
    const result = await env.USERS_D1.prepare(
      "INSERT INTO users (email, name, google_id, picture, auth_provider, status, last_login_at) VALUES (?, ?, ?, ?, 'google', 'p', ?)",
    ).bind(email, name, googleId, picture, nowIso()).run();
    user = await env.USERS_D1.prepare(
      'SELECT * FROM users WHERE id = ?',
    ).bind(result.meta.last_row_id).first();
  } else {
    await env.USERS_D1.prepare(
      'UPDATE users SET google_id = COALESCE(?, google_id), name = COALESCE(?, name), picture = COALESCE(?, picture), last_login_at = ? WHERE id = ?',
    ).bind(googleId, name, picture, nowIso(), user.id).run();
    user = await env.USERS_D1.prepare(
      'SELECT * FROM users WHERE id = ?',
    ).bind(user.id).first();
  }

  return user;
}

async function loadSnapshot(env, target) {
  const requested = String(target || 'main').trim() || 'main';
  let row = await env.MAIN_D1.prepare(
    'SELECT data, updated_at FROM app_snapshots WHERE database_target = ?',
  ).bind(requested).first();
  if (!row && requested !== 'main') {
    row = await env.MAIN_D1.prepare(
      'SELECT data, updated_at FROM app_snapshots WHERE database_target = ?',
    ).bind('main').first();
  }
  if (!row) return null;
  return { snapshot: JSON.parse(row.data), target: requested, updatedAt: row.updated_at };
}

async function saveSnapshot(env, target, snapshot) {
  const requested = String(target || 'main').trim() || 'main';
  await env.MAIN_D1.prepare(
    'INSERT INTO app_snapshots (database_target, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(database_target) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at',
  ).bind(requested, JSON.stringify(snapshot), nowIso()).run();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function htmlPage(title, message) {
  return new Response(
    `<!doctype html><html lang="az"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f4f8fc;color:#163d5e;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px}.card{background:#fff;border-radius:16px;padding:32px;max-width:440px;box-shadow:0 8px 30px rgba(22,61,94,.12);text-align:center}h1{font-size:22px;margin:0 0 12px}p{font-size:15px;line-height:1.6;color:#5a7184;margin:0}</style></head><body><div class="card"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></div></body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
  );
}

function appRedirectWith(base, params) {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    try {
      // ---------------------------------------------------------------------
      // Health
      // ---------------------------------------------------------------------
      if (url.pathname === '/api/health' && method === 'GET') {
        return json({ success: true, ok: true, now: nowIso() });
      }

      // ---------------------------------------------------------------------
      // Email + password login (admin-created users)
      // ---------------------------------------------------------------------
      if (url.pathname === '/api/login' && method === 'POST') {
        const body = await readJson(request);
        const email = normalizeEmail(body.email);
        const password = String(body.password || '');

        if (!email || !password) return fail('E-poçt və şifrə tələb olunur.', 400);

        const user = await env.USERS_D1.prepare(
          'SELECT * FROM users WHERE lower(email) = ?',
        ).bind(email).first();

        if (!user) return fail('İstifadəçi tapılmadı.', 404);
        if (!user.password) return fail('Bu hesab Google ilə yaradılıb. Google ilə daxil olun.', 401);
        if (user.password !== password) return fail('Şifrə yanlışdır.', 401);

        return statusResponse(env, user);
      }

      // ---------------------------------------------------------------------
      // Google OAuth relay (browser flow works on Android and iOS)
      // ---------------------------------------------------------------------
      if (url.pathname === '/api/google/start' && method === 'GET') {
        if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
          return fail('Google girişi hələ konfiqurasiya edilməyib.', 503, { code: 'google_not_configured' });
        }

        const appRedirect = url.searchParams.get('redirect_uri') || 'dashboardapp://google-callback';
        if (!appRedirect.startsWith('dashboardapp://') && !appRedirect.startsWith('exp://')) {
          return fail('Yanlış redirect_uri.', 400);
        }

        const state = crypto.randomUUID().replace(/-/g, '');
        const createdAt = nowIso();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        await env.USERS_D1.prepare(
          'INSERT INTO oauth_states (state, app_redirect, created_at, expires_at) VALUES (?, ?, ?, ?)',
        ).bind(state, appRedirect, createdAt, expiresAt).run();
        await env.USERS_D1.prepare('DELETE FROM oauth_states WHERE expires_at < ?').bind(createdAt).run();

        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
        authUrl.searchParams.set('redirect_uri', `${url.origin}/api/google/callback`);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', 'openid email profile');
        authUrl.searchParams.set('state', state);
        authUrl.searchParams.set('prompt', 'select_account');
        authUrl.searchParams.set('access_type', 'online');
        authUrl.searchParams.set('include_granted_scopes', 'true');

        return Response.redirect(authUrl.toString(), 302);
      }

      if (url.pathname === '/api/google/callback' && method === 'GET') {
        const state = url.searchParams.get('state');
        const code = url.searchParams.get('code');
        const oauthError = url.searchParams.get('error');

        if (!state) return htmlPage('Xəta', 'OAuth state tapılmadı. Tətbiqdən yenidən cəhd edin.');

        const stateRow = await env.USERS_D1.prepare(
          'SELECT * FROM oauth_states WHERE state = ?',
        ).bind(state).first();
        if (!stateRow) return htmlPage('Xəta', 'OAuth state tapılmadı və ya artıq istifadə edilib.');
        await env.USERS_D1.prepare('DELETE FROM oauth_states WHERE state = ?').bind(state).run();

        if (new Date(stateRow.expires_at).getTime() < Date.now()) {
          return Response.redirect(appRedirectWith(stateRow.app_redirect, {
            error: 'expired',
            error_description: 'Giriş vaxtı bitdi. Yenidən cəhd edin.',
          }), 302);
        }

        if (oauthError) {
          return Response.redirect(appRedirectWith(stateRow.app_redirect, {
            error: oauthError,
            error_description: url.searchParams.get('error_description') || 'Google girişi ləğv edildi.',
          }), 302);
        }

        if (!code) {
          return Response.redirect(appRedirectWith(stateRow.app_redirect, {
            error: 'missing_code',
            error_description: 'Google təsdiq kodu alınmadı.',
          }), 302);
        }

        if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
          return Response.redirect(appRedirectWith(stateRow.app_redirect, {
            error: 'google_not_configured',
            error_description: 'Google girişi konfiqurasiya edilməyib.',
          }), 302);
        }

        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: env.GOOGLE_CLIENT_ID,
            client_secret: env.GOOGLE_CLIENT_SECRET,
            redirect_uri: `${url.origin}/api/google/callback`,
            grant_type: 'authorization_code',
          }).toString(),
        });
        const tokens = await tokenResponse.json().catch(() => ({}));

        if (!tokenResponse.ok) {
          return Response.redirect(appRedirectWith(stateRow.app_redirect, {
            error: tokens.error || 'token_exchange_failed',
            error_description: tokens.error_description || 'Google token alınmadı.',
          }), 302);
        }

        const profile = decodeJwtPayload(tokens.id_token);
        if (!profile || !profile.email) {
          return Response.redirect(appRedirectWith(stateRow.app_redirect, {
            error: 'invalid_google_token',
            error_description: 'Google istifadəçi məlumatı alınmadı.',
          }), 302);
        }
        if (profile.email_verified === false || profile.email_verified === 'false') {
          return Response.redirect(appRedirectWith(stateRow.app_redirect, {
            error: 'email_not_verified',
            error_description: 'Google e-poçtu təsdiqlənməyib.',
          }), 302);
        }

        const user = await upsertGoogleUser(env, profile);
        const loginCode = crypto.randomUUID().replace(/-/g, '');
        await env.USERS_D1.prepare(
          'INSERT INTO login_codes (code, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
        ).bind(loginCode, user.id, nowIso(), new Date(Date.now() + 5 * 60 * 1000).toISOString()).run();
        await env.USERS_D1.prepare('DELETE FROM login_codes WHERE expires_at < ?').bind(nowIso()).run();

        return Response.redirect(appRedirectWith(stateRow.app_redirect, {
          code: loginCode,
          status: user.status,
        }), 302);
      }

      // Exchange the short-lived one-time code returned by the Google callback.
      if (url.pathname === '/api/google/session' && method === 'POST') {
        const body = await readJson(request);
        const code = String(body.code || '').trim();
        if (!code) return fail('Kod tələb olunur.', 400);

        const row = await env.USERS_D1.prepare(
          'SELECT * FROM login_codes WHERE code = ?',
        ).bind(code).first();
        if (!row) return fail('Giriş kodu tapılmadı və ya artıq istifadə edilib.', 404);
        await env.USERS_D1.prepare('DELETE FROM login_codes WHERE code = ?').bind(code).run();

        if (new Date(row.expires_at).getTime() < Date.now()) {
          return fail('Giriş kodunun vaxtı bitib.', 400);
        }

        const user = await env.USERS_D1.prepare(
          'SELECT * FROM users WHERE id = ?',
        ).bind(row.user_id).first();
        if (!user) return fail('İstifadəçi tapılmadı.', 404);

        return statusResponse(env, user);
      }

      // Optional native id_token login (used by future native Google SDK builds).
      if (url.pathname === '/api/google' && method === 'POST') {
        const body = await readJson(request);
        const idToken = String(body.id_token || '').trim();
        if (!idToken) return fail('id_token tələb olunur.', 400);

        const verifyResponse = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
        );
        if (!verifyResponse.ok) return fail('Google tokeni yanlışdır.', 401);
        const profile = await verifyResponse.json();

        if (env.GOOGLE_CLIENT_ID && profile.aud && profile.aud !== env.GOOGLE_CLIENT_ID) {
          return fail('Google tokeni bu tətbiq üçün deyil.', 401);
        }
        if (profile.email_verified === false || profile.email_verified === 'false') {
          return fail('Google e-poçtu təsdiqlənməyib.', 401);
        }

        const user = await upsertGoogleUser(env, profile);
        return statusResponse(env, user);
      }

      // ---------------------------------------------------------------------
      // Pending approval polling: the app re-checks the account status with a
      // stored pending token instead of signing in again on every launch.
      // ---------------------------------------------------------------------
      if (url.pathname === '/api/pending' && method === 'POST') {
        const body = await readJson(request);
        const token = String(body.token || '').trim();
        if (!token) return fail('Token tələb olunur.', 400);

        const row = await env.USERS_D1.prepare(
          'SELECT * FROM pending_tokens WHERE token = ?',
        ).bind(token).first();

        if (!row || new Date(row.expires_at).getTime() < Date.now()) {
          if (row) {
            await env.USERS_D1.prepare('DELETE FROM pending_tokens WHERE token = ?').bind(token).run();
          }
          return json({
            success: false,
            status: 'expired',
            message: 'Giriş sessiyası bitib. Zəhmət olmasa yenidən daxil olun.',
          });
        }

        const user = await env.USERS_D1.prepare(
          'SELECT * FROM users WHERE id = ?',
        ).bind(row.user_id).first();
        if (!user) {
          await env.USERS_D1.prepare('DELETE FROM pending_tokens WHERE token = ?').bind(token).run();
          return json({
            success: false,
            status: 'expired',
            message: 'Hesab tapılmadı. Zəhmət olmasa yenidən daxil olun.',
          });
        }

        // Still pending: keep the same token so the app can keep polling.
        if (user.status === 'p') {
          return json({
            success: false,
            status: 'p',
            message: 'Hesabınız admin təsdiqini gözləyir.',
            email: user.email ?? null,
          });
        }

        await env.USERS_D1.prepare('DELETE FROM pending_tokens WHERE token = ?').bind(token).run();
        if (user.status === 'r') {
          return json({
            success: false,
            status: 'r',
            message: 'Hesabınız rədd edilib.',
          });
        }

        // Approved: hand the app a full session, exactly like a fresh login.
        return json({
          success: true,
          status: 'a',
          message: 'Uğurla daxil oldunuz.',
          user: publicUser(user),
        });
      }

      // ---------------------------------------------------------------------
      // Waitlist / user registration
      // ---------------------------------------------------------------------
      if (url.pathname === '/api/users' && method === 'POST') {
        const body = await readJson(request);
        const email = normalizeEmail(body.email);
        const phone = body.phone ? normalizePhone(body.phone) : null;
        if (!email) return fail('E-poçt tələb olunur.', 400);
        if (body.phone && !phone) return fail('Telefon nömrəsi yanlışdır.', 400);

        const existing = await env.USERS_D1.prepare(
          'SELECT id FROM users WHERE lower(email) = ?',
        ).bind(email).first();
        if (existing) return fail('Bu e-poçt artıq qeydiyyatdadır.', 409);

        const result = await env.USERS_D1.prepare(
          'INSERT INTO users (email, password, phone, name, auth_provider, database_target, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ).bind(
          email,
          body.password ? String(body.password) : null,
          phone,
          body.name ? String(body.name) : null,
          body.auth_provider ? String(body.auth_provider) : 'custom',
          body.database_target ? String(body.database_target) : null,
          body.status ? String(body.status) : 'p',
        ).run();

        return json({
          success: true,
          message: 'İstifadəçi yaradıldı.',
          id: result.meta.last_row_id,
        }, 201);
      }

      // ---------------------------------------------------------------------
      // Admin panel
      // ---------------------------------------------------------------------
      if (url.pathname === '/api/admin/users' && method === 'GET') {
        const { results } = await env.USERS_D1.prepare(
          'SELECT id, email, phone, name, picture, auth_provider, status, database_target, created_at, last_login_at FROM users ORDER BY id DESC',
        ).all();
        return json({ success: true, users: results });
      }

      if (url.pathname.startsWith('/api/admin/users/') && method === 'PUT') {
        const userId = url.pathname.split('/').pop();
        const body = await readJson(request);
        const status = body.status ? String(body.status) : null;
        const databaseTarget = body.database_target !== undefined
          ? (body.database_target ? String(body.database_target) : null)
          : undefined;

        if (status !== null && !['a', 'p', 'r'].includes(status)) {
          return fail('Status yalnız a, p və ya r ola bilər.', 400);
        }

        const result = await env.USERS_D1.prepare(
          'UPDATE users SET status = COALESCE(?, status), database_target = CASE WHEN ? IS NULL THEN database_target ELSE ? END WHERE id = ?',
        ).bind(status, databaseTarget === undefined ? null : databaseTarget, databaseTarget ?? null, userId).run();

        if (!result.meta.changes) return fail('İstifadəçi tapılmadı.', 404);
        return json({ success: true, message: 'İstifadəçi məlumatları yeniləndi.' });
      }

      // ---------------------------------------------------------------------
      // Application data (D1 replaces the local PostgreSQL dependency)
      // ---------------------------------------------------------------------
      if (url.pathname === '/api/bootstrap' && method === 'GET') {
        const loaded = await loadSnapshot(env, url.searchParams.get('target'));
        if (!loaded) return fail('Məlumat bazası tapılmadı.', 404);
        return json(loaded.snapshot);
      }

      if (url.pathname === '/api/profile' && method === 'PATCH') {
        const body = await readJson(request);
        const loaded = await loadSnapshot(env, body.target);
        if (!loaded) return fail('Məlumat bazası tapılmadı.', 404);

        const { snapshot } = loaded;
        const activeUserId = snapshot.metadata?.activeUserId;
        const index = snapshot.users.findIndex((row) => row.id === activeUserId);
        if (index === -1) return fail('Aktiv istifadəçi tapılmadı.', 404);

        const current = snapshot.users[index];
        const next = {
          ...current,
          name: body.name !== undefined ? String(body.name) : current.name,
          email: body.email !== undefined ? normalizeEmail(body.email) : current.email,
          phone: body.phone !== undefined ? (body.phone ? String(body.phone) : null) : current.phone,
        };
        snapshot.users[index] = next;
        await saveSnapshot(env, loaded.target, snapshot);
        return json(next);
      }

      if (url.pathname === '/api/notifications' && method === 'PATCH') {
        const body = await readJson(request);
        const loaded = await loadSnapshot(env, body.target);
        if (!loaded) return fail('Məlumat bazası tapılmadı.', 404);

        const { snapshot } = loaded;
        const read = Boolean(body.read);
        const id = body.id === undefined || body.id === null ? null : Number(body.id);
        snapshot.notifications = snapshot.notifications.map((notification) => (
          id === null || notification.id === id
            ? { ...notification, readAt: read ? Date.now() : null }
            : notification
        ));
        await saveSnapshot(env, loaded.target, snapshot);
        return json(snapshot.notifications);
      }

      // ---------------------------------------------------------------------
      // SMS OTP is intentionally disabled until the provider is connected.
      // ---------------------------------------------------------------------
      if (url.pathname === '/api/send-otp' || url.pathname === '/api/verify-otp') {
        return fail('SMS ilə giriş hələ aktiv deyil.', 501, { code: 'sms_not_configured' });
      }

      return fail('API route tapılmadı.', 404);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return fail(message, 500);
    }
  },
};

# Cloudflare backend

The mobile app no longer reads the local PostgreSQL server. It reads one JSON
`DatabaseSnapshot` per `database_target` from D1 through the `businessappapi`
Worker.

## Pieces

- Worker: `businessappapi` → `https://businessappapi.promar.workers.dev`
- D1 `users` (`USERS_D1`) — login accounts, Google OAuth state, one-time codes
- D1 `businessapp-main` (`MAIN_D1`) — table `app_snapshots(database_target, data, updated_at)`
- Admin panel: `https://businessapp.promar.workers.dev` (calls `/api/admin/users`)

## Upload local PostgreSQL data to D1

```bash
# 1. Export the local database and write worker/seed/snapshot-main.sql
node worker/scripts/export-snapshot.mjs

# 2. Upload it to D1
npx wrangler d1 execute businessapp-main --remote --file=worker/seed/snapshot-main.sql
```

The export uses `DATABASE_URL` from `.env.local`.

## Deploy the Worker

```bash
npx wrangler deploy -c worker/wrangler.jsonc
```

Secrets (already set in production):

```bash
npx wrangler secret put GOOGLE_CLIENT_ID -c worker/wrangler.jsonc
npx wrangler secret put GOOGLE_CLIENT_SECRET -c worker/wrangler.jsonc
```

## Google sign-in flow

1. App opens `GET /api/google/start?redirect_uri=dashboardapp://google-callback`.
2. Worker redirects to Google with `redirect_uri=https://businessappapi.promar.workers.dev/api/google/callback`.
3. Google returns to the Worker, which creates/updates the user with status `p` (pending)
   and redirects to `dashboardapp://google-callback?code=...`.
4. App exchanges the code with `POST /api/google/session`.
   - `403 {status:'p'}` → pending, show a message
   - `403 {status:'r'}` → rejected
   - `200 {user}` → accepted, app loads `user.database_target` snapshot
5. Admin accepts the user on the panel and assigns `database_target`.

The Google Cloud OAuth **Web application** client must have
`https://businessappapi.promar.workers.dev/api/google/callback` as an authorized
redirect URI, and the Gmail account must be allowed on the OAuth consent screen
(test user while the app is in Testing).

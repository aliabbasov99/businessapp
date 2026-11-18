import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { getApiOrigin, type AuthResponse, type AuthUser } from '@/data/api';
import { signInWithGoogleCredential } from '@/utils/google-credential';

// Web OAuth client. On Android it is passed to Credential Manager as
// `serverClientId`, so the returned Google ID token has this client as its
// audience. The Android OAuth client in Google Cloud only verifies the package
// name + signing certificate; it has no client secret.
export const GOOGLE_WEB_CLIENT_ID =
  '770057052741-gfrecrt4vgajujsafh78878ivadv70pq.apps.googleusercontent.com';

// Browser fallback (iOS). Must match the scheme registered in app.json and the
// redirect_uri sent to the Worker (/api/google/start stores it with the state).
export const GOOGLE_REDIRECT_URI = 'dashboardapp://google-callback';

export type GoogleAuthResult =
  | { status: 'success'; user: AuthUser }
  | { status: 'pending'; message: string; pendingToken?: string; email?: string }
  | { status: 'rejected'; message: string }
  | { status: 'cancelled' };

export class GoogleAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleAuthError';
  }
}

async function parseAuthResponse(response: Response): Promise<GoogleAuthResult> {
  const data = (await response.json().catch(() => null)) as AuthResponse | null;
  if (!data) throw new GoogleAuthError('Server cavabı oxunmadı.');

  if (response.ok && data.success && data.user) {
    return { status: 'success', user: data.user };
  }
  if (data.status === 'p') {
    return {
      status: 'pending',
      message: data.message || 'Hesabınız admin təsdiqini gözləyir.',
      pendingToken: data.pending_token,
      email: data.email,
    };
  }
  if (data.status === 'r') {
    return { status: 'rejected', message: data.message || 'Hesabınız rədd edilib.' };
  }
  throw new GoogleAuthError(data.message || 'Google girişi tamamlanmadı.');
}

async function exchangeGoogleCode(code: string): Promise<GoogleAuthResult> {
  const response = await fetch(`${getApiOrigin()}/api/google/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  return parseAuthResponse(response);
}

async function exchangeIdToken(idToken: string): Promise<GoogleAuthResult> {
  const response = await fetch(`${getApiOrigin()}/api/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_token: idToken }),
  });
  return parseAuthResponse(response);
}

function getErrorCode(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : null;
  }
  return null;
}

/**
 * Native Android flow: Android Credential Manager shows the Google account
 * picker as a bottom sheet inside the app (no browser, no popup window). The
 * returned id_token is verified by the Worker, which applies the
 * pending/accepted status.
 */
async function signInWithGoogleNative(): Promise<GoogleAuthResult> {
  try {
    const idToken = await signInWithGoogleCredential(GOOGLE_WEB_CLIENT_ID);
    if (!idToken) throw new GoogleAuthError('Google ID token alınmadı.');
    return await exchangeIdToken(idToken);
  } catch (error) {
    if (error instanceof GoogleAuthError) throw error;

    const code = getErrorCode(error);

    if (code === 'SIGN_IN_CANCELLED') return { status: 'cancelled' };

    if (code === 'NO_CREDENTIAL') {
      throw new GoogleAuthError(
        'Cihazda Google hesabı tapılmadı. Telefonun ayarlarına Gmail hesabı əlavə edin.',
      );
    }

    if (code === 'ERR_NO_ACTIVITY') {
      throw new GoogleAuthError('Google pəncərəsi açılmadı. Tətbiqi yenidən açıb yoxlayın.');
    }

    if (code === 'GOOGLE_CREDENTIAL_ERROR') {
      const detail = error instanceof Error && error.message ? ` (${error.message})` : '';
      throw new GoogleAuthError(
        `Google girişi alınmadı${detail}. Google Play Services və Google Cloud Android OAuth client ayarlarını yoxlayın.`,
      );
    }

    throw new GoogleAuthError(
      error instanceof Error ? error.message : 'Google ilə giriş alınmadı.',
    );
  }
}

/**
 * Browser flow through the Cloudflare Worker (used on iOS). The Worker receives
 * the Google redirect and forwards a one-time code back to the app.
 */
async function signInWithGoogleBrowser(): Promise<GoogleAuthResult> {
  const startUrl = `${getApiOrigin()}/api/google/start?redirect_uri=${encodeURIComponent(GOOGLE_REDIRECT_URI)}`;
  const result = await WebBrowser.openAuthSessionAsync(startUrl, GOOGLE_REDIRECT_URI);

  if (result.type !== 'success') {
    if (result.type === 'cancel' || result.type === 'dismiss') return { status: 'cancelled' };
    throw new GoogleAuthError('Google pəncərəsi açılmadı.');
  }

  let params: URLSearchParams;
  try {
    params = new URL(result.url).searchParams;
  } catch {
    throw new GoogleAuthError('Google cavabı oxunmadı.');
  }

  const error = params.get('error');
  if (error) {
    throw new GoogleAuthError(params.get('error_description') || 'Google girişi alınmadı.');
  }

  const code = params.get('code');
  if (!code) throw new GoogleAuthError('Google giriş kodu alınmadı.');

  return exchangeGoogleCode(code);
}

export async function signInWithGoogle(): Promise<GoogleAuthResult> {
  return Platform.OS === 'android' ? signInWithGoogleNative() : signInWithGoogleBrowser();
}

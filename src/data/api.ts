import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase, getSnapshot, setDatabase } from './database';
import type { AppNotification, DatabaseSnapshot, User } from './schema';
import { createDataSync } from './sync';

// All application data is served by the Cloudflare Worker. The origin can be
// overridden at build time with EXPO_PUBLIC_API_URL (see .env.local).
export const DEFAULT_API_ORIGIN = 'https://businessappapi.promar.workers.dev';

export function getApiOrigin() {
  return (process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_ORIGIN).replace(/\/$/, '');
}

// The D1 snapshot that belongs to the signed-in user (users.database_target).
let activeTarget: string | null = null;

export function setApiTarget(target?: string | null) {
  const next = String(target ?? '').trim();
  activeTarget = next || null;
}

export function getApiTarget() {
  return activeTarget;
}

export class ApiError extends Error {
  readonly status: number;
  readonly data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export async function requestApi<T>(path: string, init?: RequestInit): Promise<T> {
  const url = new URL(`${getApiOrigin()}/api/${path}`);
  if (activeTarget && !url.searchParams.has('target')) {
    url.searchParams.set('target', activeTarget);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url.toString(), {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
    const text = await response.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!response.ok) {
      const message = data && typeof data === 'object' && 'message' in data
        ? String((data as { message?: unknown }).message)
        : `API request failed (${response.status})`;
      throw new ApiError(message, response.status, data);
    }
    return data as T;
  } finally {
    clearTimeout(timeout);
  }
}

export type AuthUser = {
  id: number;
  email: string;
  phone: string | null;
  name: string | null;
  picture: string | null;
  auth_provider: string;
  database_target: string | null;
  status: 'a' | 'p' | 'r';
};

export type AuthResponse = {
  success: boolean;
  status: 'a' | 'p' | 'r';
  message: string;
  user?: AuthUser;
  /** Present on pending responses: lets the app poll without re-signing-in. */
  pending_token?: string;
  email?: string;
};

export type PendingStatusResponse = {
  success: boolean;
  status: 'a' | 'p' | 'r' | 'expired';
  message: string;
  email?: string;
  user?: AuthUser;
};

export function loginWithPassword(email: string, password: string) {
  return requestApi<AuthResponse>('login', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim(), password }),
  });
}

export function checkPendingStatus(token: string) {
  return requestApi<PendingStatusResponse>('pending', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export const dataSync = createDataSync({
  storage: AsyncStorage,
  get cacheKey() {
    // Keep a separate offline cache per target so switching users never shows
    // another company's data.
    return `promar.snapshot.v1:${getApiOrigin()}:${activeTarget ?? 'main'}`;
  },
  fetchSnapshot: () => requestApi<DatabaseSnapshot>('bootstrap'),
  getSnapshot,
  setSnapshot: setDatabase,
});
export const loadDatabase = dataSync.refresh;

export async function saveProfile(profile: { name: string; email: string; phone: string }) {
  const user = await requestApi<User>('profile', {
    method: 'PATCH',
    body: JSON.stringify({ ...profile, target: activeTarget }),
  });
  const db = getDatabase();
  await dataSync.commit({ ...db, users: db.users.map(row => row.id === user.id ? user : row) });
  return user;
}

export async function saveNotificationRead(read: boolean, id?: number) {
  const notifications = await requestApi<AppNotification[]>('notifications', {
    method: 'PATCH',
    body: JSON.stringify({ read, target: activeTarget, ...(id === undefined ? {} : { id }) }),
  });
  const db = getDatabase();
  await dataSync.commit({ ...db, notifications });
}

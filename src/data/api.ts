import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase, getSnapshot, setDatabase } from './database';
import type { AppNotification, DatabaseSnapshot, User } from './schema';
import { createDataSync } from './sync';

// Expo Router resolves relative fetch URLs against Metro on native development builds.
// Standalone builds may set a public HTTP origin. Credentials remain server-side.
export async function requestApi<T>(path: string, init?: RequestInit): Promise<T> {
  const origin = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${origin}/api/${path}`, {
      ...init, signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
    if (!response.ok) throw new Error(`API request failed (${response.status})`);
    return await response.json() as T;
  } finally { clearTimeout(timeout); }
}

export const dataSync = createDataSync({
  storage: AsyncStorage,
  cacheKey: `promar.snapshot.v1:${process.env.EXPO_PUBLIC_API_URL ?? 'local-demo'}`,
  fetchSnapshot: () => requestApi<DatabaseSnapshot>('bootstrap'),
  getSnapshot,
  setSnapshot: setDatabase,
});
export const loadDatabase = dataSync.refresh;
export async function saveProfile(profile: { name: string; email: string; phone: string }) {
  const user = await requestApi<User>('profile', { method: 'PATCH', body: JSON.stringify(profile) });
  const db = getDatabase();
  await dataSync.commit({ ...db, users: db.users.map(row => row.id === user.id ? user : row) });
  return user;
}
export async function saveNotificationRead(read: boolean, id?: number) {
  const notifications = await requestApi<AppNotification[]>('notifications', {
    method: 'PATCH', body: JSON.stringify({ read, ...(id === undefined ? {} : { id }) }),
  });
  const db = getDatabase();
  await dataSync.commit({ ...db, notifications });
}

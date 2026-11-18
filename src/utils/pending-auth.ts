import AsyncStorage from '@react-native-async-storage/async-storage';

// Locally stored "waiting for approval" session. While this record exists the
// app opens on the pending screen and polls the Worker with the token instead
// of asking the user to sign in with the same account again.
const PENDING_KEY = 'promar.pending.v1';

export type PendingAuth = {
  token: string;
  email: string | null;
  provider: string;
  savedAt: number;
};

export async function savePendingAuth(entry: { token: string; email?: string | null; provider: string }) {
  if (!entry.token) return;
  const record: PendingAuth = {
    token: entry.token,
    email: entry.email ?? null,
    provider: entry.provider,
    savedAt: Date.now(),
  };
  try {
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(record));
  } catch {
    // Storage failures only mean the legacy one-shot alert is shown instead.
  }
}

export async function getPendingAuth(): Promise<PendingAuth | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingAuth> | null;
    if (!parsed || typeof parsed.token !== 'string' || !parsed.token) return null;
    return {
      token: parsed.token,
      email: typeof parsed.email === 'string' ? parsed.email : null,
      provider: typeof parsed.provider === 'string' ? parsed.provider : 'unknown',
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : 0,
    };
  } catch {
    return null;
  }
}

export async function clearPendingAuth() {
  try {
    await AsyncStorage.removeItem(PENDING_KEY);
  } catch {
    // Nothing to recover from: the next check will report the token as gone.
  }
}

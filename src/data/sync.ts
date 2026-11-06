import type { DatabaseSnapshot } from './schema';
import { assertSnapshot } from './snapshot-validation';

export const INITIAL_SYNC_STATE = { phase: 'loading', savedAt: null, cacheAvailable: false } as const;
export type SyncState = {
  phase: 'loading' | 'refreshing' | 'online' | 'offline';
  savedAt: number | null;
  cacheAvailable: boolean;
};
type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
type Options = {
  storage: Storage;
  cacheKey: string;
  fetchSnapshot: () => Promise<unknown>;
  getSnapshot: () => DatabaseSnapshot | null;
  setSnapshot: (snapshot: DatabaseSnapshot) => void;
};

/** The phone keeps one last successful response, not an independent SQL database. */
export function createDataSync(options: Options) {
  let state: SyncState = INITIAL_SYNC_STATE;
  const listeners = new Set<() => void>();
  let restoring: Promise<void> | undefined;
  let refreshing: Promise<boolean> | undefined;
  let writes = Promise.resolve();
  let revision = 0;
  const publish = (update: Partial<SyncState>) => {
    state = { ...state, ...update };
    listeners.forEach(listener => listener());
  };
  function restore() {
    restoring ??= (async () => {
      try {
        const raw = await options.storage.getItem(options.cacheKey);
        if (!raw || options.getSnapshot()) return;
        const cached: unknown = JSON.parse(raw);
        if (!cached || typeof cached !== 'object' || !('version' in cached) || cached.version !== 1
          || !('savedAt' in cached) || typeof cached.savedAt !== 'number' || !Number.isSafeInteger(cached.savedAt)
          || !('data' in cached)) return;
        assertSnapshot(cached.data);
        options.setSnapshot(cached.data);
        publish({ savedAt: cached.savedAt, cacheAvailable: true });
      } catch {
        // A missing, unreadable or incompatible cache must not prevent an online load.
      }
    })();
    return restoring;
  }
  async function commit(snapshot: DatabaseSnapshot) {
    assertSnapshot(snapshot);
    revision++;
    const acceptedRevision = revision;
    const savedAt = Date.now();
    options.setSnapshot(snapshot);
    publish({ phase: 'online', savedAt });
    // Serialize writes so a slower old response cannot replace the latest cache.
    const serialized = JSON.stringify({ version: 1, savedAt, data: snapshot });
    const write = writes.then(() => options.storage.setItem(options.cacheKey, serialized));
    writes = write.catch(() => undefined);
    try {
      await write;
      if (revision === acceptedRevision) publish({ cacheAvailable: true });
    } catch {
      // Live data remains usable even if storage is full. Do not claim it was saved.
      if (revision === acceptedRevision) publish({ cacheAvailable: false });
    }
  }
  function refresh() {
    refreshing ??= (async () => {
      await restore();
      const beforeFetch = revision;
      publish({ phase: options.getSnapshot() ? 'refreshing' : 'loading' });
      try {
        const fresh = await options.fetchSnapshot();
        assertSnapshot(fresh);
        // A profile/read-state write confirmed after this fetch started takes priority.
        if (beforeFetch === revision) await commit(fresh);
        return true;
      } catch {
        if (beforeFetch === revision) publish({ phase: 'offline' });
        return false;
      }
    })().finally(() => { refreshing = undefined; });
    return refreshing;
  }
  return {
    refresh,
    commit,
    getState: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}

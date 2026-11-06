import { useSyncExternalStore } from 'react';
import { getDatabase, getSnapshot, subscribe } from '@/data/database';

export function useDatabaseSnapshot() {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
export function useDatabase() {
  useDatabaseSnapshot();
  return getDatabase();
}

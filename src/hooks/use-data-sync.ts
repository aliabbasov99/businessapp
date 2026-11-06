import { useSyncExternalStore } from 'react';
import { dataSync } from '@/data/api';
import { INITIAL_SYNC_STATE } from '@/data/sync';

export function useDataSync() {
  return useSyncExternalStore(dataSync.subscribe, dataSync.getState, () => INITIAL_SYNC_STATE);
}

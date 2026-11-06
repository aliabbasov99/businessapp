import type { DatabaseSnapshot } from './schema';
import { assertSnapshot } from './snapshot-validation';

let snapshot: DatabaseSnapshot | null = null;
const listeners = new Set<() => void>();

export function getSnapshot() { return snapshot; }
export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function setDatabase(value: DatabaseSnapshot) {
  assertSnapshot(value);
  snapshot = value;
  listeners.forEach(listener => listener());
}
export function getDatabase(): DatabaseSnapshot {
  if (!snapshot) throw new Error('Data must be loaded from the API before rendering this screen');
  return snapshot;
}
export function getById<T extends { id: number }>(rows: readonly T[], id: number): T {
  const row = rows.find(item => item.id === id);
  if (!row) throw new Error(`Missing record: ${id}`);
  return row;
}

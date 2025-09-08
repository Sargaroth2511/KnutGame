export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY = 'knut_highscore_v1';

export function getHighscore(storage?: KeyValueStorage): number {
  const s = storage ?? (globalThis.localStorage as unknown as KeyValueStorage);
  try {
    const raw = s?.getItem(KEY);
    const n = raw ? Number(JSON.parse(raw)) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function setHighscore(value: number, storage?: KeyValueStorage): void {
  const s = storage ?? (globalThis.localStorage as unknown as KeyValueStorage);
  if (!s) return;
  const v = Math.max(0, Math.floor(value));
  try { s.setItem(KEY, JSON.stringify(v)); } catch { /* ignore */ }
}

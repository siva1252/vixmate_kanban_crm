/** In-memory + sessionStorage GET cache so revisiting tabs skips loaders/network. */

type Entry<T> = { at: number; data: T };

const store = new Map<string, Entry<unknown>>();
const DEFAULT_TTL_MS = 5 * 60_000; // 5 minutes
const STORAGE_PREFIX = "vix.cache.";

function canUseStorage() {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

function readStorage<T>(key: string, ttlMs: number): T | null {
  if (!canUseStorage()) return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Entry<T>;
    if (!parsed || typeof parsed.at !== "number") return null;
    if (Date.now() - parsed.at > ttlMs) {
      sessionStorage.removeItem(STORAGE_PREFIX + key);
      return null;
    }
    store.set(key, parsed);
    return parsed.data;
  } catch {
    return null;
  }
}

function writeStorage<T>(key: string, entry: Entry<T>) {
  if (!canUseStorage()) return;
  try {
    sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // quota / private mode — memory cache still works
  }
}

function clearStorage(prefix?: string) {
  if (!canUseStorage()) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const k = sessionStorage.key(i);
      if (!k || !k.startsWith(STORAGE_PREFIX)) continue;
      const logical = k.slice(STORAGE_PREFIX.length);
      if (!prefix || logical.startsWith(prefix)) keys.push(k);
    }
    for (const k of keys) sessionStorage.removeItem(k);
  } catch {
    // ignore
  }
}

export function cacheGet<T>(key: string, ttlMs = DEFAULT_TTL_MS): T | null {
  const hit = store.get(key);
  if (hit) {
    if (Date.now() - hit.at > ttlMs) {
      store.delete(key);
    } else {
      return hit.data as T;
    }
  }
  return readStorage<T>(key, ttlMs);
}

export function cacheSet<T>(key: string, data: T) {
  const entry: Entry<T> = { at: Date.now(), data };
  store.set(key, entry);
  writeStorage(key, entry);
}

export function cacheInvalidate(prefix?: string) {
  if (!prefix) {
    store.clear();
    clearStorage();
    return;
  }
  for (const key of [...store.keys()]) {
    if (key.startsWith(prefix)) store.delete(key);
  }
  clearStorage(prefix);
}

/** True when fresh cached data exists (for skipping full-page loaders). */
export function cacheHas(key: string, ttlMs = DEFAULT_TTL_MS): boolean {
  return cacheGet(key, ttlMs) !== null;
}

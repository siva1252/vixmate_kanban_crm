/** In-memory GET cache. Not persisted — sessionStorage was keeping stale boards/lists after create/delete. */

type Entry<T> = { at: number; data: T };

const store = new Map<string, Entry<unknown>>();
const DEFAULT_TTL_MS = 60_000; // 1 minute — warm nav only; mutations invalidate + pages force-refetch
const STORAGE_PREFIX = "vix.cache.";

// One-time cleanup of old sessionStorage cache from previous builds.
if (typeof window !== "undefined") {
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const k = sessionStorage.key(i);
      if (k?.startsWith(STORAGE_PREFIX)) keys.push(k);
    }
    for (const k of keys) sessionStorage.removeItem(k);
  } catch {
    // ignore
  }
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

/** Drop legacy sessionStorage entries from older builds. */
function clearLegacyStorage(prefix?: string) {
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
  if (!hit) return null;
  if (Date.now() - hit.at > ttlMs) {
    store.delete(key);
    return null;
  }
  return hit.data as T;
}

export function cacheSet<T>(key: string, data: T) {
  store.set(key, { at: Date.now(), data });
}

export function cacheInvalidate(prefix?: string) {
  if (!prefix) {
    store.clear();
    clearLegacyStorage();
    return;
  }
  for (const key of [...store.keys()]) {
    if (key.startsWith(prefix)) store.delete(key);
  }
  clearLegacyStorage(prefix);
}

/** True when fresh cached data exists (for skipping full-page loaders). */
export function cacheHas(key: string, ttlMs = DEFAULT_TTL_MS): boolean {
  return cacheGet(key, ttlMs) !== null;
}

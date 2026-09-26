const DATABASE_NAME = "threadly-nest-page-cache.db";
const MAX_ENTRIES_PER_OWNER = 150;

type CacheRow = { payload: string; updated_at: number };

let databasePromise: ReturnType<typeof initializeDatabase> | null = null;

async function initializeDatabase() {
  const SQLite = await import("expo-sqlite");
  const database = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS page_cache (
      owner_key TEXT NOT NULL,
      cache_key TEXT NOT NULL,
      payload TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (owner_key, cache_key)
    );
    CREATE INDEX IF NOT EXISTS page_cache_owner_updated_idx
      ON page_cache (owner_key, updated_at DESC);
  `);
  return database;
}

function getDatabase() {
  if (!databasePromise) databasePromise = initializeDatabase();
  return databasePromise;
}

export function createPageCacheOwner(role?: string | null, email?: string | null) {
  const normalizedEmail = email?.trim().toLowerCase();
  return role && normalizedEmail ? `${role}:${normalizedEmail}` : null;
}

export async function readPageCache<T>(ownerKey: string | null, cacheKey: string): Promise<T | null> {
  if (!ownerKey) return null;
  try {
    const database = await getDatabase();
    const row = await database.getFirstAsync<CacheRow>(
      "SELECT payload, updated_at FROM page_cache WHERE owner_key = ? AND cache_key = ?",
      ownerKey,
      cacheKey
    );
    return row ? JSON.parse(row.payload) as T : null;
  } catch (error) {
    console.warn("Failed to read cached page data:", error);
    return null;
  }
}

export async function writePageCache<T>(ownerKey: string | null, cacheKey: string, payload: T) {
  if (!ownerKey) return;
  try {
    const database = await getDatabase();
    await database.runAsync(
      `INSERT INTO page_cache (owner_key, cache_key, payload, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(owner_key, cache_key) DO UPDATE SET
         payload = excluded.payload,
         updated_at = excluded.updated_at`,
      ownerKey,
      cacheKey,
      JSON.stringify(payload),
      Date.now()
    );
    await database.runAsync(
      `DELETE FROM page_cache
       WHERE owner_key = ? AND rowid NOT IN (
         SELECT rowid FROM page_cache WHERE owner_key = ?
         ORDER BY updated_at DESC LIMIT ?
       )`,
      ownerKey,
      ownerKey,
      MAX_ENTRIES_PER_OWNER
    );
  } catch (error) {
    console.warn("Failed to cache page data:", error);
  }
}

export async function clearPageCache() {
  try {
    const database = await getDatabase();
    await database.runAsync("DELETE FROM page_cache");
  } catch (error) {
    console.warn("Failed to clear cached page data:", error);
  }
}

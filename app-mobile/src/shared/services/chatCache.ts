const DATABASE_NAME = "threadly-nest-chat.db";
const MAX_CACHED_CONVERSATIONS_PER_USER = 100;

type CacheRow = {
  payload: string;
};

let initializedDatabasePromise: ReturnType<typeof initializeDatabase> | null = null;

async function initializeDatabase() {
  // Dynamic loading keeps chat usable in an older development build that does
  // not include the SQLite native module yet. Cache calls then fail softly and
  // the screens continue using the server as their source of truth.
  const SQLite = await import("expo-sqlite");
  const database = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS chat_cache (
      owner_key TEXT NOT NULL,
      scope TEXT NOT NULL,
      conversation_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (owner_key, scope, conversation_id)
    );
    CREATE INDEX IF NOT EXISTS chat_cache_owner_updated_idx
      ON chat_cache (owner_key, updated_at DESC);
  `);
  return database;
}

async function getDatabase() {
  if (!initializedDatabasePromise) {
    initializedDatabasePromise = initializeDatabase();
  }
  return initializedDatabasePromise;
}

export function createChatCacheOwner(
  role: string | null | undefined,
  email: string | null | undefined
): string | null {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!role || !normalizedEmail) return null;
  return `${role}:${normalizedEmail}`;
}

export async function readChatCache<T>(
  ownerKey: string | null,
  scope: string,
  conversationId: string | null | undefined
): Promise<T | null> {
  if (!ownerKey || !conversationId) return null;

  try {
    const database = await getDatabase();
    const row = await database.getFirstAsync<CacheRow>(
      `SELECT payload
       FROM chat_cache
       WHERE owner_key = ? AND scope = ? AND conversation_id = ?`,
      ownerKey,
      scope,
      conversationId
    );
    if (!row) return null;

    return JSON.parse(row.payload) as T;
  } catch (error) {
    console.warn("Failed to read cached chat history:", error);
    return null;
  }
}

export async function writeChatCache<T>(
  ownerKey: string | null,
  scope: string,
  conversationId: string | null | undefined,
  payload: T
): Promise<void> {
  if (!ownerKey || !conversationId) return;

  try {
    const database = await getDatabase();
    const serializedPayload = JSON.stringify(payload);
    const updatedAt = Date.now();

    await database.runAsync(
      `INSERT INTO chat_cache (owner_key, scope, conversation_id, payload, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(owner_key, scope, conversation_id) DO UPDATE SET
         payload = excluded.payload,
         updated_at = excluded.updated_at
       WHERE chat_cache.payload <> excluded.payload`,
      ownerKey,
      scope,
      conversationId,
      serializedPayload,
      updatedAt
    );

    await database.runAsync(
      `DELETE FROM chat_cache
       WHERE owner_key = ?
         AND rowid NOT IN (
           SELECT rowid
           FROM chat_cache
           WHERE owner_key = ?
           ORDER BY updated_at DESC
           LIMIT ?
         )`,
      ownerKey,
      ownerKey,
      MAX_CACHED_CONVERSATIONS_PER_USER
    );
  } catch (error) {
    console.warn("Failed to cache chat history:", error);
  }
}

export async function clearChatCache(): Promise<void> {
  try {
    const database = await getDatabase();
    await database.runAsync("DELETE FROM chat_cache");
  } catch (error) {
    console.warn("Failed to clear cached chat history:", error);
  }
}

export async function deleteCachedConversation(
  ownerKey: string | null,
  scope: string,
  conversationId: string | null | undefined
): Promise<void> {
  if (!ownerKey || !conversationId) return;

  try {
    const database = await getDatabase();
    await database.runAsync(
      `DELETE FROM chat_cache
       WHERE owner_key = ? AND scope = ? AND conversation_id = ?`,
      ownerKey,
      scope,
      conversationId
    );
  } catch (error) {
    console.warn("Failed to delete cached conversation:", error);
  }
}

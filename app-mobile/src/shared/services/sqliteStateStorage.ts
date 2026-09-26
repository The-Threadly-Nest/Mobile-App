import type { StateStorage } from "zustand/middleware";

const DATABASE_NAME = "threadly-nest-state.db";
let databasePromise: ReturnType<typeof initializeDatabase> | null = null;

async function initializeDatabase() {
  const SQLite = await import("expo-sqlite");
  const database = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS persisted_state (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  return database;
}

function getDatabase() {
  if (!databasePromise) databasePromise = initializeDatabase();
  return databasePromise;
}

export const sqliteStateStorage: StateStorage = {
  async getItem(name) {
    try {
      const database = await getDatabase();
      const row = await database.getFirstAsync<{ value: string }>(
        "SELECT value FROM persisted_state WHERE key = ?",
        name
      );
      return row?.value ?? null;
    } catch (error) {
      console.warn("Failed to restore local app data:", error);
      return null;
    }
  },
  async setItem(name, value) {
    try {
      const database = await getDatabase();
      await database.runAsync(
        `INSERT INTO persisted_state (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        name,
        value,
        Date.now()
      );
    } catch (error) {
      console.warn("Failed to save local app data:", error);
    }
  },
  async removeItem(name) {
    try {
      const database = await getDatabase();
      await database.runAsync("DELETE FROM persisted_state WHERE key = ?", name);
    } catch (error) {
      console.warn("Failed to remove local app data:", error);
    }
  },
};

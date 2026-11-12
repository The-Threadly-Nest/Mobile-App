import * as SecureStore from "expo-secure-store";
import { Image } from "expo-image";
import * as FileSystem from "expo-file-system/legacy";
import { clearChatCache } from "./chatCache";
import { clearPageCache } from "./pageCache";
import { clearPersistedAccountState } from "./sqliteStateStorage";

const CLEANUP_PENDING = "owuja-account-cleanup-pending";
let pending: Promise<void> | null = null;
// A durable marker lets the next launch retry an interrupted cleanup.
export function clearAccountDeviceData() {
  if (pending) return pending;
  pending = (async () => {
    await SecureStore.setItemAsync(CLEANUP_PENDING, "1");
    const results = await Promise.allSettled([clearChatCache(), clearPageCache(), clearPersistedAccountState(), Image.clearMemoryCache(), Image.clearDiskCache()]);
    // Only this app's temporary directory, never documents or bundled assets.
    if (FileSystem.cacheDirectory) {
      const root = FileSystem.cacheDirectory;
      for (const name of await FileSystem.readDirectoryAsync(root)) {
        if (!name.includes("/") && !name.includes("\\") && name !== "." && name !== "..") {
          await FileSystem.deleteAsync(`${root}${name}`, { idempotent: true });
        }
      }
    }
    if (results.some(result => result.status === "rejected" || result.value === false)) throw new Error("Account cache cleanup is incomplete");
    await SecureStore.deleteItemAsync(CLEANUP_PENDING);
  })().catch(() => {
    console.warn("Local account cleanup will be retried when the app opens again.");
  }).finally(() => { pending = null; });
  return pending;
}
export async function retryAccountCleanup() {
  if (await SecureStore.getItemAsync(CLEANUP_PENDING)) await clearAccountDeviceData();
}

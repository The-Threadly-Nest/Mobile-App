import { apiFetch, ApiError } from "./apiClient";

export type SavedCatalogItem = { id: string; name: string; imageUrl: string; priceFrom: number | null };
export type SavedCatalogProfile = { savedCatalogIds: string[]; savedItems: SavedCatalogItem[] };

export async function loadCatalogFavorites(): Promise<SavedCatalogProfile> {
  try {
    const profile = await apiFetch<SavedCatalogProfile>("/api/preferences", { silent: true });
    if (!Array.isArray(profile.savedCatalogIds) || !Array.isArray(profile.savedItems)) {
      throw new Error("We couldn't load your saved items. Please try again shortly.");
    }
    return profile;
  } catch (error) {
    if (error instanceof ApiError && error.details.status === 404) return { savedCatalogIds: [], savedItems: [] };
    throw error;
  }
}

export async function saveCatalogFavorite(id: string, saved: boolean): Promise<SavedCatalogProfile> {
  // Read current server state instead of overwriting favorites from a stale screen.
  const current = await loadCatalogFavorites();
  const ids = new Set(current.savedCatalogIds);
  if (saved) ids.add(id); else ids.delete(id);
  const profile = await apiFetch<SavedCatalogProfile>("/api/preferences", {
    method: "POST", body: JSON.stringify({ savedCatalogIds: [...ids] }), silent: true,
  });
  if (!Array.isArray(profile.savedCatalogIds) || !Array.isArray(profile.savedItems)) {
    throw new Error("We couldn't confirm your saved items. Please refresh and try again.");
  }
  return profile;
}

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";

interface AppDataState {
  profile: any | null;
  orders: any[];
  staffList: any[];
  catalogItems: any[];
  escalations: any[];
  lastSyncedAt: number | null;
  unreadMessageCount: number;
  setProfile: (profile: any) => void;
  setOrders: (orders: any[]) => void;
  setStaffList: (staffList: any[]) => void;
  setCatalogItems: (items: any[]) => void;
  setEscalations: (items: any[]) => void;
  setLastSyncedAt: (timestamp: number) => void;
  setUnreadMessageCount: (count: number) => void;
  clearCache: () => void;
}

const secureStorage = {
  getItem: async (name: string) => {
    try {
      return (await SecureStore.getItemAsync(name)) ?? null;
    } catch {
      return null;
    }
  },
  setItem: async (name: string, value: string) => {
    try {
      if (value.length > 2000) return; // Prevent Android SecureStore 2048-byte limit warning
      await SecureStore.setItemAsync(name, value);
    } catch {}
  },
  removeItem: async (name: string) => {
    try {
      await SecureStore.deleteItemAsync(name);
    } catch {}
  },
};

export const useAppDataStore = create<AppDataState>()(
  persist(
    (set) => ({
      profile: null,
      orders: [],
      staffList: [],
      catalogItems: [],
      escalations: [],
      lastSyncedAt: null,
      unreadMessageCount: 0,
      setProfile: (profile) => set({ profile }),
      setOrders: (orders) => set({ orders }),
      setStaffList: (staffList) => set({ staffList }),
      setCatalogItems: (catalogItems) => set({ catalogItems }),
      setEscalations: (escalations) => set({ escalations }),
      setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
      setUnreadMessageCount: (unreadMessageCount) => set({ unreadMessageCount }),
      clearCache: () =>
        set({
          profile: null,
          orders: [],
          staffList: [],
          catalogItems: [],
          escalations: [],
          lastSyncedAt: null,
          unreadMessageCount: 0,
        }),
    }),
    { name: "threadly-nest-app-data-cache", storage: createJSONStorage(() => secureStorage) }
  )
);

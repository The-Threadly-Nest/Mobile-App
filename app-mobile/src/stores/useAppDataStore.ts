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
  setProfile: (profile: any) => void;
  setOrders: (orders: any[]) => void;
  setStaffList: (staffList: any[]) => void;
  setCatalogItems: (items: any[]) => void;
  setEscalations: (items: any[]) => void;
  setLastSyncedAt: (timestamp: number) => void;
  clearCache: () => void;
}

const secureStorage = {
  getItem: async (name: string) => (await SecureStore.getItemAsync(name)) ?? null,
  setItem: async (name: string, value: string) => SecureStore.setItemAsync(name, value),
  removeItem: async (name: string) => SecureStore.deleteItemAsync(name),
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
      setProfile: (profile) => set({ profile }),
      setOrders: (orders) => set({ orders }),
      setStaffList: (staffList) => set({ staffList }),
      setCatalogItems: (catalogItems) => set({ catalogItems }),
      setEscalations: (escalations) => set({ escalations }),
      setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
      clearCache: () =>
        set({
          profile: null,
          orders: [],
          staffList: [],
          catalogItems: [],
          escalations: [],
          lastSyncedAt: null,
        }),
    }),
    { name: "threadly-nest-app-data-cache", storage: createJSONStorage(() => secureStorage) }
  )
);

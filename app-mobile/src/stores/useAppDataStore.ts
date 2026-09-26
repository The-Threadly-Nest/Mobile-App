import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { sqliteStateStorage } from "@/shared/services/sqliteStateStorage";

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
    { name: "threadly-nest-app-data-cache", storage: createJSONStorage(() => sqliteStateStorage) }
  )
);

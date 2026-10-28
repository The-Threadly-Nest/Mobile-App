import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { sqliteStateStorage } from "@/shared/services/sqliteStateStorage";

export const APP_DATA_CACHE_TTL_MS = 30 * 60 * 1000;

export interface CachedDashboardSummary {
  activeOrdersCount: number;
  pendingBookingsCount: number;
  revenueThisMonth: number;
}

interface AppDataState {
  cacheOwnerKey: string | null;
  profile: any | null;
  orders: any[];
  staffList: any[];
  catalogItems: any[];
  escalations: any[];
  dashboardSummary: CachedDashboardSummary | null;
  lastSyncedAt: number | null;
  unreadMessageCount: number;
  setProfile: (profile: any) => void;
  setOrders: (orders: any[]) => void;
  setStaffList: (staffList: any[]) => void;
  setCatalogItems: (items: any[]) => void;
  setEscalations: (items: any[]) => void;
  setDashboardSummary: (summary: CachedDashboardSummary) => void;
  setLastSyncedAt: (timestamp: number) => void;
  setUnreadMessageCount: (count: number) => void;
  activateCache: (ownerKey: string) => void;
  clearCache: () => void;
}

const emptyCache = {
  profile: null,
  orders: [] as any[],
  staffList: [] as any[],
  catalogItems: [] as any[],
  escalations: [] as any[],
  dashboardSummary: null,
  lastSyncedAt: null,
  unreadMessageCount: 0,
};

export const useAppDataStore = create<AppDataState>()(
  persist(
    (set) => ({
      cacheOwnerKey: null,
      ...emptyCache,
      setProfile: (profile) => set({ profile, lastSyncedAt: Date.now() }),
      setOrders: (orders) => set({ orders, lastSyncedAt: Date.now() }),
      setStaffList: (staffList) => set({ staffList, lastSyncedAt: Date.now() }),
      setCatalogItems: (catalogItems) => set({ catalogItems, lastSyncedAt: Date.now() }),
      setEscalations: (escalations) => set({ escalations, lastSyncedAt: Date.now() }),
      setDashboardSummary: (dashboardSummary) => set({ dashboardSummary, lastSyncedAt: Date.now() }),
      setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
      setUnreadMessageCount: (unreadMessageCount) => set({ unreadMessageCount }),
      activateCache: (cacheOwnerKey) =>
        set((state) => {
          const expired =
            state.lastSyncedAt !== null && Date.now() - state.lastSyncedAt > APP_DATA_CACHE_TTL_MS;
          if (state.cacheOwnerKey !== cacheOwnerKey || expired) {
            return { cacheOwnerKey, ...emptyCache };
          }
          return state;
        }),
      clearCache: () => set({ cacheOwnerKey: null, ...emptyCache }),
    }),
    { name: "threadly-nest-app-data-cache", storage: createJSONStorage(() => sqliteStateStorage) }
  )
);

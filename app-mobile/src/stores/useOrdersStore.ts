import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";

export interface OrderItem {
  id: string;
  orderId?: string;
  bookingId?: string;
  atelierName: string;
  garmentType: string;
  orderNumber: string;
  estimatedReady: string;
  progressPercent: number;
  imageUrl: string;
  status: "active" | "completed" | "declined" | "cancelled";
  rawStatus?: string;
}

interface OrdersState {
  orders: OrderItem[];
  addOrder: (order: OrderItem) => void;
  setOrders: (orders: OrderItem[]) => void;
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

export const useOrdersStore = create<OrdersState>()(
  persist(
    (set) => ({
      orders: [],
      addOrder: (newOrder) =>
        set((state) => {
          const exists = state.orders.some(
            (o) => o.id === newOrder.id || (newOrder.orderNumber && o.orderNumber === newOrder.orderNumber)
          );
          if (exists) return state;
          return { orders: [newOrder, ...state.orders] };
        }),
      setOrders: (orders) => set({ orders }),
    }),
    { name: "threadly-nest-customer-orders", storage: createJSONStorage(() => secureStorage) }
  )
);

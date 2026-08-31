import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";

export interface OrderItem {
  id: string;
  atelierName: string;
  garmentType: string;
  orderNumber: string;
  estimatedReady: string;
  progressPercent: number;
  imageUrl: string;
  status: "active" | "completed";
}

interface OrdersState {
  orders: OrderItem[];
  addOrder: (order: OrderItem) => void;
  setOrders: (orders: OrderItem[]) => void;
}

const secureStorage = {
  getItem: async (name: string) => (await SecureStore.getItemAsync(name)) ?? null,
  setItem: async (name: string, value: string) => SecureStore.setItemAsync(name, value),
  removeItem: async (name: string) => SecureStore.deleteItemAsync(name),
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

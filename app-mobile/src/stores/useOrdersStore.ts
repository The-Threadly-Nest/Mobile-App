import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { sqliteStateStorage } from "@/shared/services/sqliteStateStorage";

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
  updateOrderStatus: (id: string, status: OrderItem["status"], rawStatus?: string) => void;
}

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
      updateOrderStatus: (id, status, rawStatus = status) =>
        set((state) => ({
          orders: state.orders.map((order) =>
            order.id === id || order.orderId === id || order.bookingId === id
              ? { ...order, status, rawStatus }
              : order
          ),
        })),
    }),
    { name: "threadly-nest-customer-orders", storage: createJSONStorage(() => sqliteStateStorage) }
  )
);

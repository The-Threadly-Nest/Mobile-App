import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';

const secureStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(name);
    } catch {
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      if (value.length > 2000) return; // Prevent Android SecureStore 2048-byte limit warning
      await SecureStore.setItemAsync(name, value);
    } catch {}
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(name);
    } catch {}
  },
};

export interface CartItem {
  id: string;
  name: string;
  price: number;
  image: string;
  vendorName: string;
  fashionHouseId: string;
  selectedSize: string;
  selectedColor: string;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  removeItem: (id: string, selectedSize: string, selectedColor: string) => void;
  updateQuantity: (id: string, selectedSize: string, selectedColor: string, quantity: number) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (newItem, quantity = 1) => {
        set((state) => {
          const existingIndex = state.items.findIndex(
            (i) =>
              i.id === newItem.id &&
              i.selectedSize === newItem.selectedSize &&
              i.selectedColor === newItem.selectedColor
          );

          if (existingIndex > -1) {
            const updated = [...state.items];
            updated[existingIndex].quantity += quantity;
            return { items: updated };
          }

          return { items: [...state.items, { ...newItem, quantity }] };
        });
      },
      removeItem: (id, selectedSize, selectedColor) => {
        set((state) => ({
          items: state.items.filter(
            (i) =>
              !(
                i.id === id &&
                i.selectedSize === selectedSize &&
                i.selectedColor === selectedColor
              )
          ),
        }));
      },
      updateQuantity: (id, selectedSize, selectedColor, quantity) => {
        if (quantity <= 0) {
          get().removeItem(id, selectedSize, selectedColor);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.id === id &&
            i.selectedSize === selectedSize &&
            i.selectedColor === selectedColor
              ? { ...i, quantity }
              : i
          ),
        }));
      },
      clearCart: () => set({ items: [] }),
      getTotalItems: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
      getTotalPrice: () => get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    }),
    {
      name: 'tfh-cart-storage',
      storage: createJSONStorage(() => secureStorage),
    }
  )
);

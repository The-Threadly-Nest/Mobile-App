import { create } from "zustand";
import { useCartStore } from "./useCartStore";
import { persist, createJSONStorage } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";

import { useOrdersStore } from "./useOrdersStore";
import { useAppDataStore } from "./useAppDataStore";
import { clearAccountDeviceData } from "@/shared/services/accountCleanup";

type Role = "admin" | "staff" | "customer" | null;

interface AuthState {
  userId: string | null;
  role: Role;
  name: string;
  shopName: string;
  shopLogo: string | null;
  email: string;
  phone: string;
  location: string;
  token: string | null;
  isVerified: boolean;
  onboardingCompleted: boolean;
  hasSeenSketchpadGuide: boolean;
  resendAvailableAt: number | null;
  createdAt: string | null;
  setRole: (role: Role) => void;
  setName: (name: string) => void;
  setShopName: (shopName: string) => void;
  setShopLogo: (shopLogo: string | null) => void;
  setEmail: (email: string) => void;
  setPhone: (phone: string) => void;
  setLocation: (location: string) => void;
  setToken: (token: string) => void;
  setIsVerified: (isVerified: boolean) => void;
  setOnboardingCompleted: (completed: boolean) => void;
  setHasSeenSketchpadGuide: (seen: boolean) => void;
  setResendAvailableAt: (timestamp: number | null) => void;
  setCreatedAt: (dateStr: string | null) => void;
  setSession: (session: Partial<Pick<AuthState,
    "token" | "email" | "name" | "shopName" | "role" | "createdAt" | "isVerified" | "onboardingCompleted" | "userId"
  >>) => void;
  logout: () => void;
}

const secureStorage = {
  getItem: async (name: string) => (await SecureStore.getItemAsync(name)) ?? null,
  setItem: async (name: string, value: string) => SecureStore.setItemAsync(name, value),
  removeItem: async (name: string) => SecureStore.deleteItemAsync(name),
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      userId: null,
      role: null,
      name: "",
      shopName: "",
      shopLogo: null,
      email: "",
      phone: "",
      location: "Lagos, Nigeria",
      token: null,
      isVerified: false,
      onboardingCompleted: false,
      hasSeenSketchpadGuide: false,
      resendAvailableAt: null,
      createdAt: null,
      setRole: (role) => set({ role }),
      setName: (name) => set({ name }),
      setShopName: (shopName) => set({ shopName }),
      setShopLogo: (shopLogo) => set({ shopLogo }),
      setEmail: (email) => set({ email }),
      setPhone: (phone) => set({ phone }),
      setLocation: (location) => set({ location }),
      setToken: (token) => set({ token }),
      setIsVerified: (isVerified) => set({ isVerified }),
      setOnboardingCompleted: (onboardingCompleted) => set({ onboardingCompleted }),
      setHasSeenSketchpadGuide: (hasSeenSketchpadGuide) => set({ hasSeenSketchpadGuide }),
      setResendAvailableAt: (resendAvailableAt) => set({ resendAvailableAt }),
      setCreatedAt: (createdAt) => set({ createdAt }),
      setSession: (session) => {
        const email = session.email ?? get().email;
        const role = session.role ?? get().role;
        if (get().email !== email || get().role !== role) set({ userId: null });
        if ((get().email && get().email.trim().toLowerCase() !== email.trim().toLowerCase()) || (get().role && get().role !== role)) useCartStore.getState().clearCart();
        if (email && role) {
          useAppDataStore.getState().activateCache(`${role}:${email.trim().toLowerCase()}`);
        }
        set(session);
      },
      logout: () => {
        try {
          useCartStore.getState().clearCart();
          useOrdersStore.getState().setOrders([]);
          useAppDataStore.getState().clearCache();
          void clearAccountDeviceData();
        } catch (e) {
          console.warn("Failed to clear local caches on logout:", e);
        }
        set({
          userId: null,
          role: null,
          name: "",
          shopName: "",
          shopLogo: null,
          email: "",
          phone: "",
          location: "Lagos, Nigeria",
          token: null,
          isVerified: false,
          onboardingCompleted: false,
          hasSeenSketchpadGuide: false,
          resendAvailableAt: null,
          createdAt: null,
        });
      },
    }),
    { name: "threadly-nest-auth", storage: createJSONStorage(() => secureStorage) }
  )
);

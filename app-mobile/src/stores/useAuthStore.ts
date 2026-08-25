import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";

type Role = "admin" | "staff" | "customer" | null;

interface AuthState {
  role: Role;
  email: string;
  token: string | null;
  isVerified: boolean;
  resendAvailableAt: number | null;
  setRole: (role: Role) => void;
  setEmail: (email: string) => void;
  setToken: (token: string) => void;
  setIsVerified: (isVerified: boolean) => void;
  setResendAvailableAt: (timestamp: number | null) => void;
  logout: () => void;
}

const secureStorage = {
  getItem: async (name: string) => (await SecureStore.getItemAsync(name)) ?? null,
  setItem: async (name: string, value: string) => SecureStore.setItemAsync(name, value),
  removeItem: async (name: string) => SecureStore.deleteItemAsync(name),
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      role: null,
      email: "",
      token: null,
      isVerified: false,
      resendAvailableAt: null,
      setRole: (role) => set({ role }),
      setEmail: (email) => set({ email }),
      setToken: (token) => set({ token }),
      setIsVerified: (isVerified) => set({ isVerified }),
      setResendAvailableAt: (resendAvailableAt) => set({ resendAvailableAt }),
      logout: () => set({ role: null, email: "", token: null, isVerified: false, resendAvailableAt: null }),
    }),
    { name: "threadly-nest-auth", storage: createJSONStorage(() => secureStorage) }
  )
);

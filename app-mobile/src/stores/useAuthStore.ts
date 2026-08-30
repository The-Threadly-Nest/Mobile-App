import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";

type Role = "admin" | "staff" | "customer" | null;

interface AuthState {
  role: Role;
  name: string;
  email: string;
  token: string | null;
  isVerified: boolean;
  onboardingCompleted: boolean;
  resendAvailableAt: number | null;
  createdAt: string | null;
  setRole: (role: Role) => void;
  setName: (name: string) => void;
  setEmail: (email: string) => void;
  setToken: (token: string) => void;
  setIsVerified: (isVerified: boolean) => void;
  setOnboardingCompleted: (completed: boolean) => void;
  setResendAvailableAt: (timestamp: number | null) => void;
  setCreatedAt: (dateStr: string | null) => void;
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
      name: "",
      email: "",
      token: null,
      isVerified: false,
      onboardingCompleted: false,
      resendAvailableAt: null,
      createdAt: null,
      setRole: (role) => set({ role }),
      setName: (name) => set({ name }),
      setEmail: (email) => set({ email }),
      setToken: (token) => set({ token }),
      setIsVerified: (isVerified) => set({ isVerified }),
      setOnboardingCompleted: (onboardingCompleted) => set({ onboardingCompleted }),
      setResendAvailableAt: (resendAvailableAt) => set({ resendAvailableAt }),
      setCreatedAt: (createdAt) => set({ createdAt }),
      logout: () =>
        set({
          role: null,
          name: "",
          email: "",
          token: null,
          isVerified: false,
          onboardingCompleted: false,
          resendAvailableAt: null,
          createdAt: null,
        }),
    }),
    { name: "threadly-nest-auth", storage: createJSONStorage(() => secureStorage) }
  )
);

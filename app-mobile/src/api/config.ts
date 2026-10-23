import { resolveDataMode } from "@/config/dataMode";

const resolveApiBaseUrl = () => {
  const configuredUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

  if (!configuredUrl) {
    throw new Error(
      "EXPO_PUBLIC_API_BASE_URL is required. Set it to the backend URL in app-mobile/.env or the EAS build environment.",
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(configuredUrl);
  } catch {
    throw new Error("EXPO_PUBLIC_API_BASE_URL must be a valid absolute URL.");
  }

  if (parsedUrl.protocol !== "https:" && !__DEV__) {
    throw new Error("Production builds require an HTTPS API URL.");
  }

  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    throw new Error("EXPO_PUBLIC_API_BASE_URL must use HTTP or HTTPS.");
  }

  return configuredUrl.replace(/\/+$/, "");
};

export const API_BASE_URL = resolveApiBaseUrl();

export const DATA_MODE = resolveDataMode(process.env.EXPO_PUBLIC_DATA_MODE, __DEV__);

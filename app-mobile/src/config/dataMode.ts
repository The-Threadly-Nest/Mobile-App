export type DataMode = "real" | "mock" | "demo";

export function resolveDataMode(value: string | undefined, isDevelopment: boolean): DataMode {
  const mode = (value || "real").toLowerCase();
  if (mode !== "real" && mode !== "mock" && mode !== "demo") {
    throw new Error("EXPO_PUBLIC_DATA_MODE must be real, mock, or demo.");
  }
  if (!isDevelopment && mode !== "real") {
    throw new Error("Production builds require EXPO_PUBLIC_DATA_MODE=real.");
  }
  return mode;
}

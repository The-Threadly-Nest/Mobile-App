const mode = String(process.env.EXPO_PUBLIC_DATA_MODE || "real").toLowerCase();

if (mode !== "real") {
  console.error("Production builds require EXPO_PUBLIC_DATA_MODE=real.");
  process.exit(1);
}

console.log("Production data mode is real.");

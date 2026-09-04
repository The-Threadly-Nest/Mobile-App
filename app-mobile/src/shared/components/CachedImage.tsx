import React from "react";
import { StyleSheet, StyleProp } from "react-native";
import { Image as ExpoImage, ImageStyle, ImageSource } from "expo-image";

interface CachedImageProps {
  source: string | ImageSource | number | { uri: string } | null | undefined;
  style?: StyleProp<ImageStyle>;
  contentFit?: "cover" | "contain" | "fill" | "none" | "scale-down";
  placeholder?: ImageSource | string;
  transition?: number;
  priority?: "low" | "normal" | "high";
  allowDownscaling?: boolean;
}

const DEFAULT_BLURHASH = "LKO2?U%2Tw=w]~RBVZRi};RPxuwH";

/**
 * High-performance cached image component powered by expo-image.
 * Caches images aggressively to memory and local flash storage so they load instantly on repeat visits.
 */
export default function CachedImage({
  source,
  style,
  contentFit = "cover",
  placeholder = { blurhash: DEFAULT_BLURHASH },
  transition = 200,
  priority = "normal",
  allowDownscaling = true,
}: CachedImageProps) {
  // Normalize source formats (handles numbers from require, objects, and raw URL strings)
  let normalizedSource: any = source;
  if (typeof source === "string") {
    normalizedSource = { uri: source };
  }

  if (!normalizedSource) {
    return null;
  }

  return (
    <ExpoImage
      source={normalizedSource}
      placeholder={placeholder}
      contentFit={contentFit}
      transition={transition}
      priority={priority}
      allowDownscaling={allowDownscaling}
      cachePolicy="memory-disk"
      style={style}
    />
  );
}

import React from "react";
import { Pressable, Text, ActivityIndicator, PressableProps } from "react-native";

type Variant = "primary" | "secondary" | "accent";

const styles: Record<Variant, { container: string; text: string }> = {
  primary: { container: "bg-oxblood", text: "text-cream" },
  secondary: { container: "bg-white border border-oxblood", text: "text-oxblood" },
  accent: { container: "bg-gold", text: "text-ink" },
};

/**
 * Button label text uses "body-semibold" (Instrument Sans), NOT the display
 * (Hedvig Letters Serif) font — buttons are a dense, frequently-repeated UI element
 * where the sans font's small-size legibility matters more than the
 * serif's editorial character. Hedvig Letters Serif is reserved for headlines only.
 */
export function Button({
  label,
  variant = "primary",
  loading = false,
  disabled,
  ...rest
}: PressableProps & { label: string; variant?: Variant; loading?: boolean }) {
  const s = styles[variant];
  return (
    <Pressable
      disabled={disabled || loading}
      className={`${s.container} rounded-pill py-4 px-6 items-center justify-center w-full ${disabled ? "opacity-40" : ""}`}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#FFFFFF" : "#453332"} />
      ) : (
        <Text className={`${s.text} font-body-semibold text-base`}>{label}</Text>
      )}
    </Pressable>
  );
}

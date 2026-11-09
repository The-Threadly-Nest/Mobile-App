import React from "react";
import { Pressable, ActivityIndicator, PressableProps } from "react-native";
import { Text } from "@/shared/components/Typography";

type Variant = "primary" | "secondary" | "accent";

const styles: Record<Variant, { container: string; text: string }> = {
  primary: { container: "bg-tomato", text: "text-white" },
  secondary: { container: "bg-white border border-tomato", text: "text-black" },
  accent: { container: "bg-tomato", text: "text-white" },
};

/**
 * All app typography uses Instrument Sans. Buttons use its semibold weight.
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
        <ActivityIndicator color={variant === "secondary" ? "#453332" : "#FFFFFF"} />
      ) : (
        <Text className={`${s.text} font-body-semibold text-base`}>{label}</Text>
      )}
    </Pressable>
  );
}

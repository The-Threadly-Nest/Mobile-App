import React from "react";
import { TextProps } from "react-native";
import { Text } from "@/shared/components/Typography";

/**
 * Semantic headline helper. Both headline and body utilities use Instrument Sans.
 */
export function Headline({ children, className = "", ...rest }: TextProps & { className?: string }) {
  return (
    <Text className={`font-display text-black ${className}`} {...rest}>
      {children}
    </Text>
  );
}

export function Subtext({ children, className = "", ...rest }: TextProps & { className?: string }) {
  return (
    <Text className={`font-body text-black ${className}`} {...rest}>
      {children}
    </Text>
  );
}

import React from "react";
import { Text, TextProps } from "react-native";

/**
 * Use this for headlines and hero/display moments ONLY — screen titles,
 * onboarding headlines, "Welcome back" type copy. Never for body text,
 * subtext, form labels, buttons, or anything under ~18px — Fraunces
 * (a serif) loses legibility fast at small sizes, which is exactly why
 * the app has a separate Work Sans track for everything else. See
 * README "Typography Rules" before reaching for this on a new screen.
 */
export function Headline({ children, className = "", ...rest }: TextProps & { className?: string }) {
  return (
    <Text className={`font-display text-ink ${className}`} {...rest}>
      {children}
    </Text>
  );
}

export function Subtext({ children, className = "", ...rest }: TextProps & { className?: string }) {
  return (
    <Text className={`font-body text-grey700 ${className}`} {...rest}>
      {children}
    </Text>
  );
}

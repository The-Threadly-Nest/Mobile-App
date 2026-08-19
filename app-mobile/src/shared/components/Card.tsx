import React from "react";
import { View, ViewProps } from "react-native";

export function Card({ children, className = "", ...rest }: ViewProps & { className?: string }) {
  return (
    <View className={`bg-white border border-grey100 rounded-xl p-4 ${className}`} {...rest}>
      {children}
    </View>
  );
}

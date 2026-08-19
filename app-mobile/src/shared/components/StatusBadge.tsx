import React from "react";
import { View, Text } from "react-native";

type Status = "order_placed" | "in_production" | "ready" | "delivered";

const config: Record<Status, { label: string; bg: string; text: string }> = {
  order_placed: { label: "Order Placed", bg: "bg-white border border-oxblood", text: "text-oxblood" },
  in_production: { label: "In Production", bg: "bg-gold", text: "text-ink" },
  ready: { label: "Ready", bg: "bg-oxblood", text: "text-cream" },
  delivered: { label: "Delivered", bg: "bg-ink", text: "text-cream" },
};

export function StatusBadge({ status }: { status: Status }) {
  const c = config[status];
  return (
    <View className={`${c.bg} px-3 py-1 rounded-pill self-start`}>
      <Text className={`${c.text} font-body-semibold text-xs uppercase`}>{c.label}</Text>
    </View>
  );
}

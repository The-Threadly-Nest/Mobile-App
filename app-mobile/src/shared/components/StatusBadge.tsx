import React from "react";
import { View } from "react-native";
import { Text } from "@/shared/components/Typography";

type Status = "order_placed" | "in_production" | "ready" | "delivered";

const config: Record<Status, { label: string; bg: string; text: string }> = {
  order_placed: { label: "Order Placed", bg: "bg-white border border-tomato", text: "text-black" },
  in_production: { label: "In Production", bg: "bg-oxblood", text: "text-white" },
  ready: { label: "Ready", bg: "bg-oxblood", text: "text-white" },
  delivered: { label: "Delivered", bg: "bg-oxblood", text: "text-white" },
};

export function StatusBadge({ status }: { status: Status }) {
  const c = config[status];
  return (
    <View className={`${c.bg} px-3 py-1 rounded-pill self-start`}>
      <Text className={`${c.text} font-body-semibold text-xs uppercase`}>{c.label}</Text>
    </View>
  );
}

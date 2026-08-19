import React from "react";
import { View } from "react-native";
import { Headline, Subtext } from "./Headline";

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      <Headline className="text-lg mb-2 text-center">{title}</Headline>
      <Subtext className="text-sm text-center">{message}</Subtext>
    </View>
  );
}

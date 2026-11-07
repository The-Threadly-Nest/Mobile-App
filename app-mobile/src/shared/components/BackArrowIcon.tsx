import React from "react";
import { ChevronLeft } from "lucide-react-native";

interface BackArrowIconProps {
  size?: number;
  color?: string;
}

export function BackArrowIcon({ size = 20, color = "#000000" }: BackArrowIconProps) {
  return (
    <ChevronLeft size={size} color={color} strokeWidth={1.5} />
  );
}

export default BackArrowIcon;

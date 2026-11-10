import React from "react";
import { ChevronLeft } from "lucide-react-native";

interface BackArrowIconProps {
  size?: number;
  color?: string;
}

export function BackArrowIcon({ size = 24, color = "#2B2B2B" }: BackArrowIconProps) {
  return (
    <ChevronLeft size={size} color={color} strokeWidth={1.5} />
  );
}

export default BackArrowIcon;

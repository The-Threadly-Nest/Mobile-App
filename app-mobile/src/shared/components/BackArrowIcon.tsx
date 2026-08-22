import React from "react";
import Svg, { Path } from "react-native-svg";

interface BackArrowIconProps {
  size?: number;
  color?: string;
}

export function BackArrowIcon({ size = 20, color = "#000000" }: BackArrowIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9.57 5.93005L3.5 12.0001L9.57 18.0701"
        stroke={color}
        strokeMiterlimit={10}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M20.5 12H3.67001"
        stroke={color}
        strokeMiterlimit={10}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default BackArrowIcon;

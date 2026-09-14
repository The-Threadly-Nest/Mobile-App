import React from "react";
import { View, Text } from "react-native";
import Svg, { Rect, Defs, LinearGradient, Stop } from "react-native-svg";
import { useAuthStore } from "@/stores/useAuthStore";

interface ProfileAvatarIconProps {
  size?: number;
  name?: string;
  monogramScale?: number;
}

export function ProfileAvatarIcon({ size = 60, name }: ProfileAvatarIconProps) {
  const storeName = useAuthStore((s) => s.name);
  const storeEmail = useAuthStore((s) => s.email);

  const displayName = name || storeName || storeEmail || "User";
  const initial = displayName.trim().charAt(0).toUpperCase() || "A";
  const fontSize = Math.round(size * 0.44);

  return (
    <View style={{ width: size, height: size, position: "relative", alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} viewBox="0 0 69 69" fill="none" style={{ position: "absolute" }}>
        <Rect width={69} height={69} rx={34.5} fill="url(#paint0_linear_397_2372)" />
        <Defs>
          <LinearGradient
            id="paint0_linear_397_2372"
            x1="28.5"
            y1="19.5"
            x2="29.5"
            y2="106.5"
            gradientUnits="userSpaceOnUse"
          >
            <Stop stopColor="#4A080C" />
            <Stop offset={1} stopColor="#C4A763" />
          </LinearGradient>
        </Defs>
      </Svg>
      <Text
        style={{
          fontFamily: "Fraunces-Bold",
          fontSize,
          color: "#FFFFFF",
          textAlign: "center",
          includeFontPadding: false,
        }}
      >
        {initial}
      </Text>
    </View>
  );
}

export default ProfileAvatarIcon;

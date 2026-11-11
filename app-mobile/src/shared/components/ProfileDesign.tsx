import { typeScale } from "@/shared/utils/typeScale";
import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Text } from "@/shared/components/Typography";
import { ChevronLeft, ChevronRight, User, Settings, LogOut, Star, ShoppingBag } from "lucide-react-native";
import { ProfilePhoto } from "./ProfilePhoto";
import { SCREEN_TOP_SPACING } from "../utils/screenSpacing";
import BackArrowIcon from "./BackArrowIcon";

const icons = {
  back: ChevronLeft,
  personal: User,
  settings: Settings,
  chevron: ChevronRight,
  logout: LogOut,
  reviews: Star,
  orders: ShoppingBag,
};

export function ProfileMenuGroups({ children }: { children: React.ReactNode }) {
  const rows = React.Children.toArray(children).filter(React.isValidElement);
  return <View style={{ paddingHorizontal: 24, gap: 14 }}>
    {Array.from({ length: Math.ceil(rows.length / 2) }, (_, index) => (
      <View key={index} style={{ backgroundColor: "#FFFDF9", borderRadius: 15, overflow: "hidden" }}>
        {rows.slice(index * 2, index * 2 + 2)}
      </View>
    ))}
  </View>;
}

export function ProfileDesignIcon({ name }: { name: keyof typeof icons }) {
  if (name === "back") return <BackArrowIcon />;
  const width = name === "chevron" ? 26.5271 : 21.2217;
  const height = width;
  const Icon = icons[name];
  return <Icon width={width} height={height} color={name === "chevron" ? "#2B2B2B" : "#F96951"} strokeWidth={1.6} />;
}

export function ProfileDesignHeader({ balance }: {
  balance?: string;
}) {
  return <View style={styles.header}>
    <Text accessibilityRole="header" style={styles.profileTitle}>My Profile</Text>
    <ProfilePhoto />
    {balance !== undefined && <View style={{ alignItems: "center", paddingBottom: 8 }}>
      <Text style={styles.subtitle}>Available Balance</Text>
      <Text style={styles.name}>{balance}</Text>
      <Pressable disabled accessibilityRole="button" accessibilityState={{ disabled: true }}
        accessibilityLabel="Withdraw unavailable until wallet is connected"
        style={{
          borderWidth: 1, borderColor: "#F96951", borderRadius: 10, paddingHorizontal: 22, minHeight: 38,
          alignItems: "center", justifyContent: "center", marginTop: 14, marginBottom: 8, opacity: 0.65
        }}>
        <Text style={{ color: "#4A403B", fontFamily: "InstrumentSans-Regular", fontSize: 14 }}>Withdraw</Text>
      </Pressable>
      <Text style={[styles.subtitle, { fontSize: 12, opacity: 0.8 }]}>Wallet balance is not connected yet</Text>
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 24,
    paddingTop: SCREEN_TOP_SPACING,
    paddingBottom: 16,
    marginBottom: 8,
    alignItems: "center",
  },
  profileTitle: {
    ...typeScale.pageTitle,
    alignSelf: "flex-start",
    textAlign: "left",
    color: "#4A403B",
    marginTop: 0,
    marginBottom: 16,
  },
  name: { fontFamily: "InstrumentSans-SemiBold", fontSize: 25, color: "#4A403B", textAlign: "center", marginTop: 12 },
  subtitle: { ...typeScale.caption, color: "#4A403B", textAlign: "center", marginTop: 6 },
});

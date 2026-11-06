import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Asset } from "expo-asset";
import { SvgUri } from "react-native-svg";
import { ProfilePhoto } from "./ProfilePhoto";

const icons = {
  back: require("../../../assets/profile/back.svg"),
  personal: require("../../../assets/profile/personal.svg"),
  settings: require("../../../assets/profile/settings.svg"),
  chevron: require("../../../assets/profile/chevron.svg"),
  logout: require("../../../assets/profile/logout.svg"),
  reviews: require("../../../assets/profile/reviews.svg"),
  orders: require("../../../assets/profile/orders.svg"),
};

export function ProfileMenuGroups({ children }: { children: React.ReactNode }) {
  const rows = React.Children.toArray(children).filter(React.isValidElement);
  return <View style={{ paddingHorizontal: 24, gap: 14 }}>
    {Array.from({ length: Math.ceil(rows.length / 2) }, (_, index) => (
      <View key={index} style={{ backgroundColor: "#F6F6F6", borderRadius: 15, overflow: "hidden" }}>
        {rows.slice(index * 2, index * 2 + 2)}
      </View>
    ))}
  </View>;
}

export function ProfileDesignIcon({ name }: { name: keyof typeof icons }) {
  const width = name === "back" ? 39.7906 : name === "chevron" ? 26.5271 : 21.2217;
  const height = name === "back" ? 39.7907 : width;
  return <SvgUri uri={Asset.fromModule(icons[name]).uri} width={width} height={height} />;
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
        style={{ borderWidth: 1, borderColor: "#453332", borderRadius: 10, paddingHorizontal: 22, minHeight: 38,
          alignItems: "center", justifyContent: "center", marginTop: 14, marginBottom: 8, opacity: 0.65 }}>
        <Text style={{ color: "#453332", fontFamily: "InstrumentSans-Regular", fontSize: 14 }}>Withdraw</Text>
      </Pressable>
      <Text style={[styles.subtitle, { fontSize: 12, opacity: 0.8 }]}>Wallet balance is not connected yet</Text>
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  header: { backgroundColor: "#FFFFFF",
    paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16, marginBottom: 8, alignItems: "center" },
  profileTitle: { alignSelf: "stretch", textAlign: "center", fontFamily: "InstrumentSans-SemiBold", fontSize: 24,
    color: "#453332", marginTop: 0, marginBottom: 8 },
  name: { fontFamily: "InstrumentSans-SemiBold", fontSize: 25, color: "#453332", textAlign: "center", marginTop: 12 },
  subtitle: { fontFamily: "InstrumentSans-Regular", fontSize: 14, color: "#453332", textAlign: "center", marginTop: 6 },
});

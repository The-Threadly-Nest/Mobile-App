import { typeScale } from "@/shared/utils/typeScale";
import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Text } from "@/shared/components/Typography";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import BackArrowIcon from "@/shared/components/BackArrowIcon";

export default function AllReviewsScreen() {
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <BackArrowIcon size={24} color="#453332" />
        </Pressable>
        <Text style={styles.headerTitle}>Customer Reviews</Text>
      </View>

      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No customer reviews yet</Text>
        <Text style={styles.emptyBody}>Verified customer reviews will appear here when reviews are available.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9E8D3" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F9E8D3",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
    borderWidth: 0.5,
    borderColor: "#453332",
  },
  headerTitle: { ...typeScale.pageTitle, color: "#4A403B" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  emptyTitle: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 16,
    color: "#4A403B",
    marginBottom: 8,
  },
  emptyBody: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 13,
    lineHeight: 20,
    color: "#4A403B",
    textAlign: "center",
  },
});

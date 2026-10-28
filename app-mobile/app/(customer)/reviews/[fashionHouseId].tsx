import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import BackArrowIcon from "@/shared/components/BackArrowIcon";

export default function AllReviewsScreen() {
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <BackArrowIcon size={20} color="#3A2E1A" />
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
  container: { flex: 1, backgroundColor: "#FFFFFF" },
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
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
    borderWidth: 0.5,
    borderColor: "#EAE3D2",
  },
  headerTitle: { fontFamily: "Fraunces-Bold", fontSize: 18, color: "#000000" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  emptyTitle: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#3A2E1A",
    marginBottom: 8,
  },
  emptyBody: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 13,
    lineHeight: 20,
    color: "#646464",
    textAlign: "center",
  },
});

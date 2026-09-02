import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useAppAlert } from "@/shared/hooks/useAppAlert";

interface TailorOption {
  id: string;
  name: string;
  activeOrders: number;
}

const DEFAULT_TAILORS: TailorOption[] = [
  { id: "t1", name: "Ngozi Umeh", activeOrders: 3 },
  { id: "t2", name: "Tunde Bakare", activeOrders: 5 },
  { id: "t3", name: "Funmilayo Adeyemi", activeOrders: 1 },
];

export default function AssignStaffScreen() {
  const params = useLocalSearchParams<{
    bookingId?: string;
    customerName?: string;
    serviceTitle?: string;
    appointmentTime?: string;
  }>();

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { showAlert } = useAppAlert();

  const customerName = params.customerName || "Chiamaka O.";
  const serviceTitle = params.serviceTitle || "Bridal Aso-Ebi";
  const appointmentTime = params.appointmentTime || "Sat, Sept 6";

  const [selectedTailorId, setSelectedTailorId] = useState<string>("t1");

  const handleConfirm = () => {
    const tailor = DEFAULT_TAILORS.find((t) => t.id === selectedTailorId) || DEFAULT_TAILORS[0];
    showAlert("Assignment Confirmed", `${customerName}'s fitting has been successfully assigned to ${tailor.name}.`);
    setTimeout(() => {
      router.push("/(admin)/escalations" as any);
    }, 1200);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={[styles.container, isLandscape && styles.containerLandscape]}>
        {/* Header Row */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.push("/(admin)/escalations" as any)}
            style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <ArrowLeft size={18} color="#3B0508" />
          </Pressable>
          <Text style={styles.headerTitle}>Assign Staff</Text>
        </View>

        {/* Subtitle Details */}
        <Text style={styles.subtitle} numberOfLines={1}>
          {customerName}  •  {serviceTitle}  •  {appointmentTime}
        </Text>

        {/* Staff List */}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {DEFAULT_TAILORS.map((tailor) => {
            const isSelected = tailor.id === selectedTailorId;
            const initial = tailor.name.charAt(0).toUpperCase();

            return (
              <Pressable
                key={tailor.id}
                onPress={() => setSelectedTailorId(tailor.id)}
                style={({ pressed }) => [
                  styles.card,
                  isSelected ? styles.cardSelected : styles.cardUnselected,
                  { opacity: pressed ? 0.9 : 1 },
                ]}
              >
                {/* Initial Avatar */}
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>

                {/* Tailor Name */}
                <Text style={styles.tailorName}>{tailor.name}</Text>

                {/* Active Orders Subtitle */}
                <Text style={styles.ordersCount}>
                  {tailor.activeOrders} {tailor.activeOrders === 1 ? "active order" : "active orders"}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Bottom Pinned Action Button */}
        <View style={styles.bottomBar}>
          <Pressable
            onPress={handleConfirm}
            style={({ pressed }) => [
              styles.confirmBtn,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.confirmBtnText}>Confirm Assignment</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FBF7EF",
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  containerLandscape: {
    maxWidth: 680,
    alignSelf: "center",
    width: "100%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(74, 8, 12, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  headerTitle: {
    fontFamily: "Fraunces-Bold",
    fontSize: 24,
    color: "#1A1110",
  },
  subtitle: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 14,
    color: "#7A7265",
    marginBottom: 24,
    paddingHorizontal: 2,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    height: 76,
    borderRadius: 24,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  cardSelected: {
    backgroundColor: "#DDE1DA",
    borderColor: "rgba(74, 8, 12, 0.5)",
  },
  cardUnselected: {
    backgroundColor: "transparent",
    borderColor: "rgba(74, 8, 12, 0.25)",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#4A080C",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  avatarText: {
    fontFamily: "Fraunces-Bold",
    fontSize: 18,
    color: "#FFFFFF",
  },
  tailorName: {
    flex: 1,
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#1A1110",
  },
  ordersCount: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 13,
    color: "#7A7265",
  },
  bottomBar: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  confirmBtn: {
    width: "100%",
    maxWidth: 380,
    alignSelf: "center",
    height: 58,
    borderRadius: 29,
    backgroundColor: "#4A080C",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
});

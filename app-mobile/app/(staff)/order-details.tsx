import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Linking,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Phone, Calendar, Ruler, Scissors, ArrowRight } from "lucide-react-native";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import { useAuthStore } from "@/stores/useAuthStore";
import { API_BASE_URL } from "@/api/config";

const STAGE_LABELS: Record<string, { label: string; percent: number }> = {
  booked: { label: "Booked", percent: 16 },
  order_placed: { label: "Booked", percent: 16 },
  pending_admin_review: { label: "Booked", percent: 16 },
  measurements_confirmed: { label: "Measurements Confirmed", percent: 35 },
  fabric_sourced: { label: "Fabric Sourced", percent: 50 },
  in_production: { label: "In Production", percent: 70 },
  quality_check: { label: "Quality Check", percent: 85 },
  ready_for_pickup: { label: "Ready for Pickup", percent: 100 },
  completed: { label: "Completed", percent: 100 },
  delivered: { label: "Delivered", percent: 100 },
};

export default function StaffOrderDetailScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const token = useAuthStore((s) => s.token);

  const params = useLocalSearchParams<{
    orderId: string;
    customerName?: string;
    orderNumber?: string;
    garmentDetails?: string;
    dueDate?: string;
    initialStage?: string;
  }>();

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrderDetail = async () => {
    if (!token || !params.orderId) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/orders/${params.orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOrder(data);
      }
    } catch (err) {
      console.warn("Could not fetch order detail:", err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchOrderDetail();
    }, [params.orderId, token])
  );

  const customerName = order?.customer?.name || params.customerName || "Customer";
  const customerPhone = order?.customer?.phone || "";
  const orderNumber = params.orderNumber || `#TFH-${order?.id?.slice(0, 4) || "2290"}`;
  const garmentDetails = order?.itemName || params.garmentDetails || "Custom Garment";
  const currentStatus = order?.status || params.initialStage || "in_production";
  const stageInfo = STAGE_LABELS[currentStatus] || { label: "In Production", percent: 75 };

  const rawMeasurements = order?.customer?.measurements;
  const measurementsList: Array<{ id?: string; field: string; value: number | string; unit?: string }> =
    Array.isArray(rawMeasurements)
      ? rawMeasurements
      : rawMeasurements && typeof rawMeasurements === "object"
      ? Object.entries(rawMeasurements).map(([field, value]) => ({
          field,
          value: value as string | number,
          unit: "in",
        }))
      : [];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Top Header */}
      <View style={styles.headerBar}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.headerBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <BackArrowIcon size={20} color="#4A080C" />
        </Pressable>
        <Text style={styles.headerTitleText}>Order Details</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Customer & Order Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{customerName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.heroInfoCol}>
            <Text style={styles.customerNameText}>{customerName}</Text>
            <Text style={styles.orderNumberText}>{orderNumber}</Text>
          </View>
        </View>

        {/* Progress & Status Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardHeadline}>Current Status</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>{stageInfo.label}</Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${stageInfo.percent}%` }]} />
          </View>
          <Text style={styles.percentSubtext}>{stageInfo.percent}% Completed</Text>
        </View>

        {/* Garment Specifications Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardHeadline}>Garment Specifications</Text>
            <Scissors size={18} color="#4A080C" />
          </View>
          <Text style={styles.garmentTitle}>{garmentDetails}</Text>
          {customerPhone ? (
            <Pressable
              onPress={() => Linking.openURL(`tel:${customerPhone}`)}
              style={styles.phoneRow}
            >
              <Phone size={15} color="#8A7550" />
              <Text style={styles.phoneText}>{customerPhone}</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Customer Measurements Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardHeadline}>Customer Measurements</Text>
            <Ruler size={18} color="#4A080C" />
          </View>

          {loading ? (
            <ActivityIndicator color="#4A080C" style={{ marginVertical: 20 }} />
          ) : measurementsList.length > 0 ? (
            <View style={styles.measurementsGrid}>
              {measurementsList.map((m: any, idx: number) => (
                <View key={m.id || idx} style={styles.measurementItem}>
                  <Text style={styles.measurementLabel}>
                    {m.field?.replace(/([A-Z])/g, " $1").replace(/_/g, " ").toUpperCase()}
                  </Text>
                  <Text style={styles.measurementVal}>
                    {m.value} {m.unit || "in"}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.noMeasurementsText}>
              No specific body measurements logged on file yet. Measurements can be confirmed during fitting.
            </Text>
          )}
        </View>

        {/* Update Progress Button */}
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/(staff)/update-progress",
              params: {
                orderId: params.orderId,
                customerName,
                orderNumber,
                garmentDetails,
                dueDate: params.dueDate || "Due Soon",
                initialStage: currentStatus,
              },
            })
          }
          style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={styles.actionBtnText}>Update Order Progress</Text>
          <ArrowRight size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FBF7EF" },
  headerBar: {
    height: 52,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleText: { fontFamily: "WorkSans_600SemiBold", fontSize: 17, color: "#4A080C" },
  scrollContent: { paddingHorizontal: 20, paddingVertical: 20, paddingBottom: 40 },
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#4A080C",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  avatarText: { fontFamily: "WorkSans_700Bold", fontSize: 18, color: "#FFFFFF" },
  heroInfoCol: { flex: 1 },
  customerNameText: { fontFamily: "WorkSans_700Bold", fontSize: 18, color: "#4A080C" },
  orderNumberText: { fontFamily: "WorkSans_500Medium", fontSize: 13, color: "#8A7550", marginTop: 2 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 18, marginBottom: 16 },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  cardHeadline: { fontFamily: "WorkSans_700Bold", fontSize: 15, color: "#4A080C" },
  statusBadge: { backgroundColor: "#FBF7EF", borderWidth: 1, borderColor: "#4A080C", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  statusBadgeText: { fontFamily: "WorkSans_600SemiBold", fontSize: 12, color: "#4A080C" },
  progressTrack: { height: 8, backgroundColor: "rgba(0,0,0,0.06)", borderRadius: 4, overflow: "hidden", marginBottom: 6 },
  progressFill: { height: "100%", backgroundColor: "#C4A763", borderRadius: 4 },
  percentSubtext: { fontFamily: "WorkSans_500Medium", fontSize: 12, color: "#8A7550" },
  garmentTitle: { fontFamily: "WorkSans_600SemiBold", fontSize: 16, color: "#3B0508", marginBottom: 8 },
  phoneRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  phoneText: { fontFamily: "WorkSans_500Medium", fontSize: 13, color: "#8A7550" },
  measurementsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  measurementItem: { width: "47%", backgroundColor: "#FBF7EF", borderRadius: 12, padding: 10 },
  measurementLabel: { fontFamily: "WorkSans_600SemiBold", fontSize: 11, color: "#8A7550", marginBottom: 2 },
  measurementVal: { fontFamily: "WorkSans_700Bold", fontSize: 15, color: "#4A080C" },
  noMeasurementsText: { fontFamily: "WorkSans_400Regular", fontSize: 13, color: "#8A7550", fontStyle: "italic", lineHeight: 20 },
  actionBtn: {
    backgroundColor: "#4A080C",
    height: 52,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  actionBtnText: { fontFamily: "WorkSans_600SemiBold", fontSize: 15, color: "#FFFFFF" },
});

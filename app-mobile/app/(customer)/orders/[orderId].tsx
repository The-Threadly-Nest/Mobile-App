import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  Linking,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import {
  Calendar,
  MapPin,
  Phone,
  MessageCircle,
  Check,
  Scissors,
  Ruler,
  Sparkles,
  XCircle,
} from "lucide-react-native";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import { useAuthStore } from "@/stores/useAuthStore";
import { API_BASE_URL } from "@/api/config";
import { generateOrderNumber } from "@/shared/utils/orderUtils";

const STAGES = [
  { key: "booked", label: "Appointment Booked", desc: "Fitting session scheduled" },
  { key: "measurements_confirmed", label: "Measurements Confirmed", desc: "Body metrics finalized" },
  { key: "fabric_sourced", label: "Fabric Sourced", desc: "Materials prepped" },
  { key: "in_production", label: "In Production", desc: "Tailoring & embroidery active" },
  { key: "quality_check", label: "Quality Check", desc: "Finishing & fit inspection" },
  { key: "ready_for_pickup", label: "Ready for Pickup", desc: "Garment packaged & ready" },
];

const STAGE_INDEX_MAP: Record<string, number> = {
  booked: 0,
  order_placed: 0,
  pending_admin_review: 0,
  measurements_confirmed: 1,
  fabric_sourced: 2,
  in_production: 3,
  quality_check: 4,
  ready_for_pickup: 5,
  ready: 5,
  completed: 5,
  delivered: 5,
};

export default function CustomerOrderDetailScreen() {
  const { width, height } = useWindowDimensions();
  const token = useAuthStore((s) => s.token);

  const params = useLocalSearchParams<{
    orderId: string;
    atelierName?: string;
    garmentType?: string;
    orderNumber?: string;
    estimatedReady?: string;
    progressPercent?: string;
    imageUrl?: string;
    fashionHouseId?: string;
  }>();

  const [orderData, setOrderData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrderDetail = async () => {
    if (!params.orderId) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/orders/track/${params.orderId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setOrderData(data);
      }
    } catch (err) {
      console.warn("Failed to fetch order tracking details:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchOrderDetail();
    }, [params.orderId, token])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrderDetail();
  };

  const fashionHouseName =
    orderData?.atelierName || params.atelierName || "Luxury Fashion House";
  const garmentTitle =
    orderData?.garmentType || params.garmentType || "Bespoke Garment";
  const orderNumber =
    params.orderNumber || generateOrderNumber(orderData?.orderId || params.orderId);
  const estimatedReady =
    orderData?.estimatedReady || params.estimatedReady || "Fitting In 2 weeks";
  const currentStatus = orderData?.status || "booked";
  const isDeclined = currentStatus === "declined" || currentStatus === "cancelled";
  const activeStageIdx = STAGE_INDEX_MAP[currentStatus] ?? 0;
  const coverImage =
    orderData?.imageUrl ||
    params.imageUrl ||
    "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=600&q=80";
  const fashionHouseId = orderData?.fashionHouseId || params.fashionHouseId;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Top Navigation */}
      <View style={styles.headerBar}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <BackArrowIcon size={20} color="#4A080C" />
        </Pressable>
        <Text style={styles.headerTitle}>Order Tracking</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4A080C" />
        }
      >
        {/* Compact Hero Card */}
        <View style={[styles.compactHeroCard, isDeclined && { borderColor: "#FECDD3", backgroundColor: "#FFF5F5" }]}>
          <Image source={{ uri: coverImage }} style={styles.compactImage} resizeMode="cover" />
          <View style={styles.compactContent}>
            <View style={styles.badgeRow}>
              <View style={[styles.orderBadge, isDeclined && { borderColor: "#DC2626", backgroundColor: "#FDEAEA" }]}>
                <Text style={[styles.orderBadgeText, isDeclined && { color: "#DC2626" }]}>{orderNumber}</Text>
              </View>
              <Text style={styles.fhNameText} numberOfLines={1}>
                {fashionHouseName}
              </Text>
            </View>
            <Text style={styles.garmentTitleText} numberOfLines={1}>
              {garmentTitle}
            </Text>
            <View style={styles.dateRow}>
              <Calendar size={13} color={isDeclined ? "#DC2626" : "#8A7550"} />
              <Text style={[styles.dateText, isDeclined && { color: "#DC2626", fontFamily: "WorkSans_600SemiBold" }]} numberOfLines={1}>
                {isDeclined ? "Fitting Request Declined" : estimatedReady}
              </Text>
            </View>
          </View>
        </View>

        {isDeclined ? (
          /* Declined Status Alert Banner Card */
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 20,
              padding: 20,
              marginBottom: 14,
              borderWidth: 1.5,
              borderColor: "#FECDD3",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: "#FDEAEA",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 12,
              }}
            >
              <XCircle size={28} color="#DC2626" />
            </View>

            <Text
              style={{
                fontFamily: "Fraunces-Bold",
                fontSize: 18,
                color: "#991B1B",
                marginBottom: 6,
                textAlign: "center",
              }}
            >
              Appointment Declined
            </Text>

            <Text
              style={{
                fontFamily: "WorkSans_400Regular",
                fontSize: 13.5,
                color: "#7F1D1D",
                textAlign: "center",
                lineHeight: 19,
                marginBottom: 16,
              }}
            >
              The atelier was unable to accept this fitting request at the selected time. You can reach out directly to the concierge to select an alternative slot.
            </Text>

            <Pressable
              onPress={() => {
                if (fashionHouseId) {
                  router.push(`/(customer)/chat/${fashionHouseId}` as any);
                } else {
                  router.push("/(customer)/(tabs)/browse" as any);
                }
              }}
              style={({ pressed }) => [
                {
                  backgroundColor: "#4A080C",
                  height: 44,
                  paddingHorizontal: 20,
                  borderRadius: 22,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text
                style={{
                  fontFamily: "WorkSans_600SemiBold",
                  fontSize: 14,
                  color: "#FFFFFF",
                }}
              >
                Contact Concierge
              </Text>
            </Pressable>
          </View>
        ) : (
          /* Live Timeline Stepper */
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardHeadline}>Production Progress</Text>
              {loading && <ActivityIndicator size="small" color="#4A080C" />}
            </View>
            <View style={styles.timelineContainer}>
              {STAGES.map((stg, idx) => {
                const isDone = idx <= activeStageIdx;
                const isCurrent = idx === activeStageIdx;
                const isLast = idx === STAGES.length - 1;

                return (
                  <View key={stg.key} style={styles.stepRow}>
                    {/* Icon & Connector Line */}
                    <View style={styles.indicatorCol}>
                      <View style={[styles.circle, isDone ? styles.circleDone : styles.circlePending]}>
                        {isDone ? (
                          <Check size={13} color="#FFFFFF" strokeWidth={3} />
                        ) : (
                          <Text style={styles.circleNumber}>{idx + 1}</Text>
                        )}
                      </View>
                      {!isLast && (
                        <View
                          style={[
                            styles.connector,
                            isDone && idx < activeStageIdx ? styles.connectorDone : styles.connectorPending,
                          ]}
                        />
                      )}
                    </View>

                    {/* Step Info */}
                    <View style={styles.stepInfoCol}>
                      <Text
                        style={[
                          styles.stepLabel,
                          isCurrent && styles.stepLabelCurrent,
                          !isDone && styles.stepLabelPending,
                        ]}
                      >
                        {stg.label}
                      </Text>
                      <Text style={styles.stepDesc}>{stg.desc}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Chat / Contact Action Button */}
        <Pressable
          onPress={() => {
            if (fashionHouseId) {
              router.push(`/(customer)/chat/${fashionHouseId}` as any);
            } else {
              router.push("/(customer)/(tabs)/browse" as any);
            }
          }}
          style={({ pressed }) => [styles.chatActionBtn, { opacity: pressed ? 0.85 : 1 }]}
        >
          <MessageCircle size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.chatActionBtnText}>Message Concierge</Text>
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
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#F0EBE1",
  },
  headerTitle: { fontFamily: "WorkSans_700Bold", fontSize: 17, color: "#4A080C" },
  scrollContent: { paddingHorizontal: 20, paddingVertical: 14, paddingBottom: 32 },
  compactHeroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 12,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F0EBE1",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  compactImage: { width: 76, height: 76, borderRadius: 12 },
  compactContent: { flex: 1, marginLeft: 14, justifyContent: "center" },
  badgeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  orderBadge: {
    backgroundColor: "#FBF7EF",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#4A080C",
  },
  orderBadgeText: { fontFamily: "WorkSans_600SemiBold", fontSize: 11, color: "#4A080C" },
  fhNameText: { fontFamily: "WorkSans_600SemiBold", fontSize: 13, color: "#8A7550", flexShrink: 1, marginLeft: 6 },
  garmentTitleText: { fontFamily: "WorkSans_700Bold", fontSize: 16, color: "#3B0508", marginBottom: 4 },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  dateText: { fontFamily: "WorkSans_500Medium", fontSize: 12, color: "#8A7550", flexShrink: 1 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#F0EBE1",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  cardHeadline: { fontFamily: "WorkSans_700Bold", fontSize: 15, color: "#4A080C" },
  timelineContainer: { paddingLeft: 4 },
  stepRow: { flexDirection: "row", minHeight: 52 },
  indicatorCol: { alignItems: "center", width: 26, marginRight: 12 },
  circle: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  circleDone: { backgroundColor: "#4A080C" },
  circlePending: { backgroundColor: "#EBE6DC" },
  circleNumber: { fontFamily: "WorkSans_600SemiBold", fontSize: 10, color: "#8A7550" },
  connector: { width: 2, flex: 1, marginVertical: 3 },
  connectorDone: { backgroundColor: "#4A080C" },
  connectorPending: { backgroundColor: "#EBE6DC" },
  stepInfoCol: { flex: 1, paddingBottom: 14 },
  stepLabel: { fontFamily: "WorkSans_600SemiBold", fontSize: 13.5, color: "#3B0508" },
  stepLabelCurrent: { color: "#4A080C", fontFamily: "WorkSans_700Bold" },
  stepLabelPending: { color: "#A0A0A0" },
  stepDesc: { fontFamily: "WorkSans_400Regular", fontSize: 11.5, color: "#8A7550", marginTop: 1 },
  chatActionBtn: {
    backgroundColor: "#4A080C",
    height: 48,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#4A080C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  chatActionBtnText: { fontFamily: "WorkSans_600SemiBold", fontSize: 14, color: "#FFFFFF" },
});


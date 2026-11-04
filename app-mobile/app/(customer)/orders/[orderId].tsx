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
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
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
import CachedImage from "@/shared/components/CachedImage";
import { useAuthStore } from "@/stores/useAuthStore";
import { apiFetch } from "@/shared/utils/apiClient";
import { generateOrderNumber } from "@/shared/utils/orderUtils";
import { alertEmitter } from "@/shared/utils/alertEmitter";
import { useOrdersStore } from "@/stores/useOrdersStore";

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
  const updateOrderStatus = useOrdersStore((s) => s.updateOrderStatus);

  const params = useLocalSearchParams<{
    orderId: string;
    atelierName?: string;
    garmentType?: string;
    orderNumber?: string;
    estimatedReady?: string;
    progressPercent?: string;
    imageUrl?: string;
    fashionHouseId?: string;
    rawStatus?: string;
  }>();

  const [orderData, setOrderData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const handleCancelOrder = () => {
    alertEmitter.emit({
      title: "Cancel Fitting / Order",
      message: "Are you sure you want to cancel this order? This action will invalidate your fitting appointment slot.",
      confirmLabel: "Yes, Cancel",
      cancelLabel: "Keep Order",
      onConfirm: async () => {
        if (cancelling) return;
        setCancelling(true);
        try {
          const orderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;
          if (!orderId) throw new Error("This order could not be identified. Please reopen it and try again.");
          await apiFetch(`/api/orders/track/${encodeURIComponent(orderId)}/cancel`, {
            method: "POST",
          });
          setOrderData((prev: any) => ({ ...(prev || {}), status: "cancelled" }));
          updateOrderStatus(orderId, "cancelled");
          alertEmitter.emit({ title: "Order Cancelled", message: "Your order has been successfully cancelled." });
        } catch (err: any) {
          alertEmitter.emit({ title: "Cancellation Error", message: err?.message || "Failed to cancel order. Please try again." });
        } finally {
          setCancelling(false);
        }
      },
    });
  };

  const fetchOrderDetail = async () => {
    if (!params.orderId) {
      setLoading(false);
      return;
    }
    try {
      setOrderData(await apiFetch<any>(`/api/orders/track/${params.orderId}`, { silent: true }));
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
      const interval = setInterval(() => {
        fetchOrderDetail();
      }, 15000);
      return () => clearInterval(interval);
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
  const isDeclined = currentStatus === "declined" || params.rawStatus === "declined";
  const isCancelled = currentStatus === "cancelled" || params.rawStatus === "cancelled";
  const isEnded = isDeclined || isCancelled;
  const activeStageIdx = STAGE_INDEX_MAP[currentStatus] ?? 0;
  const coverImage = orderData?.imageUrl || params.imageUrl || "";

  const fashionHouseId = orderData?.fashionHouseId || params.fashionHouseId;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Top Navigation */}
      <View style={styles.headerBar}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <BackArrowIcon size={20} color="#453332" />
        </Pressable>
        <Text style={styles.headerTitle}>Order Tracking</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#453332" />
        }
      >
        {/* Compact Hero Card */}
        <View
          style={[
            styles.compactHeroCard,
            isDeclined && { borderColor: "#FECDD3", backgroundColor: "#FFF5F5" },
            isCancelled && { borderColor: "#E5DFD5", backgroundColor: "#FFFFFF" },
          ]}
        >
          <CachedImage
            source={{ uri: coverImage }}
            style={styles.compactImage}
            contentFit="cover"
            contentPosition="top center"
          />
          <View style={styles.compactContent}>
            <View style={styles.badgeRow}>
              <View
                style={[
                  styles.orderBadge,
                  isDeclined && { borderColor: "#DC2626", backgroundColor: "#FDEAEA" },
                  isCancelled && { borderColor: "#E5DFD5", backgroundColor: "#F5EFE6" },
                ]}
              >
                <Text
                  style={[
                    styles.orderBadgeText,
                    isDeclined && { color: "#DC2626" },
                    isCancelled && { color: "#453332" },
                  ]}
                >
                  {orderNumber}
                </Text>
              </View>
              <Text style={styles.fhNameText} numberOfLines={1}>
                {fashionHouseName}
              </Text>
            </View>
            <Text style={styles.garmentTitleText} numberOfLines={1}>
              {garmentTitle}
            </Text>
            <View style={styles.dateRow}>
              <Calendar size={13} color={isDeclined ? "#DC2626" : isCancelled ? "#453332" : "#8A7550"} />
              <Text
                style={[
                  styles.dateText,
                  isDeclined && { color: "#DC2626", fontFamily: "InstrumentSans-SemiBold" },
                  isCancelled && { color: "#453332", fontFamily: "InstrumentSans-SemiBold" },
                ]}
                numberOfLines={1}
              >
                {isDeclined ? "Fitting Request Declined" : isCancelled ? "Order Cancelled by You" : estimatedReady}
              </Text>
            </View>
          </View>
        </View>

        {/* Production Progress Stepper (Active orders) */}
        {!isEnded && (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardHeadline}>Production Progress</Text>
              {loading && <ActivityIndicator size="small" color="#453332" />}
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

        {/* Action Pill Buttons */}
        <View style={styles.actionButtonRow}>
          <Pressable
            onPress={() => {
              const targetFhId = fashionHouseId || orderData?.fashionHouseId || orderData?.fashionHouse?.id;
              const targetFhName = orderData?.atelierName || params.atelierName || "Fashion House";

              if (targetFhId) {
                router.push({
                  pathname: `/(customer)/direct-chat/${targetFhId}`,
                  params: { fashionHouseName: targetFhName },
                } as any);
              } else {
                alertEmitter.emit({
                  title: "Contact Atelier",
                  message: "Fetching atelier contact info, please try again in a moment.",
                });
              }
            }}
            style={({ pressed }) => [styles.pillBtn, { opacity: pressed ? 0.85 : 1 }]}
          >
            <MessageCircle size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.pillBtnText}>Message</Text>
          </Pressable>

          {!isEnded && currentStatus !== "completed" && currentStatus !== "delivered" && (
            <Pressable
              onPress={handleCancelOrder}
              disabled={cancelling}
              style={({ pressed }) => [
                styles.pillBtn,
                { opacity: pressed || cancelling ? 0.85 : 1 },
              ]}
            >
              {cancelling ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <XCircle size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.pillBtnText}>Cancel Order</Text>
                </>
              )}
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  headerBar: {
    height: 52,
    marginTop: 36,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 12,
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
  headerTitle: { fontFamily: "HedvigLettersSerif-Regular", fontSize: 24, color: "#1A1110" },
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
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#453332",
  },
  orderBadgeText: { fontFamily: "InstrumentSans-SemiBold", fontSize: 11, color: "#453332" },
  fhNameText: { fontFamily: "InstrumentSans-SemiBold", fontSize: 13, color: "#8A7550", flexShrink: 1, marginLeft: 6 },
  garmentTitleText: { fontFamily: "InstrumentSans-Bold", fontSize: 16, color: "#3B0508", marginBottom: 4 },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  dateText: { fontFamily: "InstrumentSans-Medium", fontSize: 12, color: "#8A7550", flexShrink: 1 },
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
  cardHeadline: { fontFamily: "InstrumentSans-Bold", fontSize: 15, color: "#453332" },
  timelineContainer: { paddingLeft: 4 },
  stepRow: { flexDirection: "row", minHeight: 52 },
  indicatorCol: { alignItems: "center", width: 26, marginRight: 12 },
  circle: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  circleDone: { backgroundColor: "#453332" },
  circlePending: { backgroundColor: "#EBE6DC" },
  circleNumber: { fontFamily: "InstrumentSans-SemiBold", fontSize: 10, color: "#8A7550" },
  connector: { width: 2, flex: 1, marginVertical: 3 },
  connectorDone: { backgroundColor: "#453332" },
  connectorPending: { backgroundColor: "#EBE6DC" },
  stepInfoCol: { flex: 1, paddingBottom: 14 },
  stepLabel: { fontFamily: "InstrumentSans-SemiBold", fontSize: 13.5, color: "#3B0508" },
  stepLabelCurrent: { color: "#453332", fontFamily: "InstrumentSans-Bold" },
  stepLabelPending: { color: "#A0A0A0" },
  stepDesc: { fontFamily: "InstrumentSans-Regular", fontSize: 11.5, color: "#8A7550", marginTop: 1 },
  actionButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 6,
    marginBottom: 8,
  },
  pillBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#453332",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#453332",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  pillBtnText: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 14.5,
    color: "#FFFFFF",
  },
  pillBtnSecondary: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "rgba(74, 8, 12, 0.25)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  pillBtnSecondaryText: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 14.5,
    color: "#453332",
  },
});

import { typeScale } from "@/shared/utils/typeScale";
import React, { useState, useEffect, useCallback } from "react";
import { View, ScrollView, Pressable, Image, Linking, ActivityIndicator, StyleSheet, RefreshControl, useWindowDimensions } from "react-native";
import { Text } from "@/shared/components/Typography";
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
  Package,
} from "lucide-react-native";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import CachedImage from "@/shared/components/CachedImage";
import { useAuthStore } from "@/stores/useAuthStore";
import { apiFetch } from "@/shared/utils/apiClient";
import { generateOrderNumber } from "@/shared/utils/orderUtils";
import { alertEmitter } from "@/shared/utils/alertEmitter";
import { useOrdersStore } from "@/stores/useOrdersStore";
import { SCREEN_TOP_SPACING } from "@/shared/utils/screenSpacing";
import { isReadyToWear, READY_CUSTOMER_STAGES, readyCustomerStage } from "@/shared/utils/orderFulfillment";

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
    fulfillmentType?: string;
  }>();

  const storedOrder = useOrdersStore(s => s.orders.find(order => [order.id, order.orderId, order.bookingId].includes(params.orderId)));
  const [orderData, setOrderData] = useState<any>(() => storedOrder || null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const handleCancelOrder = () => {
    alertEmitter.emit({
      title: readyToWear ? "Cancel order?" : "Cancel fitting / order?",
      message: readyToWear ? "Do you want to cancel this ready-to-wear order?" : "Do you want to cancel this order and release your fitting appointment?",
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
          setOrderData((prev: any) => ({ ...(prev || {}), status: "cancelled", rawStatus: "cancelled" }));
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
      setOrderData(await apiFetch<any>(`/api/orders/track/${params.orderId}`, { silent: true, cache: "reload" }));
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
  const rawGarmentTitle =
    orderData?.garmentType || params.garmentType || "Bespoke Garment";
  const garmentTitle =
    rawGarmentTitle.replace(/^Measurement for\s*:?\s*/i, "").trim() || "Bespoke Garment";
  const orderNumber =
    params.orderNumber || generateOrderNumber(orderData?.orderId || params.orderId);
  const readyToWear = isReadyToWear(orderData?.fulfillmentType ? orderData : storedOrder || orderData || params);
  const currentStatus = orderData?.rawStatus || orderData?.status || params.rawStatus || (readyToWear ? "order_placed" : "booked");
  const stages = readyToWear ? READY_CUSTOMER_STAGES : STAGES;
  const activeStageIdx = readyToWear ? readyCustomerStage(currentStatus) : STAGE_INDEX_MAP[currentStatus] ?? 0;
  const completed = ["completed", "delivered"].includes(currentStatus);
  const estimatedReady = readyToWear ? READY_CUSTOMER_STAGES[activeStageIdx].label : orderData?.estimatedReady || params.estimatedReady || "Appointment details pending";
  const isDeclined = currentStatus === "declined" || params.rawStatus === "declined";
  const isCancelled = currentStatus === "cancelled" || params.rawStatus === "cancelled";
  const isEnded = isDeclined || isCancelled;
  const coverImage = orderData?.imageUrl || params.imageUrl || "";
  const lastUpdated = orderData?.updatedAt ? new Date(orderData.updatedAt) : null;

  const fashionHouseId = orderData?.fashionHouseId || params.fashionHouseId;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Top Navigation */}
      <View style={styles.headerBar}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <BackArrowIcon size={24} color="#453332" />
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
        {/* Unboxed Hero Section */}
        <View style={styles.heroSection}>
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
                  isDeclined && { borderColor: "#453332", backgroundColor: "#FFFDF9" },
                  isCancelled && { borderColor: "#453332", backgroundColor: "#FFFDF9" },
                ]}
              >
                <Text
                  style={[
                    styles.orderBadgeText,
                    isDeclined && { color: "#F96951" },
                    isCancelled && { color: "#4A403B" },
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
              {readyToWear ? <Package size={13} color={isDeclined ? "#F96951" : isCancelled ? "#453332" : "#453332"} /> : <Calendar size={13} color={isDeclined ? "#F96951" : isCancelled ? "#453332" : "#453332"} />}
              <Text
                style={[
                  styles.dateText,
                  isDeclined && { color: "#F96951", fontFamily: "InstrumentSans-SemiBold" },
                  isCancelled && { color: "#4A403B", fontFamily: "InstrumentSans-SemiBold" },
                ]}
                numberOfLines={1}
              >
                {isDeclined ? (readyToWear ? "Order declined" : "Fitting request declined") : isCancelled ? "Order cancelled" : estimatedReady}
              </Text>
            </View>
          </View>
        </View>

        {/* Production Progress Stepper (Active orders) */}
        {!isEnded && (
          <View style={styles.progressSection}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardHeadline}>{readyToWear ? "Order progress" : "Production progress"}</Text>
              {loading && <ActivityIndicator size="small" color="#453332" />}
            </View>
            {readyToWear && lastUpdated && !Number.isNaN(lastUpdated.getTime()) ? <Text style={styles.stepDesc}>Updated {lastUpdated.toLocaleString()}</Text> : null}
            <View style={styles.timelineContainer}>
              {stages.map((stg, idx) => {
                const isDone = idx <= activeStageIdx;
                const isCurrent = idx === activeStageIdx;
                const isLast = idx === stages.length - 1;

                return (
                  <View key={stg.key} style={styles.stepRow}>
                    {/* Icon & Connector Line */}
                    <View style={styles.indicatorCol}>
                      <View style={[styles.circle, isDone ? styles.circleDone : styles.circlePending]}>
                        {isDone ? (
                          <Check size={13} color="#FFFDF9" strokeWidth={3} />
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

        {readyToWear && Array.isArray(orderData?.items) && orderData.items.length > 0 ? (
          <View style={styles.progressSection}>
            <Text style={styles.cardHeadline}>Your items</Text>
            {orderData.items.map((item: any, index: number) => <View key={`${item.catalogItemId || index}-${item.selectedSize}-${item.selectedColor}`} style={{ paddingTop: 12, gap: 4 }}>
              <Text style={styles.stepLabel}>{item.quantity} × {item.name}</Text>
              <Text style={styles.stepDesc}>{[item.selectedSize && `Size ${item.selectedSize}`, item.selectedColor].filter(Boolean).join(" · ")}</Text>
            </View>)}
            {orderData?.fashionHouseLocation ? <View style={{ paddingTop: 16, gap: 4 }}><Text style={styles.stepLabel}>Pickup location</Text><Text style={styles.stepDesc}>{orderData.fashionHouseLocation}</Text></View> : null}
          </View>
        ) : null}

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
            style={({ pressed }) => [
              styles.pillBtn,
              { backgroundColor: "#453332", opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <MessageCircle size={18} color="#FFFDF9" style={{ marginRight: 8 }} />
            <Text style={styles.pillBtnText}>Message</Text>
          </Pressable>

          {!isEnded && !completed && (readyToWear ? activeStageIdx === 0 : activeStageIdx < 3) && (
            <Pressable
              onPress={handleCancelOrder}
              disabled={cancelling}
              style={({ pressed }) => [
                styles.pillBtn,
                { opacity: pressed || cancelling ? 0.85 : 1 },
              ]}
            >
              {cancelling ? (
                <ActivityIndicator size="small" color="#FFFDF9" />
              ) : (
                <>
                  <XCircle size={18} color="#FFFDF9" style={{ marginRight: 8 }} />
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
    paddingTop: SCREEN_TOP_SPACING,
    paddingBottom: 14,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  headerTitle: { ...typeScale.pageTitle, fontFamily: "InstrumentSans-Medium", color: "#4A403B" },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  heroSection: {
    paddingBottom: 20,
    marginBottom: 24,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 0,
    borderBottomColor: "#453332",
  },
  compactImage: { width: 88, height: 88, borderRadius: 16 },
  compactContent: { flex: 1, marginLeft: 16, justifyContent: "center", gap: 9 },
  badgeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  orderBadge: {
    backgroundColor: "#FFFDF9",
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#453332",
  },
  orderBadgeText: { fontFamily: "InstrumentSans-SemiBold", fontSize: 11, color: "#4A403B" },
  fhNameText: { fontFamily: "InstrumentSans-Medium", fontSize: 13, color: "#4A403B", flexShrink: 1, marginLeft: 6 },
  garmentTitleText: { fontFamily: "InstrumentSans-Medium", fontSize: 17, lineHeight: 22, color: "#4A403B" },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dateText: { fontFamily: "InstrumentSans-Medium", fontSize: 12.5, lineHeight: 17, color: "#4A403B", flexShrink: 1 },
  progressSection: {
    marginBottom: 24,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  cardHeadline: { fontFamily: "InstrumentSans-Regular", fontSize: 20, color: "#4A403B" },
  timelineContainer: { paddingLeft: 4 },
  stepRow: { flexDirection: "row", minHeight: 52 },
  indicatorCol: { alignItems: "center", width: 26, marginRight: 12 },
  circle: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  circleDone: { backgroundColor: "#453332" },
  circlePending: { backgroundColor: "#F9E8D3" },
  circleNumber: { fontFamily: "InstrumentSans-SemiBold", fontSize: 10, color: "#4A403B" },
  connector: { width: 2, flex: 1, marginVertical: 3 },
  connectorDone: { backgroundColor: "#453332" },
  connectorPending: { backgroundColor: "#FFFDF9" },
  stepInfoCol: { flex: 1, paddingBottom: 14 },
  stepLabel: { fontFamily: "InstrumentSans-Medium", fontSize: 13.5, color: "#4A403B" },
  stepLabelCurrent: { color: "#4A403B", fontFamily: "InstrumentSans-SemiBold" },
  stepLabelPending: { color: "#4A403B" },
  stepDesc: { fontFamily: "InstrumentSans-Regular", fontSize: 11.5, color: "#4A403B", marginTop: 1 },
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
    borderRadius: 999,
    backgroundColor: "#F96951",
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
    color: "#FFFDF9",
  },
  pillBtnSecondary: {
    flex: 1,
    height: 52,
    borderRadius: 999,
    backgroundColor: "#FFFDF9",
    borderWidth: 1.5,
    borderColor: "rgba(69, 51, 50, 0.25)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  pillBtnSecondaryText: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 14.5,
    color: "#4A403B",
  },
});

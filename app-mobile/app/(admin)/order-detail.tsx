import { typeScale } from "@/shared/utils/typeScale";
import React, { useState, useEffect, useCallback } from "react";
import { View, ScrollView, Pressable, ActivityIndicator, RefreshControl, StyleSheet, useWindowDimensions } from "react-native";
import { Text } from "@/shared/components/Typography";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router, useFocusEffect } from "expo-router";
import {
  User,
  Scissors,
  Calendar,
  FileText,
  Printer,
  CheckCircle2,
  Clock,
  Phone,
  Ruler,
  Layers,
  Package,
  MapPin,
} from "lucide-react-native";
import CachedImage from "@/shared/components/CachedImage";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import { apiFetch, invalidateReadCache } from "@/shared/utils/apiClient";
import { generateOrderNumber } from "@/shared/utils/orderUtils";
import { normalizeStatus } from "@/shared/domain/statuses";
import { formatCurrency, formatShortDate } from "@/shared/utils/formatters";
import { SCREEN_TOP_SPACING } from "@/shared/utils/screenSpacing";
import { isReadyToWear, READY_ORDER_STAGES, READY_CUSTOMER_STAGES } from "@/shared/utils/orderFulfillment";
import { useAppAlert } from "@/shared/hooks/useAppAlert";
import { isUnassignedOrder } from "@/shared/utils/adminOrderQueues";

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; step: number }
> = {
  order_placed: { label: "Order placed", bg: "#FFFDF9", text: "#453332", step: 1 },
  pending_admin_review: { label: "Awaiting review", bg: "#FFFDF9", text: "#453332", step: 1 },
  booked: { label: "Booked", bg: "#FFFDF9", text: "#453332", step: 1 },
  measurements_confirmed: { label: "Measurements Confirmed", bg: "#FFFDF9", text: "#453332", step: 2 },
  fabric_sourced: { label: "Fabric Sourced", bg: "#FFFDF9", text: "#453332", step: 2 },
  in_production: { label: "In Production", bg: "#FFFDF9", text: "#453332", step: 3 },
  quality_check: { label: "Quality Check", bg: "#FFFDF9", text: "#453332", step: 3 },
  ready: { label: "Ready for Pickup", bg: "#FFFDF9", text: "#453332", step: 4 },
  ready_for_pickup: { label: "Ready for Pickup", bg: "#FFFDF9", text: "#453332", step: 4 },
  completed: { label: "Completed", bg: "#FFFDF9", text: "#453332", step: 5 },
  delivered: { label: "Delivered", bg: "#FFFDF9", text: "#453332", step: 5 },
  cancelled: { label: "Cancelled", bg: "#FFFDF9", text: "#2B2B2B", step: 0 },
};

const STAGES = [
  { step: 1, label: "Booked" },
  { step: 2, label: "Fitted" },
  { step: 3, label: "Production" },
  { step: 4, label: "Ready" },
  { step: 5, label: "Delivered" },
];

const READY_STAGES = [
  { step: 1, label: "Placed" },
  { step: 2, label: "Preparing" },
  { step: 3, label: "Ready" },
  { step: 4, label: "Completed" },
];

export default function OrderDetailScreen() {
  const { showAlert } = useAppAlert();
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const statusLock = React.useRef(false);
  const {
    orderId,
    customerName: initialCustomer,
    orderNumber: initialOrderNumber,
    garment: initialGarment,
    price: initialPrice,
    status: initialStatus,
    assignedStaff: initialStaff,
  } = useLocalSearchParams<{
    orderId: string;
    customerName?: string;
    orderNumber?: string;
    garment?: string;
    price?: string;
    status?: string;
    assignedStaff?: string;
  }>();

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [order, setOrder] = useState<any>(null);

  const fetchOrderDetail = useCallback(async () => {
    if (!orderId) { setLoading(false); setLoadError("This order couldn't be opened."); return; }
    setLoadError("");
    try {
      if (orderId.startsWith("esc-")) {
        const rawEscId = orderId.replace(/^esc-/, "");
        const esc = await apiFetch<any>(`/api/escalations/${rawEscId}`, { silent: true });
        setOrder({
          id: orderId,
          customer: {
            name: esc.customerName || esc.customer?.name,
            phone: esc.customer?.phone || null,
            email: esc.customer?.email || null,
            measurements: esc.customer?.measurements || [],
          },
          itemName: esc.summary || "Bespoke Request",
          status: esc.status || "pending_admin_review",
          price: null,
          isBooking: true,
          createdAt: esc.createdAt,
          staff: null,
        });
        return;
      }

      setOrder(await apiFetch<any>(`/api/orders/${orderId}`, { silent: true, cache: "reload" }));
    } catch (e) {
      setLoadError("We couldn't load these details. Pull down to try again.");
    } finally {
      setLoading(false);
    }
  }, [orderId, initialPrice]);

  useFocusEffect(useCallback(() => {
    void fetchOrderDetail();
    const timer = setInterval(() => { void fetchOrderDetail(); }, 15_000);
    return () => clearInterval(timer);
  }, [fetchOrderDetail]));

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrderDetail();
    setRefreshing(false);
  };

  const customerName = order?.customer?.name || initialCustomer || "Customer";
  const customerPhone = order?.customer?.phone;
  const customerEmail = order?.customer?.email || order?.customer?.user?.email;
  const itemName = order?.itemName || initialGarment || "Bespoke Garment";
  const orderNum =
    initialOrderNumber ||
    generateOrderNumber(order?.bookingId || order?.id || orderId || "2000");
  const currentStatus = normalizeStatus(order?.status || initialStatus || "pending_admin_review");
  const readyToWear = isReadyToWear(order);
  const stages = readyToWear ? READY_STAGES : STAGES;
  const price = order?.price ?? null;
  const staffName =
    order?.staff?.name ||
    (initialStaff ? initialStaff.replace(/^Assigned to /, "") : "Unassigned");
  const createdAt = order?.createdAt ? formatShortDate(order.createdAt) : "Recent Order";

  const statusMeta = STATUS_CONFIG[currentStatus] ?? {
    label: currentStatus.replace(/_/g, " "),
    bg: "#FFFDF9",
    text: "#453332",
    step: 0,
  };
  const readyStep = ["completed", "delivered"].includes(currentStatus) ? 4
    : ["ready", "ready_for_pickup"].includes(currentStatus) ? 3
    : ["in_production", "fabric_sourced", "quality_check"].includes(currentStatus) ? 2
    : 1;
  const progressStep = readyToWear ? readyStep : statusMeta.step;

  const handleBack = () => {
    router.navigate("/(admin)/orders" as any);
  };

  // Extract measurements if available
  const measurementsList =
    order?.customer?.measurements && order.customer.measurements.length > 0
      ? order.customer.measurements[0]
      : null;

  const handleOpenInvoice = () => {
    if (!order || order.isBooking || price === null) return;
    router.push({
      pathname: "/(admin)/invoices/[orderId]",
      params: {
        orderId: order.id,
        customerName,
        orderNumber: orderNum,
        garment: itemName,
        price: price.toString(),
        status: currentStatus,
      },
    });
  };
  const nextReadyStatus = !order || ["cancelled", "declined", "completed", "delivered"].includes(currentStatus) ? null
    : isUnassignedOrder(order) ? { status: "in_production", label: "Accept order" }
      : ["ready", "ready_for_pickup"].includes(currentStatus) ? { status: "completed", label: "Mark completed" }
        : { status: "ready_for_pickup", label: "Mark ready for pickup" };
  const advanceReadyOrder = async () => {
    if (!order || !readyToWear || !nextReadyStatus || statusLock.current) return;
    statusLock.current = true;
    setUpdatingStatus(true);
    try {
      await apiFetch(`/api/orders/${encodeURIComponent(order.id)}/status`, { method: "PATCH", body: JSON.stringify({ status: nextReadyStatus.status }) });
      invalidateReadCache();
      await fetchOrderDetail();
    } catch (error) {
      showAlert("Couldn't update order", error instanceof Error ? error.message : "Please try again.");
    } finally { statusLock.current = false; setUpdatingStatus(false); }
  };

  if (!order) return <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
    <View style={[styles.header, { paddingTop: SCREEN_TOP_SPACING }]}><Pressable accessibilityLabel="Back" onPress={handleBack} style={styles.backBtn}><BackArrowIcon color="#453332" /></Pressable><Text style={styles.headerTitle}>Order Details</Text></View>
    {loading ? <ActivityIndicator color="#453332" /> : <View style={{ padding: 24, gap: 16 }}><Text accessibilityRole="alert">{loadError}</Text><Pressable onPress={() => { setLoading(true); void fetchOrderDetail(); }}><Text>Try again</Text></Pressable></View>}
  </SafeAreaView>;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={[styles.container, isLandscape && styles.containerLandscape]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable
              onPress={handleBack}
              style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <BackArrowIcon size={24} color="#453332" />
            </Pressable>
            <View>
              <Text style={styles.headerTitle}>Order Details</Text>
              {orderNum ? <Text style={styles.headerSubtitle}>{orderNum}</Text> : null}
            </View>
          </View>
          <Pressable
            onPress={handleOpenInvoice}
            disabled={!order || order.isBooking || price === null}
            style={({ pressed }) => [styles.invoiceHeaderBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <FileText size={18} color="#453332" />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#453332" />
          }
        >
          {loading ? <ActivityIndicator color="#453332" /> : null}
          {loadError ? <Text accessibilityRole="alert">{loadError}</Text> : null}
          {/* Main Status & Order Hero Card */}
          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {customerName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.heroTitleCol}>
                <Text style={styles.customerName}>{customerName}</Text>
                <Text style={styles.garmentTitle}>{itemName}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusMeta.bg }]}>
                <Text style={[styles.statusText, { color: statusMeta.text }]}>
                  {readyToWear && ["in_production", "fabric_sourced", "quality_check"].includes(currentStatus) ? "Preparing order" : statusMeta.label}
                </Text>
              </View>
            </View>

            {/* Price & Date Row */}
            <View style={styles.heroDivider} />
            <View style={styles.heroMetaRow}>
              <View>
                <Text style={styles.metaLabel}>TOTAL PRICE</Text>
                <Text style={styles.priceValue}>{price === null ? "Quote not set" : formatCurrency(price)}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.metaLabel}>CREATED</Text>
                <Text style={styles.dateValue}>{createdAt}</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{readyToWear ? "Order tracking" : "Production progress"}</Text>
            {stages.map((stage, index) => {
              const reached = progressStep >= stage.step;
              return <View key={stage.step} style={{ flexDirection: "row", minHeight: 68 }}>
                <View style={{ width: 28, alignItems: "center", marginRight: 14 }}>
                  <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: reached ? "#453332" : "#F9E8D3" }}>
                    {reached ? <CheckCircle2 size={16} color="#FFFFFF" /> : <Text style={{ fontSize: 12 }}>{index + 1}</Text>}
                  </View>
                  {index < stages.length - 1 ? <View style={{ width: 2, flex: 1, marginVertical: 4, backgroundColor: reached ? "#453332" : "#F9E8D3" }} /> : null}
                </View>
                <View style={{ flex: 1, minWidth: 0, paddingBottom: 18 }}>
                  <Text style={{ color: "#4A403B", fontFamily: progressStep === stage.step ? "InstrumentSans-SemiBold" : "InstrumentSans-Medium", fontSize: 15, textAlign: "left" }}>{readyToWear ? READY_CUSTOMER_STAGES[index].label : stage.label}</Text>
                  {readyToWear ? <Text style={{ color: "#4A403B", fontSize: 13, lineHeight: 19, marginTop: 4 }}>{READY_CUSTOMER_STAGES[index].desc}</Text> : null}
                </View>
              </View>;
            })}
            {readyToWear && nextReadyStatus ? <Pressable disabled={updatingStatus} onPress={advanceReadyOrder} style={[styles.primaryBtn, { marginTop: 10, opacity: updatingStatus ? 0.6 : 1 }]}><Text style={styles.primaryBtnText}>{updatingStatus ? "Updating?" : nextReadyStatus.label}</Text></Pressable> : null}
          </View>

          {/* Ready-to-Wear: Ordered Items & Specifications Card */}
          {readyToWear && (
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Package size={18} color="#453332" />
                  <Text style={styles.sectionTitle}>Ordered Items & Specifications</Text>
                </View>
                <Text style={styles.unitBadge}>READY TO WEAR</Text>
              </View>

              {Array.isArray(order?.items) && order.items.length > 0 ? (
                order.items.map((it: any, idx: number) => (
                  <View key={it.catalogItemId || idx} style={styles.orderItemRow}>
                    {it.imageUrl ? (
                      <CachedImage source={{ uri: it.imageUrl }} style={styles.itemThumb} contentFit="cover" />
                    ) : null}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{it.name || itemName}</Text>
                      <View style={styles.itemSpecsRow}>
                        {it.selectedSize ? (
                          <View style={styles.specBadge}>
                            <Text style={styles.specBadgeText}>Size: {it.selectedSize}</Text>
                          </View>
                        ) : null}
                        {it.selectedColor ? (
                          <View style={styles.specBadge}>
                            <Text style={styles.specBadgeText}>Color: {it.selectedColor}</Text>
                          </View>
                        ) : null}
                        <Text style={styles.qtyText}>Qty: {it.quantity || 1}</Text>
                      </View>
                      <Text style={styles.itemPriceText}>{formatCurrency(it.unitPrice || price || 0)}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.orderItemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{itemName}</Text>
                    <Text style={styles.qtyText}>Off-the-rack garment • Standard ready-to-wear sizing</Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Customer & Assignment Info Card */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{readyToWear ? "Customer & Pickup Details" : "Assignment & Contact"}</Text>

            {readyToWear ? (
              <View style={styles.infoRow}>
                <View style={styles.infoIconBox}>
                  <MapPin size={18} color="#453332" />
                </View>
                <View style={styles.infoTextBox}>
                  <Text style={styles.infoFieldLabel}>Fulfillment Method</Text>
                  <Text style={styles.infoFieldValue}>In-Store Pickup</Text>
                </View>
              </View>
            ) : (
              <View style={styles.infoRow}>
                <View style={styles.infoIconBox}>
                  <Scissors size={18} color="#453332" />
                </View>
                <View style={styles.infoTextBox}>
                  <Text style={styles.infoFieldLabel}>Tailor / Staff In Charge</Text>
                  <Text style={styles.infoFieldValue}>{staffName}</Text>
                </View>
              </View>
            )}

            {customerPhone && (
              <View style={styles.infoRow}>
                <View style={styles.infoIconBox}>
                  <Phone size={18} color="#453332" />
                </View>
                <View style={styles.infoTextBox}>
                  <Text style={styles.infoFieldLabel}>Phone Number</Text>
                  <Text style={styles.infoFieldValue}>{customerPhone}</Text>
                </View>
              </View>
            )}

            <View style={styles.infoRow}>
              <View style={styles.infoIconBox}>
                <User size={18} color="#453332" />
              </View>
              <View style={styles.infoTextBox}>
                <Text style={styles.infoFieldLabel}>Customer Name</Text>
                <Text style={styles.infoFieldValue}>{customerName}</Text>
              </View>
            </View>

            {!readyToWear && order?.staff?.name ? (
              <View style={styles.infoRow}>
                <View style={styles.infoIconBox}>
                  <Scissors size={18} color="#453332" />
                </View>
                <View style={styles.infoTextBox}>
                  <Text style={styles.infoFieldLabel}>Assigned Staff</Text>
                  <Text style={styles.infoFieldValue}>{order.staff.name}</Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* Measurements Card (if available) */}
          {!readyToWear && measurementsList && (
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ruler size={18} color="#453332" />
                  <Text style={styles.sectionTitle}>Client Measurements</Text>
                </View>
                {measurementsList.unit && (
                  <Text style={styles.unitBadge}>{measurementsList.unit.toUpperCase()}</Text>
                )}
              </View>

              <View style={styles.measurementsGrid}>
                {Object.entries(measurementsList)
                  .filter(([k, v]) => {
                    return (
                      ![
                        "id",
                        "customerId",
                        "customer",
                        "recordedAt",
                        "createdAt",
                        "updatedAt",
                        "unit",
                      ].includes(k) &&
                      v !== null &&
                      v !== undefined &&
                      v !== ""
                    );
                  })
                  .map(([key, value]) => (
                    <View key={key} style={styles.measurementItem}>
                      <Text style={styles.measurementKey}>
                        {key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                      </Text>
                      <Text style={styles.measurementVal}>
                        {String(value)} {measurementsList.unit || "in"}
                      </Text>
                    </View>
                  ))}
              </View>
            </View>
          )}

          {/* Bottom Action Cards */}
          <View style={styles.actionContainer}>
            <Pressable
              onPress={handleOpenInvoice}
              style={({ pressed }) => [
                styles.primaryBtn,
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <FileText size={18} color="#FFFDF9" />
              <Text style={styles.primaryBtnText}>Open & Print Invoice</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  containerLandscape: {
    maxWidth: 720,
    alignSelf: "center",
    width: "100%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: SCREEN_TOP_SPACING,
    paddingBottom: 14,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  backBtn: {
    width: 44,
    height: 44,




    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    ...typeScale.pageTitle,
    color: "#4A403B",
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    ...typeScale.caption,
    color: "#4A403B",
    marginTop: 2,
  },
  invoiceHeaderBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(69, 51, 50, 0.08)",
    shadowColor: "#2B2B2B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#453332",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 20,
    color: "#FFFDF9",
  },
  heroTitleCol: {
    flex: 1,
  },
  customerName: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 18,
    color: "#4A403B",
  },
  garmentTitle: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 14,
    color: "#4A403B",
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  statusText: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 11,
  },
  heroDivider: {
    display: "none",
    height: 1,
    backgroundColor: "rgba(69, 51, 50, 0.08)",
    marginVertical: 16,
  },
  heroMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaLabel: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 10,
    letterSpacing: 0.8,
    color: "#4A403B",
    marginBottom: 4,
  },
  priceValue: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 22,
    color: "#4A403B",
  },
  dateValue: {
    fontFamily: "InstrumentSans-Medium",
    fontSize: 14,
    color: "#4A403B",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(69, 51, 50, 0.08)",
    shadowColor: "#2B2B2B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    ...typeScale.sectionTitle,
    flexShrink: 1,
    textAlign: "left",
    color: "#4A403B",
    marginBottom: 14,
  },
  unitBadge: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 10,
    color: "#4A403B",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  timelineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  timelineStepContainer: {
    flex: 1,
    alignItems: "center",
  },
  stepCircleRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    justifyContent: "center",
  },
  stepConnector: {
    flex: 1,
    height: 2,
    backgroundColor: "#FFFFFF",
  },
  stepConnectorActive: {
    backgroundColor: "#453332",
  },
  stepCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#F0EDE8",
    justifyContent: "center",
    alignItems: "center",
  },
  stepCirclePassed: {
    backgroundColor: "#453332",
  },
  stepCircleCurrent: {
    backgroundColor: "#453332",
    borderWidth: 2,
    borderColor: "#453332",
  },
  stepNumText: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 10,
    color: "#4A403B",
  },
  stepLabel: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 11,
    color: "#4A403B",
    marginTop: 6,
    textAlign: "center",
  },
  stepLabelActive: {
    color: "#4A403B",
    fontFamily: "InstrumentSans-SemiBold",
  },
  stepLabelCurrent: {
    color: "#4A403B",
    fontFamily: "InstrumentSans-SemiBold",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 0,
    borderBottomColor: "rgba(69, 51, 50, 0.05)",
    gap: 12,
  },
  infoIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F0EDE8",
    justifyContent: "center",
    alignItems: "center",
  },
  infoTextBox: {
    flex: 1,
    minWidth: 0,
  },
  infoFieldLabel: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 11,
    color: "#4A403B",
  },
  infoFieldValue: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 14,
    color: "#4A403B",
    marginTop: 2,
  },
  orderItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(69, 51, 50, 0.06)",
  },
  itemThumb: {
    width: 58,
    height: 58,
    borderRadius: 12,
    backgroundColor: "#F0EDE8",
  },
  itemTitle: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 15,
    color: "#4A403B",
  },
  itemSpecsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
    flexWrap: "wrap",
  },
  specBadge: {
    backgroundColor: "rgba(69, 51, 50, 0.07)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  specBadgeText: {
    fontFamily: "InstrumentSans-Medium",
    fontSize: 11,
    color: "#4A403B",
  },
  qtyText: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 12,
    color: "#4A403B",
  },
  itemPriceText: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 14,
    color: "#4A403B",
    marginTop: 4,
  },
  measurementsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  measurementItem: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(69, 51, 50, 0.06)",
  },
  measurementKey: {
    fontFamily: "InstrumentSans-Medium",
    fontSize: 12,
    color: "#4A403B",
  },
  measurementVal: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 16,
    color: "#4A403B",
    marginTop: 4,
  },
  actionContainer: {
    marginTop: 8,
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: "#F96951",
    borderRadius: 16,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#453332",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    ...typeScale.button,
    color: "#FFFDF9",
  },
});

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
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
} from "lucide-react-native";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import { apiFetch } from "@/shared/utils/apiClient";
import { generateOrderNumber } from "@/shared/utils/orderUtils";
import { normalizeStatus } from "@/shared/domain/statuses";
import { formatCurrency, formatShortDate } from "@/shared/utils/formatters";

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; step: number }
> = {
  order_placed: { label: "Booked", bg: "#F2E0DF", text: "#7C2D32", step: 1 },
  pending_admin_review: { label: "Booked", bg: "#F2E0DF", text: "#7C2D32", step: 1 },
  booked: { label: "Booked", bg: "#F2E0DF", text: "#7C2D32", step: 1 },
  measurements_confirmed: { label: "Measurements Confirmed", bg: "#EFE6D8", text: "#B28847", step: 2 },
  fabric_sourced: { label: "Fabric Sourced", bg: "#EFE6D8", text: "#B28847", step: 2 },
  in_production: { label: "In Production", bg: "#EFE6D8", text: "#B28847", step: 3 },
  quality_check: { label: "Quality Check", bg: "#EFE6D8", text: "#B28847", step: 3 },
  ready: { label: "Ready for Pickup", bg: "#D8EFE0", text: "#2E7D47", step: 4 },
  ready_for_pickup: { label: "Ready for Pickup", bg: "#D8EFE0", text: "#2E7D47", step: 4 },
  completed: { label: "Completed", bg: "#CEEAD6", text: "#1E8E3E", step: 5 },
  delivered: { label: "Delivered", bg: "#CEEAD6", text: "#1E8E3E", step: 5 },
  cancelled: { label: "Cancelled", bg: "#E8E8E8", text: "#5F6368", step: 0 },
};

const STAGES = [
  { step: 1, label: "Booked" },
  { step: 2, label: "Fitted" },
  { step: 3, label: "Production" },
  { step: 4, label: "Ready" },
  { step: 5, label: "Delivered" },
];

export default function OrderDetailScreen() {
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

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [order, setOrder] = useState<any>(null);

  const fetchOrderDetail = useCallback(async () => {
    if (!orderId) return;
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
          status: esc.resolved ? "delivered" : "in_production",
          price: initialPrice ? parseFloat(initialPrice) : 0,
          createdAt: esc.createdAt,
          staff: null,
        });
        return;
      }

      setOrder(await apiFetch<any>(`/api/orders/${orderId}`, { silent: true }));
    } catch (e) {
      // offline or silent fail
    }
  }, [orderId, initialPrice]);

  useEffect(() => {
    fetchOrderDetail();
  }, [fetchOrderDetail]);

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
  const currentStatus = normalizeStatus(order?.status || initialStatus || "in_production");
  const price = order?.price ?? (initialPrice ? parseFloat(initialPrice) : 0);
  const staffName =
    order?.staff?.name ||
    (initialStaff ? initialStaff.replace(/^Assigned to /, "") : "Unassigned");
  const createdAt = order?.createdAt ? formatShortDate(order.createdAt) : "Recent Order";

  const statusMeta = STATUS_CONFIG[currentStatus] ?? {
    label: "In Production",
    bg: "#EFE6D8",
    text: "#B28847",
    step: 3,
  };

  // Extract measurements if available
  const measurementsList =
    order?.customer?.measurements && order.customer.measurements.length > 0
      ? order.customer.measurements[0]
      : null;

  const handleOpenInvoice = () => {
    router.push({
      pathname: "/(admin)/invoices/[orderId]",
      params: {
        orderId: orderId || order?.id || "inv-1",
        customerName,
        orderNumber: orderNum,
        garment: itemName,
        price: price.toString(),
        status: currentStatus,
      },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={[styles.container, isLandscape && styles.containerLandscape]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <BackArrowIcon size={18} color="#3B0508" />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Order Details</Text>
            <Text style={styles.headerSubtitle}>{orderNum}</Text>
          </View>
          <Pressable
            onPress={handleOpenInvoice}
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
                  {statusMeta.label}
                </Text>
              </View>
            </View>

            {/* Price & Date Row */}
            <View style={styles.heroDivider} />
            <View style={styles.heroMetaRow}>
              <View>
                <Text style={styles.metaLabel}>TOTAL PRICE</Text>
                <Text style={styles.priceValue}>{formatCurrency(price)}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.metaLabel}>CREATED</Text>
                <Text style={styles.dateValue}>{createdAt}</Text>
              </View>
            </View>
          </View>

          {/* Timeline / Progress Bar */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Production Progress</Text>
            <View style={styles.timelineRow}>
              {STAGES.map((st, i) => {
                const isPassed = statusMeta.step >= st.step;
                const isCurrent = statusMeta.step === st.step;
                return (
                  <View key={st.step} style={styles.timelineStepContainer}>
                    <View style={styles.stepCircleRow}>
                      {i > 0 && (
                        <View
                          style={[
                            styles.stepConnector,
                            isPassed && styles.stepConnectorActive,
                          ]}
                        />
                      )}
                      <View
                        style={[
                          styles.stepCircle,
                          isPassed && styles.stepCirclePassed,
                          isCurrent && styles.stepCircleCurrent,
                        ]}
                      >
                        {isPassed ? (
                          <CheckCircle2 size={12} color="#FFFFFF" />
                        ) : (
                          <Text style={styles.stepNumText}>{st.step}</Text>
                        )}
                      </View>
                      {i < STAGES.length - 1 && (
                        <View
                          style={[
                            styles.stepConnector,
                            statusMeta.step > st.step && styles.stepConnectorActive,
                          ]}
                        />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.stepLabel,
                        isPassed && styles.stepLabelActive,
                        isCurrent && styles.stepLabelCurrent,
                      ]}
                    >
                      {st.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Customer & Staff Info Card */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Assignment & Contact</Text>

            <View style={styles.infoRow}>
              <View style={styles.infoIconBox}>
                <Scissors size={18} color="#453332" />
              </View>
              <View style={styles.infoTextBox}>
                <Text style={styles.infoFieldLabel}>Tailor / Staff In Charge</Text>
                <Text style={styles.infoFieldValue}>{staffName}</Text>
              </View>
            </View>

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
          </View>

          {/* Measurements Card (if available) */}
          {measurementsList && (
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
              <FileText size={18} color="#FFFFFF" />
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
    paddingVertical: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F3EDE2",
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    alignItems: "center",
  },
  headerTitle: {
    fontFamily: "HedvigLettersSerif-Regular",
    fontSize: 18,
    color: "#453332",
  },
  headerSubtitle: {
    fontFamily: "InstrumentSans-Medium",
    fontSize: 12,
    color: "#7A7265",
    marginTop: 2,
  },
  invoiceHeaderBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F3EDE2",
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
    borderColor: "rgba(74, 8, 12, 0.08)",
    shadowColor: "#000",
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
    fontFamily: "HedvigLettersSerif-Regular",
    fontSize: 20,
    color: "#FFFFFF",
  },
  heroTitleCol: {
    flex: 1,
  },
  customerName: {
    fontFamily: "HedvigLettersSerif-Regular",
    fontSize: 18,
    color: "#453332",
  },
  garmentTitle: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 14,
    color: "#6E685E",
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
    height: 1,
    backgroundColor: "rgba(74, 8, 12, 0.08)",
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
    color: "#8A7550",
    marginBottom: 4,
  },
  priceValue: {
    fontFamily: "HedvigLettersSerif-Regular",
    fontSize: 22,
    color: "#453332",
  },
  dateValue: {
    fontFamily: "InstrumentSans-Medium",
    fontSize: 14,
    color: "#333333",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(74, 8, 12, 0.08)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: "HedvigLettersSerif-Regular",
    fontSize: 16,
    color: "#453332",
    marginBottom: 14,
  },
  unitBadge: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 10,
    color: "#8A7550",
    backgroundColor: "#F4ECE1",
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
    backgroundColor: "#E8E4DD",
  },
  stepConnectorActive: {
    backgroundColor: "#453332",
  },
  stepCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#E8E4DD",
    justifyContent: "center",
    alignItems: "center",
  },
  stepCirclePassed: {
    backgroundColor: "#453332",
  },
  stepCircleCurrent: {
    backgroundColor: "#453332",
    borderWidth: 2,
    borderColor: "#B28847",
  },
  stepNumText: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 10,
    color: "#7A7265",
  },
  stepLabel: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 11,
    color: "#999",
    marginTop: 6,
    textAlign: "center",
  },
  stepLabelActive: {
    color: "#453332",
    fontFamily: "InstrumentSans-SemiBold",
  },
  stepLabelCurrent: {
    color: "#453332",
    fontFamily: "InstrumentSans-SemiBold",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(74, 8, 12, 0.05)",
    gap: 12,
  },
  infoIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  infoTextBox: {
    flex: 1,
  },
  infoFieldLabel: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 11,
    color: "#7A7265",
  },
  infoFieldValue: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 14,
    color: "#1A1110",
    marginTop: 2,
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
    borderColor: "rgba(74, 8, 12, 0.06)",
  },
  measurementKey: {
    fontFamily: "InstrumentSans-Medium",
    fontSize: 12,
    color: "#7A7265",
  },
  measurementVal: {
    fontFamily: "HedvigLettersSerif-Regular",
    fontSize: 16,
    color: "#453332",
    marginTop: 4,
  },
  actionContainer: {
    marginTop: 8,
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: "#453332",
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
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 15,
    color: "#FFFFFF",
  },
});

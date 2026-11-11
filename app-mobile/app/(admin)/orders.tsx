import React, { useState, useCallback, useMemo } from "react";
import { View, FlatList, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, StyleSheet } from "react-native";
import { Text } from "@/shared/components/Typography";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, router } from "expo-router";
import { useAuthStore } from "@/stores/useAuthStore";
import { generateOrderNumber } from "@/shared/utils/orderUtils";
import { apiFetchCollectionPage, escalationsApi, getCachedResponse, invalidateReadCache } from "@/shared/utils/apiClient";
import { normalizeStatus } from "@/shared/domain/statuses";
import { isUnassignedOrder } from "@/shared/utils/adminOrderQueues";
import { isReadyToWear } from "@/shared/utils/orderFulfillment";

interface OrderItem {
  id: string;
  orderNumber: string;
  customer: string;
  item: string;
  price: number;
  status: string;
  assignedStaff: string;
  readyToWear?: boolean;
}

const FILTER_TABS = ["All", "In Production", "Booked", "Ready", "Completed", "Delivered"];

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; filterKey: string }
> = {
  order_placed: {
    label: "Booked",
    bg: "#FFFDF9",
    text: "#453332",
    filterKey: "Booked",
  },
  pending_admin_review: {
    label: "Booked",
    bg: "#FFFDF9",
    text: "#453332",
    filterKey: "Booked",
  },
  booked: {
    label: "Booked",
    bg: "#FFFDF9",
    text: "#453332",
    filterKey: "Booked",
  },
  measurements_confirmed: {
    label: "Measurements Confirmed",
    bg: "#FFFDF9",
    text: "#453332",
    filterKey: "In Production",
  },
  fabric_sourced: {
    label: "Fabric Sourced",
    bg: "#FFFDF9",
    text: "#453332",
    filterKey: "In Production",
  },
  in_production: {
    label: "In Production",
    bg: "#FFFDF9",
    text: "#453332",
    filterKey: "In Production",
  },
  quality_check: {
    label: "Quality Check",
    bg: "#FFFDF9",
    text: "#453332",
    filterKey: "In Production",
  },
  ready: {
    label: "Ready",
    bg: "#FFFDF9",
    text: "#453332",
    filterKey: "Ready",
  },
  ready_for_pickup: {
    label: "Ready",
    bg: "#FFFDF9",
    text: "#453332",
    filterKey: "Ready",
  },
  completed: {
    label: "Completed",
    bg: "#FFFDF9",
    text: "#453332",
    filterKey: "Completed",
  },
  delivered: {
    label: "Delivered",
    bg: "#FFFDF9",
    text: "#453332",
    filterKey: "Delivered",
  },
  cancelled: {
    label: "Cancelled",
    bg: "#FFFDF9",
    text: "#F96951",
    filterKey: "Cancelled",
  },
};

export default function AdminOrdersScreen() {
  const token = useAuthStore((s) => s.token);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [selectedFilter, setSelectedFilter] = useState("All");

  const fetchOrders = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const [ordersRes, escRes] = await Promise.allSettled([
        apiFetchCollectionPage<any>("/api/orders?page=1&limit=50", { silent: true, cache: "reload" }),
        escalationsApi.getEscalations(),
      ]);

      const merged: OrderItem[] = [];

      // 1. Process database Orders
      if (ordersRes.status === "fulfilled") {
        setNextPage(ordersRes.value.nextPage);
        const data = ordersRes.value.items;
        if (Array.isArray(data)) {
          data.forEach((o: any) => {
            merged.push({
              id: o.id,
              orderNumber: generateOrderNumber(o.bookingId || o.id),
              customer: o.customer?.name || "Customer",
              item: o.itemName || "Bespoke Fitting",
              price: o.price || 0,
              status: o.status || "in_production",
              assignedStaff: o.staff?.name ? `Assigned to ${o.staff.name}` : "Unassigned",
              readyToWear: isReadyToWear(o),
            });
          });
        }
      }

      // 2. Supplement resolved escalations if not already captured in orders
      const coveredNames = new Set(merged.map((o) => o.customer.toLowerCase()));

      if (escRes.status === "fulfilled") {
        const escData = escRes.value;
        if (Array.isArray(escData)) {
          escData
            .filter((e: any) => Boolean(e.preferredDate || e.bookingStatus || e.purpose) && e.resolved && Boolean(e.assignedStaff?.id) && e.bookingStatus !== "declined")
            .forEach((e: any) => {
              const name = e.customerName || e.customer?.name || "Customer";
              if (!coveredNames.has(name.toLowerCase())) {
                coveredNames.add(name.toLowerCase());
                merged.push({
                  id: `esc-${e.id}`,
                  orderNumber: generateOrderNumber(e.id),
                  customer: name,
                  item: e.reason || e.summary || "Bespoke Fitting",
                  price: 0,
                  status: e.bookingStatus === "completed" ? "completed" : "order_placed",
                  assignedStaff: e.assignedStaff?.name
                    ? `Assigned to ${e.assignedStaff.name}`
                    : "Unassigned",
                });
              }
            });
        }
      }

      if (ordersRes.status === "fulfilled") setItems(merged);
    } catch {
      // ignore network errors
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  const loadMoreOrders = async () => {
    if (!token || !nextPage || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await apiFetchCollectionPage<any>(`/api/orders?page=${nextPage}&limit=50`, { silent: true });
      const data = result.items;
      setNextPage(result.nextPage);
      if (Array.isArray(data)) {
        const incoming: OrderItem[] = data.filter((order: any) => !isUnassignedOrder(order)).map((order: any) => ({
          id: order.id,
          orderNumber: generateOrderNumber(order.bookingId || order.id),
          customer: order.customer?.name || "Customer",
          item: order.itemName || "Bespoke Fitting",
          price: order.price || 0,
          status: order.status || "in_production",
          assignedStaff: order.staff?.name ? `Assigned to ${order.staff.name}` : "Unassigned",
          readyToWear: isReadyToWear(order),
        }));
        setItems((current) => {
          const byId = new Map(current.map((item) => [item.id, item]));
          incoming.forEach((item) => byId.set(item.id, item));
          return Array.from(byId.values());
        });
      }
    } finally {
      setLoadingMore(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (!getCachedResponse("/api/orders?page=1&limit=50")) setLoading(true);
      void fetchOrders();
    }, [fetchOrders])
  );

  const onRefresh = () => {
    invalidateReadCache();
    setRefreshing(true);
    fetchOrders();
  };

  const filteredItems = useMemo(() => {
    if (selectedFilter === "All") return items;
    return items.filter((item) => {
      const meta = STATUS_CONFIG[normalizeStatus(item.status)];
      return meta?.filterKey === selectedFilter;
    });
  }, [items, selectedFilter]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Title */}
      <View style={styles.header}>
        <Text style={styles.title}>Orders</Text>
      </View>

      {/* Filter Chips Bar */}
      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {FILTER_TABS.map((tab) => {
            const isActive = selectedFilter === tab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setSelectedFilter(tab)}
                activeOpacity={0.8}
                style={[
                  styles.filterChip,
                  isActive ? styles.filterChipActive : styles.filterChipInactive,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isActive ? styles.filterChipTextActive : styles.filterChipTextInactive,
                  ]}
                >
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Content */}
      {loading && items.length === 0 ? (
        <ActivityIndicator color="#453332" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onEndReached={() => void loadMoreOrders()}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator color="#453332" style={{ margin: 16 }} /> : null}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#453332"
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                No {selectedFilter !== "All" ? selectedFilter.toLowerCase() : ""} orders found
              </Text>
              <Text style={styles.emptySubText}>
                Orders matching this filter will appear here. Check another filter or pull down to refresh.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const meta = STATUS_CONFIG[normalizeStatus(item.status)] ?? {
              label: "In Production",
              bg: "#FFFDF9",
              text: "#453332",
              filterKey: "In Production",
            };
            const initial = item.customer ? item.customer[0].toUpperCase() : "C";

            return (
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={() => {
                  router.push({
                    pathname: "/(admin)/order-detail",
                    params: {
                      orderId: item.id,
                      customerName: item.customer,
                      orderNumber: item.orderNumber,
                      garment: item.item,
                      price: item.price?.toString() || "350000",
                      status: item.status,
                      assignedStaff: item.assignedStaff,
                    },
                  });
                }}
                style={styles.card}
              >
                {/* Monogram Avatar */}
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>

                {/* Card Details */}
                <View style={styles.cardBody}>
                  {/* Top: Customer Name & Status */}
                  <View style={styles.rowBetween}>
                    <Text style={styles.customerName} numberOfLines={1}>
                      {item.customer}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.statusText, { color: meta.text }]}>
                        {item.readyToWear && meta.filterKey === "In Production" ? "Preparing order" : meta.label}
                      </Text>
                    </View>
                  </View>

                  {/* Middle: Order Number */}
                  <Text style={styles.orderNumber}>{item.orderNumber}</Text>

                  {/* Bottom: Item Name & Assigned Staff */}
                  <View style={[styles.rowBetween, styles.bottomRow]}>
                    <Text style={styles.itemText} numberOfLines={1}>
                      {item.item}
                    </Text>
                    {!item.readyToWear && <Text style={styles.assignedText} numberOfLines={1}>
                      {item.assignedStaff}
                    </Text>}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 16,
  },
  title: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 32,
    color: "#4A403B",
  },
  filterContainer: {
    marginBottom: 16,
  },
  filterScroll: {
    paddingHorizontal: 24,
    gap: 10,
  },
  filterChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
  },
  filterChipActive: {
    backgroundColor: "#F96951",
  },
  filterChipInactive: {
    backgroundColor: "#FFFFFF",
  },
  filterChipText: {
    fontFamily: "InstrumentSans-Medium",
    fontSize: 14,
  },
  filterChipTextActive: {
    color: "#FFFDF9",
  },
  filterChipTextInactive: {
    color: "#4A403B",
  },
  list: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#2B2B2B",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#453332",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  avatarText: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 18,
    color: "#FFFDF9",
  },
  cardBody: {
    flex: 1,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  customerName: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 15,
    color: "#4A403B",
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontFamily: "InstrumentSans-Medium",
    fontSize: 11,
  },
  orderNumber: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 14,
    color: "#4A403B",
    marginTop: 2,
    marginBottom: 6,
  },
  bottomRow: {
    marginTop: 2,
  },
  itemText: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 12,
    color: "#4A403B",
    flex: 1,
    marginRight: 8,
  },
  assignedText: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 12,
    color: "#4A403B",
  },
  empty: {
    alignItems: "center",
    marginTop: 24,
    padding: 24,
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
  },
  emptyText: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 17,
    textAlign: "center",
    color: "#4A403B",
    marginBottom: 6,
  },
  emptySubText: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    color: "#4A403B",
  },
});

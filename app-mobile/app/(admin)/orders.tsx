import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  FlatList,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { useAuthStore } from "@/stores/useAuthStore";
import { API_BASE_URL } from "@/api/config";
import { generateOrderNumber } from "@/shared/utils/orderUtils";

interface OrderItem {
  id: string;
  orderNumber: string;
  customer: string;
  item: string;
  price: number;
  status: string;
  assignedStaff: string;
}

const FILTER_TABS = ["All", "In Production", "Booked", "Ready", "Completed", "Delivered"];

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; filterKey: string }
> = {
  order_placed: {
    label: "Booked",
    bg: "#F2E0DF",
    text: "#7C2D32",
    filterKey: "Booked",
  },
  pending_admin_review: {
    label: "Booked",
    bg: "#F2E0DF",
    text: "#7C2D32",
    filterKey: "Booked",
  },
  booked: {
    label: "Booked",
    bg: "#F2E0DF",
    text: "#7C2D32",
    filterKey: "Booked",
  },
  measurements_confirmed: {
    label: "Measurements Confirmed",
    bg: "#EFE6D8",
    text: "#B28847",
    filterKey: "In Production",
  },
  fabric_sourced: {
    label: "Fabric Sourced",
    bg: "#EFE6D8",
    text: "#B28847",
    filterKey: "In Production",
  },
  in_production: {
    label: "In Production",
    bg: "#EFE6D8",
    text: "#B28847",
    filterKey: "In Production",
  },
  quality_check: {
    label: "Quality Check",
    bg: "#EFE6D8",
    text: "#B28847",
    filterKey: "In Production",
  },
  ready: {
    label: "Ready",
    bg: "#D8EFE0",
    text: "#2E7D47",
    filterKey: "Ready",
  },
  ready_for_pickup: {
    label: "Ready",
    bg: "#D8EFE0",
    text: "#2E7D47",
    filterKey: "Ready",
  },
  completed: {
    label: "Completed",
    bg: "#CEEAD6",
    text: "#1E8E3E",
    filterKey: "Completed",
  },
  delivered: {
    label: "Delivered",
    bg: "#CEEAD6",
    text: "#1E8E3E",
    filterKey: "Delivered",
  },
  cancelled: {
    label: "Cancelled",
    bg: "#FDEAEA",
    text: "#DC2626",
    filterKey: "Cancelled",
  },
};

export default function AdminOrdersScreen() {
  const token = useAuthStore((s) => s.token);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("All");

  const fetchOrders = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const [ordersRes, escRes] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/api/orders`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/api/escalations`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const merged: OrderItem[] = [];

      // 1. Process database Orders
      if (ordersRes.status === "fulfilled" && ordersRes.value.ok) {
        const data = await ordersRes.value.json();
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
            });
          });
        }
      }

      // 2. Supplement resolved escalations if not already captured in orders
      const coveredNames = new Set(merged.map((o) => o.customer.toLowerCase()));

      if (escRes.status === "fulfilled" && escRes.value.ok) {
        const escData = await escRes.value.json();
        if (Array.isArray(escData)) {
          escData
            .filter((e: any) => e.resolved && e.bookingStatus !== "declined")
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

      setItems(merged);
    } catch {
      // ignore network errors
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchOrders();
    }, [fetchOrders])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const filteredItems = useMemo(() => {
    if (selectedFilter === "All") return items;
    return items.filter((item) => {
      const meta = STATUS_CONFIG[item.status];
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
      {loading ? (
        <ActivityIndicator color="#4A080C" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#4A080C"
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                No {selectedFilter !== "All" ? selectedFilter.toLowerCase() : ""} orders found
              </Text>
              <Text style={styles.emptySubText}>
                Assigned bookings will appear here.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const meta = STATUS_CONFIG[item.status] ?? {
              label: "In Production",
              bg: "#EFE6D8",
              text: "#B28847",
              filterKey: "In Production",
            };
            const initial = item.customer ? item.customer[0].toUpperCase() : "C";

            return (
              <View style={styles.card}>
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
                        {meta.label}
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
                    <Text style={styles.assignedText} numberOfLines={1}>
                      {item.assignedStaff}
                    </Text>
                  </View>
                </View>
              </View>
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
    backgroundColor: "#FAF7F2",
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
  },
  title: {
    fontFamily: "Fraunces-Bold",
    fontSize: 32,
    color: "#1A1110",
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
    borderRadius: 24,
  },
  filterChipActive: {
    backgroundColor: "#4A080C",
  },
  filterChipInactive: {
    backgroundColor: "#EBE7E1",
  },
  filterChipText: {
    fontFamily: "WorkSans_500Medium",
    fontSize: 14,
  },
  filterChipTextActive: {
    color: "#FFFFFF",
  },
  filterChipTextInactive: {
    color: "#4A453E",
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
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
  cardBody: {
    flex: 1,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  customerName: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 15,
    color: "#1A1110",
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontFamily: "WorkSans_500Medium",
    fontSize: 11,
  },
  orderNumber: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 14,
    color: "#1A1110",
    marginTop: 2,
    marginBottom: 6,
  },
  bottomRow: {
    marginTop: 2,
  },
  itemText: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 12,
    color: "#8A7550",
    flex: 1,
    marginRight: 8,
  },
  assignedText: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 12,
    color: "#8A7550",
  },
  empty: {
    alignItems: "center",
    marginTop: 60,
  },
  emptyText: {
    fontFamily: "Fraunces-SemiBold",
    fontSize: 18,
    color: "#4A080C",
    marginBottom: 6,
  },
  emptySubText: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 14,
    color: "#8A7550",
  },
});

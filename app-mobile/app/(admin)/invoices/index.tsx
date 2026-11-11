import { typeScale } from "@/shared/utils/typeScale";
import React, { useState, useCallback } from "react";
import { View, Pressable, FlatList, RefreshControl, StyleSheet, useWindowDimensions } from "react-native";
import { Text } from "@/shared/components/Typography";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import { useAppDataStore } from "@/stores/useAppDataStore";
import { ordersApi } from "@/shared/utils/apiClient";
import { isPaymentPaid } from "@/shared/domain/statuses";
import { formatCurrency, formatShortDate } from "@/shared/utils/formatters";

interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  customerName: string;
  date: string;
  amount: number;
  status: "Pending" | "Paid";
  garment?: string;
  orderNumber?: string;
}

export default function InvoicesListScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const storeOrders = useAppDataStore((s) => s.orders);
  const [liveOrders, setLiveOrders] = useState<any[]>(storeOrders || []);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const data = await ordersApi.getOrders();
      if (Array.isArray(data)) {
        setLiveOrders(data);
        useAppDataStore.getState().setOrders(data);
      }
    } catch {
      // fallback to store
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchOrders();
    }, [fetchOrders])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  };

  const currentOrders = liveOrders.length > 0 ? liveOrders : storeOrders;

  const invoices: InvoiceItem[] = React.useMemo(() => {
    if (currentOrders && currentOrders.length > 0) {
      return currentOrders.map((o: any, idx: number) => {
        const orderNum = o.orderNumber || `#TFH-${(o.id || String(idx)).slice(0, 4).toUpperCase()}`;
        return {
          id: o.id || `inv-${idx + 1}`,
          invoiceNumber: orderNum.replace("#TFH-", "INV-").replace("#", "INV-"),
          orderNumber: orderNum,
          customerName: o.customer?.name || o.customer || "Customer",
          garment: o.itemName || o.item || "Bespoke Fitting & Tailoring",
          date: formatShortDate(o.createdAt),
          amount: typeof o.invoice?.total === "number" ? o.invoice.total : (typeof o.price === "number" ? o.price : 0),
          status: isPaymentPaid(o.invoice?.paymentStatus) ? "Paid" : "Pending",
        };
      });
    }
    return [];
  }, [currentOrders]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={[styles.container, isLandscape && styles.containerLandscape]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.push("/(admin)/settings" as any)}
            style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <BackArrowIcon size={24} color="#453332" />
          </Pressable>

          <Text style={styles.headerTitle}>Invoice</Text>
        </View>

        {/* Invoice Cards List */}
        <FlatList
          data={invoices}
          ListEmptyComponent={<View style={{ padding: 24, marginTop: 16, borderRadius: 20, backgroundColor: "#F9E8D3", gap: 8 }}><Text style={{ fontSize: 17, fontFamily: "InstrumentSans-Medium" }}>No invoices yet</Text><Text style={{ fontSize: 14, lineHeight: 21 }}>Your customer invoices will appear here once they're created.</Text></View>}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#453332" />
          }
          renderItem={({ item }) => {
            const isPaid = isPaymentPaid(item.status);

            return (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/(admin)/invoices/[orderId]",
                    params: {
                      orderId: item.id,
                      customerName: item.customerName,
                      orderNumber: item.orderNumber || item.invoiceNumber,
                      garment: item.garment,
                      price: item.amount.toString(),
                      status: item.status,
                      date: item.date,
                    },
                  })
                }
                style={({ pressed }) => [
                  styles.card,
                  { opacity: pressed ? 0.94 : 1 },
                ]}
              >
                {/* Left Column: Number & Client/Date */}
                <View style={styles.leftCol}>
                  <Text style={styles.invoiceNumber}>{item.invoiceNumber}</Text>
                  <Text style={styles.clientDate}>
                    {item.customerName}  •  {item.date}
                  </Text>
                </View>

                {/* Right Column: Amount & Status Badge */}
                <View style={styles.rightCol}>
                  <Text style={styles.amount}>
                    {formatCurrency(item.amount)}
                  </Text>
                  <View
                    style={[
                      styles.statusPill,
                      isPaid ? styles.paidPill : styles.pendingPill,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        isPaid ? styles.paidText : styles.pendingText,
                      ]}
                    >
                      {item.status}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
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
    paddingHorizontal: 24,
    paddingTop: 36,
  },
  containerLandscape: {
    maxWidth: 680,
    alignSelf: "center",
    width: "100%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  backBtn: {
    width: 44,
    height: 44,



    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  headerTitle: {
    ...typeScale.pageTitle,
    color: "#4A403B",
    letterSpacing: -0.2,
  },
  listContent: {
    paddingBottom: 32,
  },
  card: {
    backgroundColor: "#F9E8D3",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#2B2B2B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  leftCol: {
    flex: 1,
    justifyContent: "center",
    paddingRight: 12,
  },
  invoiceNumber: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 16,
    color: "#4A403B",
    marginBottom: 6,
  },
  clientDate: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 13,
    color: "#4A403B",
  },
  rightCol: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  amount: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 18,
    color: "#4A403B",
    marginBottom: 6,
  },
  statusPill: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  pendingPill: {
    backgroundColor: "#FFFFFF",
  },
  paidPill: {
    backgroundColor: "#FFFFFF",
  },
  statusText: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 12,
  },
  pendingText: {
    color: "#453332",
  },
  paidText: {
    color: "#453332",
  },
});

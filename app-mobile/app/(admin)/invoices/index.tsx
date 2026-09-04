import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import BackArrowIcon from "@/shared/components/BackArrowIcon";

interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  customerName: string;
  date: string;
  amount: number;
  status: "Pending" | "Paid";
}

const MOCK_INVOICES: InvoiceItem[] = [
  {
    id: "inv-1",
    invoiceNumber: "INV-1042",
    customerName: "Chiamaka O.",
    date: "Sep 6, 2026",
    amount: 816000,
    status: "Pending",
  },
  {
    id: "inv-2",
    invoiceNumber: "INV-1041",
    customerName: "Blessing A.",
    date: "Aug 30, 2026",
    amount: 378000,
    status: "Paid",
  },
  {
    id: "inv-3",
    invoiceNumber: "INV-1040",
    customerName: "Ifeoma N.",
    date: "Jul 14, 2026",
    amount: 378000,
    status: "Paid",
  },
];

export default function InvoicesListScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [invoices] = useState<InvoiceItem[]>(MOCK_INVOICES);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={[styles.container, isLandscape && styles.containerLandscape]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.push("/(admin)/settings" as any)}
            style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <BackArrowIcon size={18} color="#3B0508" />
          </Pressable>

          <Text style={styles.headerTitle}>Invoice</Text>
        </View>

        {/* Invoice Cards List */}
        <FlatList
          data={invoices}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isPaid = item.status === "Paid";

            return (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/(admin)/invoices/[orderId]",
                    params: { orderId: item.id },
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
                    ₦{item.amount.toLocaleString()}
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
    marginBottom: 24,
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
    lineHeight: 28,
    color: "#1A1110",
    letterSpacing: -0.2,
  },
  listContent: {
    paddingBottom: 32,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
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
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#000000",
    marginBottom: 6,
  },
  clientDate: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 13,
    color: "#7A7265",
  },
  rightCol: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  amount: {
    fontFamily: "Fraunces-Bold",
    fontSize: 18,
    color: "#000000",
    marginBottom: 6,
  },
  statusPill: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  pendingPill: {
    backgroundColor: "#F4ECE1",
  },
  paidPill: {
    backgroundColor: "#D8EED7",
  },
  statusText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 12,
  },
  pendingText: {
    color: "#B57E42",
  },
  paidText: {
    color: "#2E7D32",
  },
});

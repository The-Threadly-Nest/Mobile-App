import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowLeft, Search } from "lucide-react-native";
import { useAppAlert } from "@/shared/hooks/useAppAlert";

interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  ordersCount: number;
}

const DEFAULT_CUSTOMERS: CustomerRecord[] = [
  {
    id: "c1",
    name: "Chiamaka O.",
    phone: "+234 803 *** 6738",
    ordersCount: 4,
  },
  {
    id: "c2",
    name: "Blessing A.",
    phone: "+234 906 *** 0193",
    ordersCount: 2,
  },
  {
    id: "c3",
    name: "Ifeoma N.",
    phone: "+234 818 *** 2810",
    ordersCount: 1,
  },
  {
    id: "c4",
    name: "Jessica B.",
    phone: "+234 802 *** 4912",
    ordersCount: 3,
  },
  {
    id: "c5",
    name: "Adaobi E.",
    phone: "+234 703 *** 8104",
    ordersCount: 5,
  },
  {
    id: "c6",
    name: "Zainab K.",
    phone: "+234 814 *** 9921",
    ordersCount: 2,
  },
  {
    id: "c7",
    name: "Funmilayo A.",
    phone: "+234 905 *** 3180",
    ordersCount: 1,
  },
];

export default function CustomersScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { showAlert } = useAppAlert();

  const [searchQuery, setSearchQuery] = useState("");
  const [customers, setCustomers] = useState<CustomerRecord[]>(DEFAULT_CUSTOMERS);

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCustomerPress = (customer: CustomerRecord) => {
    showAlert(
      customer.name,
      `Phone: ${customer.phone}\nCompleted Orders: ${customer.ordersCount}`
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={[styles.container, isLandscape && styles.containerLandscape]}>
        {/* Header Row */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.push("/(admin)/settings" as any)}
            style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <ArrowLeft size={18} color="#3B0508" />
          </Pressable>
          <Text style={styles.headerTitle}>Customers</Text>
        </View>

        {/* Search Bar matching mockup */}
        <View style={styles.searchBar}>
          <Search size={20} color="#7A7265" style={{ marginRight: 12 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search customers..."
            placeholderTextColor="#8A7550"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>

        {/* Customers List */}
        <FlatList
          data={filteredCustomers}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const initial = (item.name || "C").charAt(0).toUpperCase();

            return (
              <Pressable
                onPress={() => handleCustomerPress(item)}
                style={({ pressed }) => [
                  styles.card,
                  { opacity: pressed ? 0.92 : 1 },
                ]}
              >
                {/* Initial Avatar */}
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>

                {/* Customer Details */}
                <View style={styles.detailsContainer}>
                  <Text style={styles.customerName}>{item.name}</Text>
                  <Text style={styles.customerPhone}>{item.phone}</Text>
                </View>

                {/* Orders Badge */}
                <View style={styles.ordersBadge}>
                  <Text style={styles.ordersBadgeText}>
                    {item.ordersCount} {item.ordersCount === 1 ? "orders" : "orders"}
                  </Text>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No customers matching "{searchQuery}"</Text>
            </View>
          }
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
    marginBottom: 20,
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
  searchBar: {
    height: 54,
    borderRadius: 27,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(74, 8, 12, 0.25)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    fontFamily: "WorkSans_400Regular",
    fontSize: 15,
    color: "#1A1110",
  },
  listContent: {
    paddingBottom: 32,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
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
  detailsContainer: {
    flex: 1,
  },
  customerName: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#1A1110",
    marginBottom: 4,
  },
  customerPhone: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 13,
    color: "#7A7265",
  },
  ordersBadge: {
    backgroundColor: "#F4ECEC",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  ordersBadgeText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 12,
    color: "#7A3A3E",
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyText: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 14,
    color: "#8A7550",
  },
});

import React, { useMemo, useRef, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react-native";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import CachedImage from "@/shared/components/CachedImage";
import { CartItem, useCartStore } from "@/stores/useCartStore";
import { formatCurrency } from "@/shared/utils/formatters";
import { apiFetch } from "@/shared/utils/apiClient";
import { createIdempotencyKey } from "@/shared/utils/idempotency";

interface CartGroup {
  fashionHouseId: string;
  vendorName: string;
  items: CartItem[];
  subtotal: number;
}

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const items = useCartStore((state) => state.items);
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const clearFashionHouse = useCartStore((state) => state.clearFashionHouse);
  const clearCart = useCartStore((state) => state.clearCart);
  const [placingOrderFor, setPlacingOrderFor] = useState<string | null>(null);
  const checkoutKeysRef = useRef<Record<string, string>>({});

  const groups = useMemo<CartGroup[]>(() => {
    const grouped = new Map<string, CartGroup>();
    items.forEach((item) => {
      const key = item.fashionHouseId || `unknown:${item.vendorName}`;
      const current = grouped.get(key) || {
        fashionHouseId: item.fashionHouseId,
        vendorName: item.vendorName || "Fashion House",
        items: [],
        subtotal: 0,
      };
      current.items.push(item);
      current.subtotal += item.price * item.quantity;
      grouped.set(key, current);
    });
    return Array.from(grouped.values());
  }, [items]);

  const totalItems = items.reduce((total, item) => total + item.quantity, 0);
  const totalPrice = items.reduce((total, item) => total + item.price * item.quantity, 0);

  const placeOrder = async (group: CartGroup) => {
    if (!group.fashionHouseId) {
      Alert.alert("Fashion House unavailable", "Remove this item and add it again from the marketplace.");
      return;
    }
    if (placingOrderFor) return;

    const checkoutKey = checkoutKeysRef.current[group.fashionHouseId] ??=
      createIdempotencyKey("catalog-checkout");
    setPlacingOrderFor(group.fashionHouseId);
    try {
      await apiFetch<{ id: string }>("/api/orders/catalog-checkout", {
        method: "POST",
        headers: { "Idempotency-Key": checkoutKey },
        body: JSON.stringify({
          fashionHouseId: group.fashionHouseId,
          items: group.items.map((item) => ({
            catalogItemId: item.id,
            quantity: item.quantity,
            selectedSize: item.selectedSize,
            selectedColor: item.selectedColor,
          })),
        }),
      });
      delete checkoutKeysRef.current[group.fashionHouseId];
      clearFashionHouse(group.fashionHouseId);
      Alert.alert("Order placed", `${group.vendorName} has received your order.`, [
        { text: "View My Orders", onPress: () => router.replace("/(customer)/(tabs)/orders") },
      ]);
    } catch {
      // apiFetch presents the server error. Keep the same key so a retry cannot duplicate the order.
    } finally {
      setPlacingOrderFor(null);
    }
  };

  const confirmClear = () => {
    Alert.alert("Clear cart?", "This removes every item currently in your cart.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: clearCart },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()} activeOpacity={0.75}>
          <BackArrowIcon size={20} color="#3A2E1A" />
        </TouchableOpacity>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerTitle}>Your Cart</Text>
          <Text style={styles.headerSubtitle}>{totalItems} item{totalItems === 1 ? "" : "s"}</Text>
        </View>
        {items.length > 0 ? (
          <TouchableOpacity onPress={confirmClear} style={styles.clearButton} activeOpacity={0.7}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        ) : <View style={styles.headerButton} />}
      </View>

      {groups.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}><ShoppingBag size={30} color="#453332" /></View>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptyBody}>Browse the marketplace and save styles you would like a fashion house to make.</Text>
          <TouchableOpacity style={styles.browseButton} onPress={() => router.replace("/(customer)/(tabs)/browse")} activeOpacity={0.85}>
            <Text style={styles.browseButtonText}>Browse styles</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) + 24 }]}>
          {groups.map((group) => (
            <View key={group.fashionHouseId || group.vendorName} style={styles.groupCard}>
              <View style={styles.groupHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.groupLabel}>FASHION HOUSE</Text>
                  <Text style={styles.groupName}>{group.vendorName}</Text>
                </View>
                <Text style={styles.groupSubtotal}>{formatCurrency(group.subtotal)}</Text>
              </View>

              {group.items.map((item) => (
                <View key={`${item.id}:${item.selectedSize}:${item.selectedColor}`} style={styles.itemRow}>
                  <View style={styles.itemImage}>
                    {item.image ? <CachedImage source={{ uri: item.image }} style={styles.itemImageContent} contentFit="cover" /> : null}
                  </View>
                  <View style={styles.itemDetails}>
                    <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                    <Text style={styles.itemOptions}>Size {item.selectedSize?.toUpperCase() || "Custom"} · {item.selectedColor || "Custom colour"}</Text>
                    <Text style={styles.itemPrice}>{formatCurrency(item.price * item.quantity)}</Text>
                    <View style={styles.itemActions}>
                      <View style={styles.quantityControl}>
                        <TouchableOpacity style={styles.quantityButton} onPress={() => updateQuantity(item.id, item.selectedSize, item.selectedColor, item.quantity - 1)}>
                          <Minus size={15} color="#453332" />
                        </TouchableOpacity>
                        <Text style={styles.quantityText}>{item.quantity}</Text>
                        <TouchableOpacity style={styles.quantityButton} onPress={() => updateQuantity(item.id, item.selectedSize, item.selectedColor, item.quantity + 1)}>
                          <Plus size={15} color="#453332" />
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity accessibilityLabel={`Remove ${item.name}`} onPress={() => removeItem(item.id, item.selectedSize, item.selectedColor)} style={styles.removeButton}>
                        <Trash2 size={17} color="#9A2C32" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}

              <TouchableOpacity
                style={[styles.continueButton, placingOrderFor === group.fashionHouseId && styles.continueButtonDisabled]}
                onPress={() => void placeOrder(group)}
                activeOpacity={0.85}
                disabled={placingOrderFor !== null}
              >
                <Text style={styles.continueButtonText}>
                  {placingOrderFor === group.fashionHouseId ? "Placing order…" : `Place order with ${group.vendorName}`}
                </Text>
              </TouchableOpacity>
            </View>
          ))}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Cart total</Text>
            <Text style={styles.totalPrice}>{formatCurrency(totalPrice)}</Text>
          </View>
          {groups.length > 1 ? <Text style={styles.multiHouseNote}>Each fashion house is ordered separately. Place one group at a time.</Text> : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FFFFFF" },
  header: { height: 64, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "rgba(74, 8, 12, 0.10)" },
  headerButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  headerTitleGroup: { flex: 1, alignItems: "center" },
  headerTitle: { fontFamily: "Fraunces-Bold", fontSize: 20, color: "#3B0508" },
  headerSubtitle: { fontFamily: "WorkSans_400Regular", fontSize: 11, color: "#8A7550", marginTop: 1 },
  clearButton: { width: 42, alignItems: "flex-end", paddingVertical: 10 },
  clearText: { fontFamily: "WorkSans_600SemiBold", fontSize: 12, color: "#9A2C32" },
  content: { padding: 16, gap: 16 },
  groupCard: { backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 1, borderColor: "#E8DDCD", padding: 16 },
  groupHeader: { flexDirection: "row", alignItems: "center", paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#F0E9DF" },
  groupLabel: { fontFamily: "WorkSans_600SemiBold", fontSize: 9, letterSpacing: 1, color: "#8A7550" },
  groupName: { fontFamily: "Fraunces-SemiBold", fontSize: 17, color: "#3B0508", marginTop: 2 },
  groupSubtotal: { fontFamily: "WorkSans_600SemiBold", fontSize: 14, color: "#453332" },
  itemRow: { flexDirection: "row", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F4EEE5" },
  itemImage: { width: 86, height: 102, borderRadius: 14, backgroundColor: "#EBE0D3" },
  itemImageContent: { width: "100%", height: "100%", borderRadius: 14 },
  itemDetails: { flex: 1, marginLeft: 12 },
  itemName: { fontFamily: "WorkSans_600SemiBold", fontSize: 14, lineHeight: 18, color: "#241719" },
  itemOptions: { fontFamily: "WorkSans_400Regular", fontSize: 11, color: "#8A7550", marginTop: 4 },
  itemPrice: { fontFamily: "WorkSans_600SemiBold", fontSize: 13, color: "#453332", marginTop: 5 },
  itemActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  quantityControl: { flexDirection: "row", alignItems: "center", borderRadius: 14, backgroundColor: "#F6F0E7", padding: 3 },
  quantityButton: { width: 28, height: 28, borderRadius: 11, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  quantityText: { width: 28, textAlign: "center", fontFamily: "WorkSans_600SemiBold", fontSize: 13, color: "#3B0508" },
  removeButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#FFF1F1", alignItems: "center", justifyContent: "center" },
  continueButton: { minHeight: 50, borderRadius: 25, backgroundColor: "#453332", alignItems: "center", justifyContent: "center", paddingHorizontal: 18, marginTop: 14 },
  continueButtonDisabled: { opacity: 0.6 },
  continueButtonText: { fontFamily: "WorkSans_600SemiBold", fontSize: 13, color: "#FFFFFF", textAlign: "center" },
  totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4 },
  totalLabel: { fontFamily: "WorkSans_600SemiBold", fontSize: 15, color: "#3A2E1A" },
  totalPrice: { fontFamily: "Fraunces-Bold", fontSize: 21, color: "#453332" },
  multiHouseNote: { fontFamily: "WorkSans_400Regular", fontSize: 12, lineHeight: 18, color: "#8A7550", textAlign: "center", paddingHorizontal: 20 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 36 },
  emptyIcon: { width: 68, height: 68, borderRadius: 34, backgroundColor: "#EBE0D3", alignItems: "center", justifyContent: "center", marginBottom: 18 },
  emptyTitle: { fontFamily: "Fraunces-Bold", fontSize: 22, color: "#3B0508" },
  emptyBody: { fontFamily: "WorkSans_400Regular", fontSize: 14, lineHeight: 21, color: "#8A7550", textAlign: "center", marginTop: 8, marginBottom: 24 },
  browseButton: { height: 52, borderRadius: 26, backgroundColor: "#453332", alignItems: "center", justifyContent: "center", paddingHorizontal: 30 },
  browseButtonText: { fontFamily: "WorkSans_600SemiBold", fontSize: 14, color: "#FFFFFF" },
});

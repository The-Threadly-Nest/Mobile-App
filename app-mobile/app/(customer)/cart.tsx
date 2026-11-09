import React, { useMemo, useRef, useState } from "react";
import { Alert, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Text } from "@/shared/components/Typography";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Check, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react-native";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import CachedImage from "@/shared/components/CachedImage";
import { CartItem, useCartStore } from "@/stores/useCartStore";
import { formatCurrency } from "@/shared/utils/formatters";
import { apiFetch } from "@/shared/utils/apiClient";
import { createIdempotencyKey } from "@/shared/utils/idempotency";
import { SCREEN_TOP_SPACING } from "@/shared/utils/screenSpacing";
import { useAppAlert } from "@/shared/hooks/useAppAlert";

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
  const { showConfirm, showAlert } = useAppAlert();
  const [successOrder, setSuccessOrder] = useState<{ vendorName: string; total: number } | null>(null);
  const [placingOrderFor, setPlacingOrderFor] = useState<string | null>(null);
  const checkoutKeysRef = useRef<Record<string, { key: string; signature: string }>>({});
  const checkoutBusy = useRef(false);

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
      showAlert("Fashion House unavailable", "Remove this item and add it again from the marketplace.");
      return;
    }
    if (checkoutBusy.current) return;
    checkoutBusy.current = true;
    const signature = JSON.stringify(group.items.map(item => ({ id: item.id, quantity: item.quantity, size: item.selectedSize, color: item.selectedColor })));
    if (checkoutKeysRef.current[group.fashionHouseId]?.signature !== signature) checkoutKeysRef.current[group.fashionHouseId] = { key: createIdempotencyKey("catalog-checkout"), signature };
    const checkoutKey = checkoutKeysRef.current[group.fashionHouseId].key;
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
      setSuccessOrder({
        vendorName: group.vendorName,
        total: group.subtotal,
      });
    } catch {
      // apiFetch presents the server error. Keep the same key so a retry cannot duplicate the order.
    } finally {
      checkoutBusy.current = false;
      setPlacingOrderFor(null);
    }
  };

  const confirmClear = () => {
    showConfirm("Clear cart?", "This removes every item currently in your cart.", {
      confirmLabel: "Clear",
      cancelLabel: "Cancel",
      onConfirm: clearCart,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()} activeOpacity={0.75}>
          <BackArrowIcon size={24} color="#3B0508" />
        </TouchableOpacity>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerTitle}>My Cart</Text>
          <Text style={styles.headerSubtitle}>{totalItems} item{totalItems === 1 ? "" : "s"}</Text>
        </View>
        {items.length > 0 ? (
          <TouchableOpacity disabled={placingOrderFor !== null} onPress={confirmClear} style={styles.clearButton} activeOpacity={0.7}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        ) : <View style={styles.headerButton} />}
      </View>

      {groups.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}><ShoppingBag size={30} color="#453332" /></View>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptyBody}>Choose ready-for-pickup clothes from the marketplace.</Text>
          <TouchableOpacity style={styles.browseButton} onPress={() => router.replace("/(customer)/(tabs)/browse")} activeOpacity={0.85}>
            <Text style={styles.browseButtonText}>Browse styles</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) + 24 }]}>
          {groups.map((group) => (
            <View key={group.fashionHouseId || group.vendorName} style={styles.groupSection}>
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
                    <Text style={styles.itemOptions}>{[item.selectedSize, item.selectedColor].filter(Boolean).join(" · ")}</Text>
                    <Text style={styles.itemPrice}>{formatCurrency(item.price * item.quantity)}</Text>
                    <View style={styles.itemActions}>
                      <View style={styles.quantityControl}>
                        <TouchableOpacity disabled={placingOrderFor !== null} style={styles.quantityButton} onPress={() => updateQuantity(item.id, item.selectedSize, item.selectedColor, item.quantity - 1)}>
                          <Minus size={15} color="#453332" />
                        </TouchableOpacity>
                        <Text style={styles.quantityText}>{item.quantity}</Text>
                        <TouchableOpacity disabled={placingOrderFor !== null || item.quantity >= 20} style={styles.quantityButton} onPress={() => updateQuantity(item.id, item.selectedSize, item.selectedColor, item.quantity + 1)}>
                          <Plus size={15} color="#453332" />
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity disabled={placingOrderFor !== null} accessibilityLabel={`Remove ${item.name}`} onPress={() => removeItem(item.id, item.selectedSize, item.selectedColor)} style={styles.removeButton}>
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

      {/* Styled Order Placed Success Modal */}
      <Modal
        visible={successOrder !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSuccessOrder(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconCircle}>
              <Check size={28} color="#FFFFFF" strokeWidth={2.5} />
            </View>
            <Text style={styles.modalTitle}>Order Placed!</Text>
            <Text style={styles.modalSubtitle}>
              {successOrder?.vendorName} has received your order. You can track its progress in your orders tab.
            </Text>

            <TouchableOpacity
              style={styles.modalPrimaryBtn}
              activeOpacity={0.85}
              onPress={() => {
                setSuccessOrder(null);
                router.replace("/(customer)/(tabs)/orders");
              }}
            >
              <Text style={styles.modalPrimaryBtnText}>View My Orders</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalSecondaryBtn}
              activeOpacity={0.7}
              onPress={() => {
                setSuccessOrder(null);
                router.replace("/(customer)/(tabs)/browse");
              }}
            >
              <Text style={styles.modalSecondaryBtnText}>Continue Shopping</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FFFFFF" },
  header: {
    paddingHorizontal: 20,
    paddingTop: SCREEN_TOP_SPACING,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  headerButton: { width: 44, height: 44, alignItems: "flex-start", justifyContent: "center" },
  headerTitleGroup: { flex: 1, alignItems: "center" },
  headerTitle: { fontFamily: "InstrumentSans-Regular", fontSize: 26, color: "#2B2B2B" },
  headerSubtitle: { fontFamily: "InstrumentSans-Regular", fontSize: 12, color: "#2B2B2B", marginTop: 2 },
  clearButton: { width: 44, height: 44, alignItems: "flex-end", justifyContent: "center" },
  clearText: { fontFamily: "InstrumentSans-SemiBold", fontSize: 13, color: "#9A2C32" },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  groupSection: { marginBottom: 28 },
  groupHeader: { flexDirection: "row", alignItems: "center", paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: "#F0E9DF" },
  groupLabel: { fontFamily: "InstrumentSans-SemiBold", fontSize: 9, letterSpacing: 1, color: "#2B2B2B" },
  groupName: { fontFamily: "InstrumentSans-Regular", fontSize: 20, color: "#2B2B2B", marginTop: 2 },
  groupSubtotal: { fontFamily: "InstrumentSans-SemiBold", fontSize: 15, color: "#2B2B2B" },
  itemRow: { flexDirection: "row", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F4EEE5" },
  itemImage: { width: 86, height: 102, borderRadius: 14, backgroundColor: "#EBE0D3" },
  itemImageContent: { width: "100%", height: "100%", borderRadius: 14 },
  itemDetails: { flex: 1, marginLeft: 12 },
  itemName: { fontFamily: "InstrumentSans-SemiBold", fontSize: 14, lineHeight: 18, color: "#241719" },
  itemOptions: { fontFamily: "InstrumentSans-Regular", fontSize: 11, color: "#2B2B2B", marginTop: 4 },
  itemPrice: { fontFamily: "InstrumentSans-SemiBold", fontSize: 13, color: "#2B2B2B", marginTop: 5 },
  itemActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  quantityControl: { flexDirection: "row", alignItems: "center", borderRadius: 14, backgroundColor: "#F6F0E7", padding: 3 },
  quantityButton: { width: 28, height: 28, borderRadius: 11, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  quantityText: { width: 28, textAlign: "center", fontFamily: "InstrumentSans-SemiBold", fontSize: 13, color: "#2B2B2B" },
  removeButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#FFF1F1", alignItems: "center", justifyContent: "center" },
  continueButton: { minHeight: 50, borderRadius: 25, backgroundColor: "#F96951", alignItems: "center", justifyContent: "center", paddingHorizontal: 18, marginTop: 14 },
  continueButtonDisabled: { opacity: 0.6 },
  continueButtonText: { fontFamily: "InstrumentSans-SemiBold", fontSize: 13, color: "#FFFFFF", textAlign: "center" },
  totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 12, paddingBottom: 4 },
  totalLabel: { fontFamily: "InstrumentSans-SemiBold", fontSize: 16, color: "#2B2B2B" },
  totalPrice: { fontFamily: "InstrumentSans-Regular", fontSize: 24, color: "#2B2B2B" },
  multiHouseNote: { fontFamily: "InstrumentSans-Regular", fontSize: 12, lineHeight: 18, color: "#2B2B2B", textAlign: "center", paddingHorizontal: 20 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 36 },
  emptyIcon: { width: 68, height: 68, borderRadius: 34, backgroundColor: "#EBE0D3", alignItems: "center", justifyContent: "center", marginBottom: 18 },
  emptyTitle: { fontFamily: "InstrumentSans-Regular", fontSize: 22, color: "#2B2B2B" },
  emptyBody: { fontFamily: "InstrumentSans-Regular", fontSize: 14, lineHeight: 21, color: "#2B2B2B", textAlign: "center", marginTop: 8, marginBottom: 24 },
  browseButton: { height: 52, borderRadius: 26, backgroundColor: "#F96951", alignItems: "center", justifyContent: "center", paddingHorizontal: 30 },
  browseButtonText: { fontFamily: "InstrumentSans-SemiBold", fontSize: 14, color: "#FFFFFF" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(30, 20, 20, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  modalIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#453332",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  modalTitle: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 24,
    color: "#2B2B2B",
    textAlign: "center",
    marginBottom: 8,
  },
  modalSubtitle: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 14,
    lineHeight: 20,
    color: "#746765",
    textAlign: "center",
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  modalPrimaryBtn: {
    width: "100%",
    height: 50,
    borderRadius: 25,
    backgroundColor: "#F96951",
    alignItems: "center",
    justifyContent: "center",
  },
  modalPrimaryBtnText: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 14,
    color: "#FFFFFF",
  },
  modalSecondaryBtn: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  modalSecondaryBtnText: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 13,
    color: "#2B2B2B",
  },
});

import React, { useState, useEffect, useCallback } from "react";
import { View, ScrollView, Pressable, Image, ActivityIndicator, RefreshControl, StyleSheet } from "react-native";
import { Text } from "@/shared/components/Typography";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Plus, Trash2, Tag } from "lucide-react-native";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import { apiFetch, apiFetchCollectionPage } from "@/shared/utils/apiClient";
import { useAppAlert } from "@/shared/hooks/useAppAlert";
import CachedImage from "@/shared/components/CachedImage";
import { formatCurrency } from "@/shared/utils/formatters";
import { SCREEN_TOP_SPACING } from "@/shared/utils/screenSpacing";

export interface CatalogItem {
  id: string;
  name: string;
  priceFrom: number | null;
  imageUrl: string;
  fulfillmentType?: "ready_to_wear" | "custom_fit";
  createdAt?: string;
}

export default function AdminCatalogListScreen() {
  const { showAlert, showConfirm } = useAppAlert();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchCatalog = useCallback(async () => {
    setError("");
    try {
      const result = await apiFetchCollectionPage<CatalogItem>("/api/catalog?page=1&limit=50", { silent: true });
      setItems(result.items);
      setNextPage(result.nextPage);
    } catch (err) {
      setError("We couldn't load your catalog. Pull down to try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadMoreCatalog = async () => {
    if (!nextPage || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await apiFetchCollectionPage<CatalogItem>(
        `/api/catalog?page=${nextPage}&limit=50`,
        { silent: true }
      );
      setItems((current) => {
        const byId = new Map(current.map((item) => [item.id, item]));
        result.items.forEach((item) => byId.set(item.id, item));
        return Array.from(byId.values());
      });
      setNextPage(result.nextPage);
    } catch {
      setError("We couldn't load more clothes. Please try again.");
    } finally {
      setLoadingMore(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchCatalog();
    }, [fetchCatalog])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchCatalog();
  };

  const handleDelete = (id: string, name: string) => {
    showConfirm(
      "Delete Garment",
      `Are you sure you want to remove "${name}" from your catalog?`,
      {
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        onConfirm: async () => {
          setDeletingId(id);
          try {
            await apiFetch(`/api/catalog/${id}`, { method: "DELETE" });
            setItems((prev) => prev.filter((item) => item.id !== id));
          } catch (err: any) {
            showAlert("Delete Failed", err.message || "Could not delete garment.");
          } finally {
            setDeletingId(null);
          }
        },
      }
    );
  };

  const formatMoney = (val: number | null | undefined) => {
    if (!val || typeof val !== "number") return "Price on request";
    return formatCurrency(val);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* Top Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.push("/(admin)/settings" as any)}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <BackArrowIcon size={18} color="#3B0508" />
        </Pressable>
        <Text style={styles.headerTitle}>Garment Catalog</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#453332" />}
      >
        <Text style={styles.subtext}>
          Publish ready-for-pickup clothes or custom-fit styles.
        </Text>
        {error ? <Text accessibilityRole="alert" style={{ color: "#9F1239", marginBottom: 12 }}>{error}</Text> : null}

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#453332" size="large" />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Tag size={40} color="#C4A763" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>No Clothes Uploaded Yet</Text>
            <Text style={styles.emptySub}>
              Tap "Add Clothes" to upload your brand's bespoke garments and designs.
            </Text>
            <Pressable
              onPress={() => router.push("/(admin)/catalog/new")}
              style={styles.emptyActionBtn}
            >
              <Plus size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.emptyActionBtnText}>Upload First Garment</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.gridContainer}>
            {items.map((item) => (
              <Pressable
                key={item.id}
                style={({ pressed }) => [
                  styles.productCard,
                  { opacity: pressed ? 0.92 : 1 },
                ]}
                onPress={() => {
                  router.push({
                    pathname: `/(admin)/catalog/${item.id}`,
                    params: {
                      initialName: item.name,
                      initialPrice: item.priceFrom !== null && item.priceFrom !== undefined ? String(item.priceFrom) : "",
                      initialImage: item.imageUrl,
                    },
                  });
                }}
              >
                <View style={styles.imageCard}>
                  <CachedImage source={{ uri: item.imageUrl }} style={styles.cardImage} contentFit="cover" />
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDelete(item.id, item.name);
                    }}
                    disabled={deletingId === item.id}
                    style={({ pressed }) => [styles.deleteBtn, { opacity: pressed ? 0.7 : 1 }]}
                  >
                    {deletingId === item.id ? (
                      <ActivityIndicator size="small" color="#D32F2F" />
                    ) : (
                      <Trash2 size={16} color="#D32F2F" />
                    )}
                  </Pressable>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.cardPrice}>
                    {formatMoney(item.priceFrom)}
                  </Text>
                  <Text style={{ fontSize: 12, color: "#746765", marginTop: 4 }}>{item.fulfillmentType === "ready_to_wear" ? "Ready for pickup" : "Custom fit"}</Text>
                </View>
              </Pressable>
            ))}
            {nextPage ? (
              <Pressable onPress={() => void loadMoreCatalog()} disabled={loadingMore} style={styles.emptyActionBtn}>
                {loadingMore ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.emptyActionBtnText}>Load more</Text>
                )}
              </Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: SCREEN_TOP_SPACING,
    marginBottom: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(74, 8, 12, 0.25)",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  headerTitle: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 24,
    lineHeight: 28,
    color: "#2B2B2B",
    letterSpacing: -0.2,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 40,
  },
  subtext: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 14,
    color: "#2B2B2B",
    marginBottom: 20,
    lineHeight: 20,
  },
  loadingWrap: {
    paddingVertical: 60,
    alignItems: "center",
  },
  emptyWrap: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F0EBE1",
    marginTop: 10,
  },
  emptyTitle: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 18,
    color: "#2B2B2B",
    marginBottom: 6,
  },
  emptySub: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 13,
    color: "#2B2B2B",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 18,
  },
  emptyActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F96951",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyActionBtnText: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 14,
    color: "#FFFFFF",
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 14,
  },
  productCard: {
    width: "48%",
    marginBottom: 16,
  },
  imageCard: {
    width: "100%",
    height: 210,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#F4EFE6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  cardInfo: {
    paddingTop: 8,
    paddingHorizontal: 2,
  },
  cardName: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 14,
    color: "#2B2B2B",
    lineHeight: 18,
  },
  cardPrice: {
    fontFamily: "InstrumentSans-Bold",
    fontSize: 13,
    color: "#2B2B2B",
    marginTop: 2,
  },
  deleteBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
});

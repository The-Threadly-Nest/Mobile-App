import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowLeft, Plus, Trash2, Tag } from "lucide-react-native";
import { apiFetch } from "@/shared/utils/apiClient";

export interface CatalogItem {
  id: string;
  name: string;
  priceFrom: number;
  imageUrl: string;
  createdAt?: string;
}

export default function AdminCatalogListScreen() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchCatalog = async () => {
    try {
      const data = await apiFetch<CatalogItem[]>("/api/catalog", { silent: true }).catch(() => []);
      if (Array.isArray(data)) {
        setItems(data);
      }
    } catch (err) {
      console.log("Error loading catalog items:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCatalog();
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      "Delete Garment",
      `Are you sure you want to remove "${name}" from your catalog?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeletingId(id);
            try {
              await apiFetch(`/api/catalog/${id}`, { method: "DELETE" });
              setItems((prev) => prev.filter((item) => item.id !== id));
            } catch (err: any) {
              Alert.alert("Delete Failed", err.message || "Could not delete garment.");
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const formatMoney = (val: number) => {
    return `₦${val.toLocaleString()}`;
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <ArrowLeft size={20} color="#3B0508" />
          </Pressable>
          <Text style={styles.headerTitle}>Garment Catalog</Text>
        </View>

        <Pressable
          onPress={() => router.push("/(admin)/catalog/new")}
          style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.8 : 1 }]}
        >
          <Plus size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={styles.addBtnText}>Add Clothes</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4A080C" />}
      >
        <Text style={styles.subtext}>
          Upload clothes photos and starting prices to showcase your atelier portfolio to clients.
        </Text>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#4A080C" size="large" />
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
              <View key={item.id} style={styles.card}>
                <Image source={{ uri: item.imageUrl }} style={styles.cardImage} resizeMode="cover" />
                <View style={styles.cardBody}>
                  <Text style={styles.cardName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.cardPrice}>
                    From {formatMoney(item.priceFrom)}
                  </Text>
                </View>

                <Pressable
                  onPress={() => handleDelete(item.id, item.name)}
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
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FBF7EF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(74, 8, 12, 0.08)",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "rgba(74, 8, 12, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headerTitle: {
    fontFamily: "WorkSans_500Medium",
    fontSize: 20,
    color: "#3B0508",
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4A080C",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  subtext: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 14,
    color: "#8A7550",
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
    fontFamily: "Fraunces-Bold",
    fontSize: 18,
    color: "#3B0508",
    marginBottom: 6,
  },
  emptySub: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 13,
    color: "#8A7550",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 18,
  },
  emptyActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4A080C",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyActionBtnText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 14,
    color: "#FFFFFF",
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 14,
  },
  card: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F0EBE1",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardImage: {
    width: "100%",
    height: 160,
    backgroundColor: "#F4EFE6",
  },
  cardBody: {
    padding: 12,
  },
  cardName: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 14,
    color: "#3B0508",
    marginBottom: 4,
  },
  cardPrice: {
    fontFamily: "WorkSans_500Medium",
    fontSize: 13,
    color: "#C4A763",
  },
  deleteBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
});

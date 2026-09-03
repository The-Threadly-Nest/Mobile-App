import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  Modal,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { ArrowLeft, CheckCircle2 } from "lucide-react-native";
import { SvgUri } from "react-native-svg";
import { Input } from "@/shared/components/Input";
import { Button } from "@/shared/components/Button";
import { useAuthStore } from "@/stores/useAuthStore";
import { API_BASE_URL } from "@/api/config";
import { useAppAlert } from "@/shared/hooks/useAppAlert";

// High-resolution local sketch assets map for 100% crisp native rendering
const LOCAL_SKETCHES: Record<string, any> = {
  sk1: require("../../assets/sketches/sketch-1.png"),
  sk2: require("../../assets/sketches/sketch-2.png"),
  sk3: require("../../assets/sketches/sketch-3.png"),
  sk4: require("../../assets/sketches/sketch-4.png"),
  sk5: require("../../assets/sketches/sketch-5.png"),
  sk6: require("../../assets/sketches/sketch-6.png"),
  sk7: require("../../assets/sketches/sketch-7.png"),
  sk8: require("../../assets/sketches/sketch-8.png"),
  sk9: require("../../assets/sketches/sketch-9.png"),
};

export default function AdminSketchDetailScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { showAlert } = useAppAlert();
  const token = useAuthStore((s) => s.token);

  const params = useLocalSearchParams<{
    id: string;
    title?: string;
    imageUrl?: string;
    authorName?: string;
    createdAt?: string;
    promotedToCatalog?: string;
  }>();

  const [isPromoted, setIsPromoted] = useState(params.promotedToCatalog === "true");
  const [modalVisible, setModalVisible] = useState(false);
  const [customName, setCustomName] = useState(params.title || "Fashion Sketch");
  const [priceFrom, setPriceFrom] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const authorText = `${params.authorName || "Tailor"} · ${params.createdAt || "Aug 12, 2026"}`;

  // Prioritize native local asset for maximum resolution; fallback to remote URL
  const imageSource =
    params.id && LOCAL_SKETCHES[params.id]
      ? LOCAL_SKETCHES[params.id]
      : params.imageUrl
      ? { uri: params.imageUrl }
      : null;

  const handlePromoteToCatalog = async () => {
    setLoading(true);
    setError("");

    try {
      const numPrice = priceFrom ? parseInt(priceFrom, 10) : 0;
      if (isNaN(numPrice) || numPrice < 0) {
        setError("Please enter a valid price.");
        setLoading(false);
        return;
      }

      if (params.id && !params.id.startsWith("sk")) {
        const res = await fetch(`${API_BASE_URL}/api/moodboard/${params.id}/promote`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            priceFrom: numPrice,
            name: customName.trim(),
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "Failed to promote sketch.");
        }
      }

      setIsPromoted(true);
      setModalVisible(false);
      showAlert("Promoted!", `"${customName}" is now featured on your Discover profile catalog.`);
    } catch (e: any) {
      setError(e.message ?? "Could not promote sketch.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isLandscape && styles.landscapeContainer,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <ArrowLeft size={20} color="#000000" />
          </Pressable>
          <Text style={styles.headerTitle}>Sketch Detail</Text>
        </View>

        {/* Artwork Image Container — No cream background */}
        <View style={styles.imageCard}>
          {imageSource ? (
            typeof imageSource === "object" && imageSource?.uri && imageSource.uri.includes(".svg") ? (
              <SvgUri uri={imageSource.uri} width="100%" height="100%" />
            ) : (
              <Image source={imageSource} style={styles.artworkImage} resizeMode="cover" />
            )
          ) : null}

          {/* Floating Author Pill Badge */}
          <View style={styles.authorBadge}>
            <Text style={styles.authorBadgeText}>{authorText}</Text>
          </View>
        </View>

        {/* Status Subtext */}
        <Text style={styles.statusSubtext}>
          {isPromoted
            ? "Promoted to public catalog — visible to customers on your Discover profile."
            : "Private sketch — not visible to customers until promoted."}
        </Text>

        {/* Primary Action Button */}
        {isPromoted ? (
          <View style={styles.promotedBanner}>
            <CheckCircle2 size={18} color="#FFFFFF" />
            <Text style={styles.promotedBannerText}>Featured in Public Catalog</Text>
          </View>
        ) : (
          <Pressable
            onPress={() => setModalVisible(true)}
            style={({ pressed }) => [
              styles.promoteBtn,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.promoteBtnText}>Promote to Public Catalog</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* Promotion Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Promote to Catalog</Text>
            <Text style={styles.modalSub}>
              Set starting price and display name for this piece.
            </Text>

            <View style={{ gap: 12, marginVertical: 16 }}>
              <Input
                label="Item Display Name"
                value={customName}
                onChangeText={setCustomName}
                placeholder="e.g. Ankara Vest & Wide-Leg Set"
              />
              <Input
                label="Starting Price (NGN)"
                value={priceFrom}
                onChangeText={setPriceFrom}
                keyboardType="numeric"
                placeholder="e.g. 75000"
              />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <Button
                label="Cancel"
                variant="secondary"
                onPress={() => setModalVisible(false)}
                style={{ flex: 1 }}
              />
              <Button
                label={loading ? "Promoting..." : "Promote Now"}
                onPress={handlePromoteToCatalog}
                loading={loading}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FBF7EF",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  landscapeContainer: {
    maxWidth: 580,
    alignSelf: "center",
    width: "100%",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 24,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.15)",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: "Fraunces-Bold",
    fontSize: 26,
    color: "#000000",
  },
  imageCard: {
    width: "100%",
    aspectRatio: 0.82,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "transparent",
    position: "relative",
    marginBottom: 16,
  },
  artworkImage: {
    width: "100%",
    height: "100%",
    borderRadius: 24,
  },
  authorBadge: {
    position: "absolute",
    bottom: 14,
    left: 14,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  authorBadgeText: {
    fontFamily: "WorkSans_500Medium",
    fontSize: 12.5,
    color: "#FFFFFF",
  },
  statusSubtext: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 14,
    lineHeight: 20,
    color: "#404040",
    marginBottom: 28,
    paddingHorizontal: 2,
  },
  promoteBtn: {
    width: "100%",
    height: 56,
    borderRadius: 28,
    backgroundColor: "#4A080C",
    alignItems: "center",
    justifyContent: "center",
  },
  promoteBtnText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  promotedBanner: {
    width: "100%",
    height: 56,
    borderRadius: 28,
    backgroundColor: "#43A047",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  promotedBannerText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#FBF7EF",
    borderRadius: 24,
    padding: 20,
  },
  modalTitle: {
    fontFamily: "Fraunces-Bold",
    fontSize: 20,
    color: "#4A080C",
    marginBottom: 4,
  },
  modalSub: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 13,
    color: "#8A7550",
  },
  errorText: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 12,
    color: "#D32F2F",
    marginBottom: 8,
  },
});

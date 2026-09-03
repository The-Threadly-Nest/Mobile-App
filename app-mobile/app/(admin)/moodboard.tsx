import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  ScrollView,
  Pressable,
  Text,
  Image,
  ActivityIndicator,
  Modal,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import Svg, { SvgUri } from "react-native-svg";
import { ArrowLeft, Paintbrush, Sparkles, CheckCircle2 } from "lucide-react-native";
import { Input } from "@/shared/components/Input";
import { Button } from "@/shared/components/Button";
import { useAuthStore } from "@/stores/useAuthStore";
import { API_BASE_URL } from "@/api/config";
import { useAppAlert } from "@/shared/hooks/useAppAlert";

interface SketchItem {
  id: string;
  title: string;
  image: any; // ImageSourcePropType or string URI
  isRemote?: boolean;
  promotedToCatalog?: boolean;
}

interface TailorSection {
  id: string;
  name: string;
  initial: string;
  sketches: SketchItem[];
}

const DEFAULT_TAILORS: TailorSection[] = [
  {
    id: "s1",
    name: "Ngozi Umeh",
    initial: "N",
    sketches: [
      { id: "sk1", title: "Ankara Vest & Wide-Leg Pants", image: require("../../assets/sketches/sketch-1.png") },
      { id: "sk2", title: "Folklore Corset & Trousers", image: require("../../assets/sketches/sketch-2.png") },
      { id: "sk3", title: "Burgundy Leather & Distressed Denim", image: require("../../assets/sketches/sketch-3.png") },
    ],
  },
  {
    id: "s2",
    name: "Tunde Bakare",
    initial: "T",
    sketches: [
      { id: "sk4", title: "Denim Balloon-Sleeve Wrap Dress", image: require("../../assets/sketches/sketch-4.png") },
      { id: "sk5", title: "Structured Patchwork Denim Blazer", image: require("../../assets/sketches/sketch-5.png") },
      { id: "sk6", title: "Linen Blend Resort Set", image: require("../../assets/sketches/sketch-6.png") },
    ],
  },
  {
    id: "s3",
    name: "Funmilayo Adeyemi",
    initial: "F",
    sketches: [
      { id: "sk7", title: "Puff-Sleeve Belted Midi Dress", image: require("../../assets/sketches/sketch-7.png") },
      { id: "sk8", title: "Backless Gown & Wide-Brim Hat", image: require("../../assets/sketches/sketch-8.png") },
      { id: "sk9", title: "Off-the-Shoulder Turtleneck Gown", image: require("../../assets/sketches/sketch-9.png") },
    ],
  },
];

export default function AdminMoodBoardRedesignScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { showAlert } = useAppAlert();
  const token = useAuthStore((s) => s.token);

  const [tailorSections, setTailorSections] = useState<TailorSection[]>(DEFAULT_TAILORS);
  const [loading, setLoading] = useState(false);

  // Promote Modal state
  const [selectedSketch, setSelectedSketch] = useState<SketchItem | null>(null);
  const [priceFrom, setPriceFrom] = useState("");
  const [customName, setCustomName] = useState("");
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const fetchStaffMoodboards = async () => {
    if (!token) return;
    setLoading(true);
    try {
      // 1. Keep the original tailor sections at the top
      const sections: TailorSection[] = DEFAULT_TAILORS.map((t) => ({
        ...t,
        sketches: [...t.sketches],
      }));

      // 2. Fetch remote staff sketches and merge/append them
      const staffRes = await fetch(`${API_BASE_URL}/api/staff`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const staffList = await staffRes.json();

      if (staffRes.ok && Array.isArray(staffList) && staffList.length > 0) {
        for (const st of staffList) {
          const res = await fetch(`${API_BASE_URL}/api/moodboard/staff/${st.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const remoteSketches = res.ok ? await res.json() : [];

          if (Array.isArray(remoteSketches) && remoteSketches.length > 0) {
            const displayName = st.name || st.email?.split("@")[0] || "Tailor";
            const initial = (st.name || st.email || "T").charAt(0).toUpperCase();
            const remoteItems: SketchItem[] = remoteSketches.map((sk: any) => ({
              id: sk.id,
              title: sk.title,
              image: { uri: sk.imageUrl },
              isRemote: true,
              promotedToCatalog: sk.promotedToCatalog,
            }));

            // Check if matching an existing default tailor card
            const matchIndex = sections.findIndex(
              (t) => t.name.toLowerCase() === displayName.toLowerCase()
            );

            if (matchIndex !== -1) {
              sections[matchIndex].sketches = [...remoteItems, ...sections[matchIndex].sketches];
            } else {
              sections.push({
                id: st.id,
                name: displayName,
                initial,
                sketches: remoteItems,
              });
            }
          }
        }
      }

      // 3. Fetch Admin's own drawings (Studio Sketches) and display them BELOW
      const ownRes = await fetch(`${API_BASE_URL}/api/moodboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const ownSketches = ownRes.ok ? await ownRes.json() : [];

      if (Array.isArray(ownSketches) && ownSketches.length > 0) {
        sections.push({
          id: "admin-drawings",
          name: "Studio Sketches",
          initial: "S",
          sketches: ownSketches.map((sk: any) => ({
            id: sk.id,
            title: sk.title,
            image: { uri: sk.imageUrl },
            isRemote: true,
            promotedToCatalog: sk.promotedToCatalog,
          })),
        });
      }

      setTailorSections(sections);
    } catch (e) {
      console.warn("Using default tailor moodboards", e);
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch automatically every time the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchStaffMoodboards();
    }, [token])
  );

  const handlePromoteToCatalog = async () => {
    if (!selectedSketch) return;
    setPromotingId(selectedSketch.id);
    setError("");

    try {
      const numPrice = priceFrom ? parseInt(priceFrom, 10) : 0;
      if (isNaN(numPrice) || numPrice < 0) {
        setError("Please enter a valid price.");
        setPromotingId(null);
        return;
      }

      if (selectedSketch.isRemote) {
        const res = await fetch(`${API_BASE_URL}/api/moodboard/${selectedSketch.id}/promote`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            priceFrom: numPrice,
            name: customName.trim() || selectedSketch.title,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "Failed to promote sketch.");
        }
      }

      // Update promoted status locally
      setTailorSections((prev) =>
        prev.map((t) => ({
          ...t,
          sketches: t.sketches.map((s) =>
            s.id === selectedSketch.id ? { ...s, promotedToCatalog: true } : s
          ),
        }))
      );

      showAlert("Promoted!", `"${customName || selectedSketch.title}" is now featured in your Discover profile catalog.`);
      setSelectedSketch(null);
    } catch (e: any) {
      setError(e.message ?? "Could not promote sketch.");
    } finally {
      setPromotingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isLandscape && styles.landscapeContainer,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Bar */}
        <View style={styles.headerBar}>
          <View style={styles.headerLeft}>
            <Pressable
              onPress={() => router.push("/(admin)/settings" as any)}
              style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <ArrowLeft size={20} color="#000000" />
            </Pressable>
            <Text style={styles.headerTitle}>Moodboards</Text>
          </View>

          {/* Draw Button at top right (navigates to dedicated drawing page) */}
          <Pressable
            onPress={() => router.push("/(admin)/draw")}
            style={({ pressed }) => [styles.drawBtn, { opacity: pressed ? 0.85 : 1 }]}
          >
            <Paintbrush size={14} color="#FFFFFF" />
            <Text style={styles.drawBtnText}>Draw</Text>
          </Pressable>
        </View>

        {/* Intro Subtext Paragraph */}
        <Text style={styles.introSubtext}>
          Private sketches from each tailor. Promote a piece to the public portfolio to feature it on your Discover profile.
        </Text>

        {/* Tailor Sections */}
        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#4A080C" />
          </View>
        ) : (
          <View style={{ gap: 28 }}>
            {tailorSections.map((tailor) => (
              <View key={tailor.id} style={styles.tailorSection}>
                {/* Tailor Avatar & Name */}
                <View style={styles.tailorHeaderRow}>
                  <View style={styles.tailorAvatar}>
                    <Text style={styles.avatarText}>{tailor.initial}</Text>
                  </View>
                  <Text style={styles.tailorName}>{tailor.name}</Text>
                </View>

                {/* 3-Column Sketch Grid */}
                <View style={styles.sketchGrid}>
                  {tailor.sketches.slice(0, 3).map((sketch) => (
                    <Pressable
                      key={sketch.id}
                      onPress={() => {
                        const imageUri = (sketch.image as any)?.uri
                          ? (sketch.image as any).uri
                          : Image.resolveAssetSource(sketch.image)?.uri;

                        router.push({
                          pathname: "/(admin)/sketch-detail",
                          params: {
                            id: sketch.id,
                            title: sketch.title,
                            imageUrl: imageUri,
                            authorName: tailor.name,
                            createdAt: "Aug 12, 2026",
                            promotedToCatalog: sketch.promotedToCatalog ? "true" : "false",
                          },
                        });
                      }}
                      style={({ pressed }) => [
                        styles.sketchCard,
                        { opacity: pressed ? 0.85 : 1 },
                      ]}
                    >
                      {typeof sketch.image === "object" && sketch.image?.uri && sketch.image.uri.includes(".svg") ? (
                        <SvgUri uri={sketch.image.uri} width="100%" height="100%" />
                      ) : (
                        <Image source={sketch.image} style={styles.sketchImage} />
                      )}
                      {sketch.promotedToCatalog && (
                        <View style={styles.promotedBadge}>
                          <CheckCircle2 size={12} color="#FFFFFF" />
                        </View>
                      )}
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Promote to Catalog Modal */}
      <Modal visible={!!selectedSketch} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Feature on Discover Profile</Text>
            <Text style={styles.modalSub}>
              Promote "{selectedSketch?.title}" into your store catalog so clients can discover & book it.
            </Text>

            <View style={{ gap: 12, marginVertical: 16 }}>
              <Input
                label="Item Display Name"
                value={customName}
                onChangeText={setCustomName}
                placeholder="e.g. Ankara Vest & Wide-Leg Pants"
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
                onPress={() => setSelectedSketch(null)}
                style={{ flex: 1 }}
              />
              <Button
                label={promotingId ? "Promoting..." : "Promote Now"}
                onPress={handlePromoteToCatalog}
                loading={!!promotingId}
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
    maxWidth: 720,
    alignSelf: "center",
    width: "100%",
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
  drawBtn: {
    height: 38,
    borderRadius: 19,
    backgroundColor: "#4A080C",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  drawBtnText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 14,
    color: "#FFFFFF",
  },
  introSubtext: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 14,
    lineHeight: 20,
    color: "#404040",
    marginBottom: 28,
  },
  loaderContainer: {
    paddingVertical: 60,
    alignItems: "center",
  },
  tailorSection: {
    gap: 14,
  },
  tailorHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  tailorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#5C1518",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: "Fraunces-Bold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  tailorName: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#000000",
  },
  sketchGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  sketchCard: {
    width: "31.2%",
    aspectRatio: 0.95,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "transparent",
    position: "relative",
  },
  sketchImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  promotedBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#43A047",
    alignItems: "center",
    justifyContent: "center",
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

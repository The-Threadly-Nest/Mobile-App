import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
  Modal,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Plus, PenTool, Trash2, CheckCircle2, Paintbrush, X } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { Input } from "@/shared/components/Input";
import { Button } from "@/shared/components/Button";
import DrawingCanvasModal from "@/shared/components/DrawingCanvasModal";
import { useAuthStore } from "@/stores/useAuthStore";
import { uploadFile } from "@/shared/utils/upload";
import { API_BASE_URL } from "@/api/config";
import { useAppAlert } from "@/shared/hooks/useAppAlert";

interface Sketch {
  id: string;
  title: string;
  imageUrl: string;
  promotedToCatalog?: boolean;
  createdAt: string;
}

export default function StaffMoodBoardScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { showAlert, showConfirm } = useAppAlert();

  const [sketches, setSketches] = useState<Sketch[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [canvasModalVisible, setCanvasModalVisible] = useState(false);
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");

  const token = useAuthStore((s) => s.token);

  const fetchSketches = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/moodboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setSketches(data);
      }
    } catch (e) {
      console.error("Failed to fetch staff sketches", e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      fetchSketches();
    }, [fetchSketches])
  );

  const handlePickImage = async () => {
    setError("");
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showAlert("Permission Required", "Permission to access camera roll is required.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setSelectedUri(asset.uri);
      setTitle("");
      setModalVisible(true);
    }
  };

  const handleSaveDrawing = async (svgDataUri: string, drawingTitle: string) => {
    try {
      const filename = `drawing-${Date.now()}.svg`;
      const contentType = "image/svg+xml";

      const uploadResult = await uploadFile(svgDataUri, filename, contentType);

      const res = await fetch(`${API_BASE_URL}/api/moodboard`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: drawingTitle,
          imageUrl: uploadResult.fileUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to save drawing to database.");
      }

      setSketches((prev) => [data, ...prev]);
    } catch (e: any) {
      showAlert("Save Failed", e.message ?? "Could not save drawing.");
    }
  };

  const handleUploadSketch = async () => {
    if (!selectedUri || !title.trim()) {
      setError("Please provide a title for your sketch.");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const filename = selectedUri.split("/").pop() || "sketch.jpg";
      let ext = filename.split(".").pop()?.toLowerCase() || "jpg";
      if (ext === "jpeg") ext = "jpg";
      const contentType = `image/${ext === "png" ? "png" : ext === "gif" ? "gif" : "jpeg"}`;

      const uploadResult = await uploadFile(selectedUri, filename, contentType);

      const res = await fetch(`${API_BASE_URL}/api/moodboard`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          imageUrl: uploadResult.fileUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to save sketch to database.");
      }

      setSketches((prev) => [data, ...prev]);
      setModalVisible(false);
      setSelectedUri(null);
      setTitle("");
    } catch (e: any) {
      setError(e.message ?? "Something went wrong during upload.");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteSketch = (id: string, itemTitle: string) => {
    showConfirm(
      "Delete Sketch",
      `Are you sure you want to delete "${itemTitle}"?`,
      {
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        onConfirm: async () => {
          try {
            const res = await fetch(`${API_BASE_URL}/api/moodboard/${id}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              setSketches((prev) => prev.filter((s) => s.id !== id));
            } else {
              const data = await res.json();
              showAlert("Delete Failed", data.error ?? "Could not delete sketch.");
            }
          } catch (e) {
            console.error("Failed to delete sketch", e);
          }
        },
      }
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={[styles.container, isLandscape && styles.landscapeContainer]}>
        {/* Header Bar */}
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>My Mood Board</Text>

          {/* Action Buttons */}
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => router.push("/(staff)/draw")}
              style={({ pressed }) => [styles.drawBtn, { opacity: pressed ? 0.85 : 1 }]}
            >
              <Paintbrush size={14} color="#FFFFFF" />
              <Text style={styles.drawBtnText}>Draw</Text>
            </Pressable>

            <Pressable
              onPress={handlePickImage}
              style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.85 : 1 }]}
            >
              <Plus size={20} color="#FFFFFF" strokeWidth={2.5} />
            </Pressable>
          </View>
        </View>

        {/* Intro Subtext */}
        <Text style={styles.introSubtext}>
          Your private sketches. Admin can review & feature your creations on the Discover profile.
        </Text>

        {/* Grid List of Sketches */}
        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#4A080C" />
          </View>
        ) : (
          <FlatList
            data={sketches}
            keyExtractor={(item) => item.id}
            numColumns={2}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            columnWrapperStyle={styles.columnWrapper}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <PenTool size={28} color="#4A080C" />
                </View>
                <Text style={styles.emptyTitle}>No sketches yet</Text>
                <Text style={styles.emptySubtext}>
                  Tap "Draw" to paint a new design or "+" to upload a sketch photo from your device.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Image source={{ uri: item.imageUrl }} style={styles.sketchImage} />

                {/* Promoted Badge */}
                {item.promotedToCatalog && (
                  <View style={styles.promotedBadge}>
                    <CheckCircle2 size={12} color="#FFFFFF" />
                    <Text style={styles.promotedText}>Promoted</Text>
                  </View>
                )}

                {/* Delete Action Button */}
                <Pressable
                  onPress={() => handleDeleteSketch(item.id, item.title)}
                  style={({ pressed }) => [styles.deleteBtn, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Trash2 size={13} color="#FFFFFF" />
                </Pressable>

                {/* Card Title Footer */}
                <View style={styles.cardFooter}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                </View>
              </View>
            )}
          />
        )}
      </View>

      {/* Photo Upload Preview Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Mood Board Sketch</Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <X size={20} color="#4A080C" />
              </Pressable>
            </View>

            {selectedUri && (
              <View style={styles.previewImageWrapper}>
                <Image source={{ uri: selectedUri }} style={styles.previewImage} />
              </View>
            )}

            <Input
              placeholder="Sketch Title (e.g. Draped Corset Gown)"
              value={title}
              onChangeText={setTitle}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={{ marginTop: 16 }}>
              <Button
                label={uploading ? "Uploading..." : "Save to Mood Board"}
                onPress={handleUploadSketch}
                loading={uploading}
                disabled={!title.trim() || uploading}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Interactive Sketchpad Canvas Modal */}
      <DrawingCanvasModal
        visible={canvasModalVisible}
        onClose={() => setCanvasModalVisible(false)}
        onSave={handleSaveDrawing}
      />
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
    paddingHorizontal: 20,
    paddingTop: 16,
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
    marginBottom: 8,
  },
  headerTitle: {
    fontFamily: "Fraunces-Bold",
    fontSize: 26,
    color: "#4A080C",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#4A080C",
    alignItems: "center",
    justifyContent: "center",
  },
  introSubtext: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 14,
    lineHeight: 20,
    color: "#8A7550",
    marginBottom: 20,
  },
  loaderContainer: {
    paddingVertical: 60,
    alignItems: "center",
  },
  listContent: {
    paddingBottom: 40,
  },
  columnWrapper: {
    gap: 12,
    marginBottom: 14,
  },
  card: {
    flex: 1,
    aspectRatio: 0.95,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(228, 213, 183, 0.5)",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  sketchImage: {
    width: "100%",
    height: "78%",
    resizeMode: "cover",
  },
  promotedBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "#43A047",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  promotedText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 10,
    color: "#FFFFFF",
  },
  deleteBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardFooter: {
    height: "22%",
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  cardTitle: {
    fontFamily: "WorkSans_500Medium",
    fontSize: 13,
    color: "#3A2E1A",
    textAlign: "center",
  },
  emptyContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    borderWidth: 1,
    borderColor: "rgba(228, 213, 183, 0.5)",
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FBF7EF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: "Fraunces-Bold",
    fontSize: 18,
    color: "#4A080C",
    marginBottom: 4,
  },
  emptySubtext: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 13,
    lineHeight: 18,
    color: "#8A7550",
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FBF7EF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: "Fraunces-Bold",
    fontSize: 20,
    color: "#4A080C",
  },
  previewImageWrapper: {
    alignItems: "center",
    marginBottom: 16,
  },
  previewImage: {
    width: 140,
    height: 140,
    borderRadius: 16,
  },
  errorText: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 12,
    color: "#D32F2F",
    marginTop: 6,
  },
});

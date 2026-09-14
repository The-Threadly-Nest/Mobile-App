import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Camera, UploadCloud, Tag, Trash2 } from "lucide-react-native";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import CachedImage from "@/shared/components/CachedImage";
import { apiFetch } from "@/shared/utils/apiClient";
import { uploadFile } from "@/shared/utils/upload";
import { useAppAlert } from "@/shared/hooks/useAppAlert";

export default function AdminEditGarmentScreen() {
  const insets = useSafeAreaInsets();
  const { id, initialName, initialPrice, initialImage } = useLocalSearchParams<{
    id: string;
    initialName?: string;
    initialPrice?: string;
    initialImage?: string;
  }>();

  const { showAlert, showConfirm } = useAppAlert();
  const [name, setName] = useState(initialName || "");
  const [priceFrom, setPriceFrom] = useState(initialPrice ? String(initialPrice) : "");
  const [imageUrl, setImageUrl] = useState<string>(initialImage || "");
  const [loading, setLoading] = useState(!initialName);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadItem() {
      if (!id) return;
      try {
        const item = await apiFetch<any>(`/api/catalog/item/${id}`, { silent: true });
        if (item) {
          if (item.name) setName(item.name);
          if (item.priceFrom !== undefined && item.priceFrom !== null) {
            setPriceFrom(String(item.priceFrom));
          }
          if (item.imageUrl) setImageUrl(item.imageUrl);
        }
      } catch (err) {
        console.warn("Could not fetch catalog item detail:", err);
      } finally {
        setLoading(false);
      }
    }
    loadItem();
  }, [id]);

  const handlePickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showAlert("Permission Required", "Permission to access photo library is required.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        setUploadingImage(true);
        setError("");

        const filename = asset.fileName || `garment_${Date.now()}.jpg`;
        const contentType = asset.mimeType || "image/jpeg";

        const uploaded = await uploadFile(asset.uri, filename, contentType);
        setImageUrl(uploaded.fileUrl);
      }
    } catch (err: any) {
      showAlert("Upload Error", err.message || "Failed to upload image.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleUpdate = async () => {
    setError("");

    if (!imageUrl) {
      setError("Please upload a photo of the garment.");
      return;
    }
    if (!name.trim()) {
      setError("Please enter a garment name or title.");
      return;
    }

    let parsedPrice: number | null = null;
    if (priceFrom.trim()) {
      const num = parseFloat(priceFrom.replace(/[^\d.]/g, ""));
      if (!isNaN(num) && num > 0) {
        parsedPrice = Math.round(num);
      }
    }

    setSaving(true);
    try {
      await apiFetch(`/api/catalog/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
          priceFrom: parsedPrice,
          imageUrl,
        }),
      });

      showAlert("Updated", "Garment details updated successfully!");
      setTimeout(() => router.replace("/(admin)/catalog" as any), 1000);
    } catch (err: any) {
      setError(err.message || "Could not update garment. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    showConfirm(
      "Delete Garment",
      `Are you sure you want to remove "${name || "this item"}" from your catalog?`,
      {
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        onConfirm: async () => {
          setDeleting(true);
          try {
            await apiFetch(`/api/catalog/${id}`, { method: "DELETE" });
            showAlert("Deleted", "Garment removed from catalog.");
            setTimeout(() => router.replace("/(admin)/catalog" as any), 1000);
          } catch (err: any) {
            showAlert("Delete Failed", err.message || "Could not delete garment.");
          } finally {
            setDeleting(false);
          }
        },
      }
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Pressable
              onPress={() => router.push("/(admin)/catalog" as any)}
              style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <BackArrowIcon size={20} color="#3B0508" />
            </Pressable>
            <Text style={styles.headerTitle}>Edit Garment</Text>
          </View>

          <Pressable
            onPress={handleDelete}
            disabled={deleting}
            style={({ pressed }) => [styles.deleteHeaderBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            {deleting ? (
              <ActivityIndicator size="small" color="#D32F2F" />
            ) : (
              <Trash2 size={20} color="#D32F2F" />
            )}
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loadingCenter}>
            <ActivityIndicator size="large" color="#4A080C" />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 + insets.bottom }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Garment Image Upload Box */}
            <Text style={styles.fieldLabel}>Garment Photo *</Text>
            <Pressable
              onPress={handlePickImage}
              disabled={uploadingImage}
              style={({ pressed }) => [
                styles.imagePickerBox,
                { opacity: pressed || uploadingImage ? 0.8 : 1 },
              ]}
            >
              {uploadingImage ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator color="#4A080C" size="small" />
                  <Text style={styles.loadingText}>Uploading photo...</Text>
                </View>
              ) : imageUrl ? (
                <View style={styles.previewBox}>
                  <CachedImage
                    source={{ uri: imageUrl }}
                    style={styles.previewImage}
                    contentFit="cover"
                    contentPosition="top center"
                  />
                  <View style={styles.changeBadge}>
                    <Camera size={14} color="#FFFFFF" />
                    <Text style={styles.changeBadgeText}>Change Photo</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.emptyPickerContent}>
                  <UploadCloud size={36} color="#4A080C" style={{ marginBottom: 6 }} />
                  <Text style={styles.pickerTitle}>Upload Garment Photo</Text>
                  <Text style={styles.pickerSub}>PNG or JPG up to 10MB</Text>
                </View>
              )}
            </Pressable>

            {/* Garment Name Input */}
            <Text style={styles.fieldLabel}>Garment Name / Style Title *</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Silk Corset Evening Gown"
              placeholderTextColor="#8A7550"
              style={styles.textInput}
            />

            {/* Price From Input */}
            <Text style={styles.fieldLabel}>Starting Price (₦) — Optional</Text>
            <TextInput
              value={priceFrom}
              onChangeText={setPriceFrom}
              placeholder="e.g. 150000 or leave blank for 'Price on request'"
              placeholderTextColor="#8A7550"
              keyboardType="numeric"
              style={styles.textInput}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </ScrollView>
        )}

        {/* Bottom Save Action Bar */}
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <Pressable
            onPress={handleUpdate}
            disabled={saving || uploadingImage || loading}
            style={({ pressed }) => [
              styles.submitBtn,
              { opacity: pressed || saving || uploadingImage || loading ? 0.85 : 1 },
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitBtnText}>Save Changes</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
  deleteHeaderBtn: {
    padding: 8,
  },
  loadingCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 36,
  },
  fieldLabel: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 14,
    color: "#3B0508",
    marginBottom: 8,
  },
  imagePickerBox: {
    width: "100%",
    height: 280,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#4A080C",
    borderStyle: "dashed",
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    marginBottom: 24,
  },
  emptyPickerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  pickerTitle: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 15,
    color: "#4A080C",
    marginBottom: 2,
  },
  pickerSub: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 12,
    color: "#8A7550",
  },
  loadingBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    fontFamily: "WorkSans_500Medium",
    fontSize: 13,
    color: "#4A080C",
  },
  previewBox: {
    width: "100%",
    height: "100%",
    position: "relative",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  changeBadge: {
    position: "absolute",
    bottom: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#4A080C",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  changeBadgeText: {
    fontFamily: "WorkSans_500Medium",
    fontSize: 12,
    color: "#FFFFFF",
  },
  textInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    fontFamily: "WorkSans_500Medium",
    fontSize: 15,
    color: "#3B0508",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    marginBottom: 24,
  },
  errorText: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 13,
    color: "#D32F2F",
    marginBottom: 16,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FBF7EF",
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  submitBtn: {
    height: 56,
    borderRadius: 28,
    backgroundColor: "#4A080C",
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnText: {
    fontFamily: "WorkSans_500Medium",
    fontSize: 20,
    color: "#FFFFFF",
  },
});

import React, { useState } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Camera, UploadCloud, Tag } from "lucide-react-native";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import { apiFetch } from "@/shared/utils/apiClient";
import { uploadFile } from "@/shared/utils/upload";
import { useAppAlert } from "@/shared/hooks/useAppAlert";

export default function AdminNewGarmentScreen() {
  const { showAlert, showConfirm } = useAppAlert();
  const [name, setName] = useState("");
  const [priceFrom, setPriceFrom] = useState("");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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

  const handleSubmit = async () => {
    setError("");

    if (!imageUrl) {
      setError("Please upload a photo of the garment.");
      return;
    }
    if (!name.trim()) {
      setError("Please enter a garment name or title.");
      return;
    }
    const parsedPrice = parseFloat(priceFrom.replace(/[^\d.]/g, ""));
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setError("Please enter a valid starting price.");
      return;
    }

    setSaving(true);
    try {
      await apiFetch("/api/catalog", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          priceFrom: parsedPrice,
          imageUrl,
        }),
      });

      showAlert("Success", "Garment added to your catalog successfully!");
      setTimeout(() => router.push("/(admin)/catalog" as any), 1400);
    } catch (err: any) {
      setError(err.message || "Could not save garment. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.push("/(admin)/catalog" as any)}
            style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <BackArrowIcon size={20} color="#3B0508" />
          </Pressable>
          <Text style={styles.headerTitle}>Add Clothes / Garment</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
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
                <Image source={{ uri: imageUrl }} style={styles.previewImage} resizeMode="cover" />
                <View style={styles.changeBadge}>
                  <Camera size={14} color="#FFFFFF" />
                  <Text style={styles.changeBadgeText}>Change Photo</Text>
                </View>
              </View>
            ) : (
              <View style={styles.placeholderBox}>
                <UploadCloud size={36} color="#4A080C" style={{ marginBottom: 6 }} />
                <Text style={styles.placeholderTitle}>Tap to upload clothes photo</Text>
                <Text style={styles.placeholderSub}>JPG, PNG up to 5MB</Text>
              </View>
            )}
          </Pressable>

          {/* Garment Name / Title */}
          <Text style={styles.fieldLabel}>Garment Name / Title *</Text>
          <TextInput
            value={name}
            onChangeText={(t) => {
              setName(t);
              if (error) setError("");
            }}
            placeholder="e.g. Bespoke Velvet Agbada Set"
            placeholderTextColor="#B0966C"
            style={styles.textInput}
          />

          {/* Starting Price */}
          <Text style={styles.fieldLabel}>Starting Price (₦) *</Text>
          <TextInput
            value={priceFrom}
            onChangeText={(t) => {
              setPriceFrom(t);
              if (error) setError("");
            }}
            placeholder="e.g. 750,000"
            placeholderTextColor="#B0966C"
            keyboardType="numeric"
            style={styles.textInput}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>

        {/* Pinned Bottom Action Button */}
        <View style={styles.bottomBar}>
          <Pressable
            onPress={handleSubmit}
            disabled={saving || uploadingImage}
            style={({ pressed }) => [
              styles.submitBtn,
              { opacity: pressed || saving || uploadingImage ? 0.85 : 1 },
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitBtnText}>Save to Catalog</Text>
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
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 100,
  },
  fieldLabel: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 14,
    color: "#4A080C",
    marginBottom: 8,
  },
  imagePickerBox: {
    height: 220,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "rgba(74, 8, 12, 0.2)",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    overflow: "hidden",
  },
  placeholderBox: {
    alignItems: "center",
  },
  placeholderTitle: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 14,
    color: "#3B0508",
    marginBottom: 2,
  },
  placeholderSub: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 12,
    color: "rgba(74, 8, 12, 0.6)",
  },
  loadingBox: {
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

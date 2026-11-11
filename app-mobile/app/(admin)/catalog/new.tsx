import { typeScale } from "@/shared/utils/typeScale";
import React, { useState } from "react";
import { View, Pressable, ScrollView, Image, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { Text, TextInput } from "@/shared/components/Typography";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Camera, Check, UploadCloud, X } from "lucide-react-native";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import { apiFetch } from "@/shared/utils/apiClient";
import { uploadFile } from "@/shared/utils/upload";
import { useAppAlert } from "@/shared/hooks/useAppAlert";
import { SCREEN_TOP_SPACING } from "@/shared/utils/screenSpacing";
import { CatalogOfferingFields } from "@/shared/components/CatalogOfferingFields";
import { catalogOptions, catalogPrice, type FulfillmentType } from "@/shared/utils/catalogCommerce";
import { KeyboardAwareScrollView } from "@/shared/components/KeyboardAwareScrollView";


export default function AdminNewGarmentScreen() {
  const insets = useSafeAreaInsets();
  const { showAlert } = useAppAlert();

  // Form states with humanized defaults / placeholders
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [details, setDetails] = useState("");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>("custom_fit");
  const [sizesText, setSizesText] = useState("");
  const [colorsText, setColorsText] = useState("");
  const [category, setCategory] = useState("");

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
        aspect: [1, 1],
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

  const handleReset = () => {
    setName("");
    setPrice("");
    setDetails("");
    setImageUrl("");
    setFulfillmentType("custom_fit"); setSizesText(""); setColorsText(""); setCategory("");
    setError("");
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(admin)/dashboard" as any);
    }
  };

  const handleSubmit = async () => {
    setError("");

    const garmentName = name.trim();
    const garmentImage = imageUrl.trim();
    if (garmentName.length < 2 || !garmentImage) { setError("Enter an item name and upload its photo."); return; }
    let parsedPrice: number | null;
    try { parsedPrice = catalogPrice(price); } catch (error) { setError((error as Error).message); return; }
    const sizes = catalogOptions(sizesText), colors = catalogOptions(colorsText);
    if (fulfillmentType === "ready_to_wear" && (!parsedPrice || !sizes.length)) { setError("Ready-for-pickup clothes need a price and available sizes."); return; }
    const garmentDetails = details.trim();

    setSaving(true);
    try {
      await apiFetch("/api/catalog", {
        method: "POST",
        body: JSON.stringify({
          name: garmentName,
          priceFrom: parsedPrice,
          imageUrl: garmentImage,
          description: garmentDetails,
          fulfillmentType, sizes, colors, category: category.trim() || null,
        }),
      });

      showAlert("Success", "Garment added to your catalog successfully!");
      setTimeout(() => {
        router.replace("/(admin)/dashboard" as any);
      }, 700);
    } catch (err: any) {
      setError(err.message || "Could not save garment. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Top Header matching Figma node 208:4499 */}
        <View style={styles.topHeader}>
          <View style={styles.headerLeft}>
            <Pressable
              onPress={handleBack}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={({ pressed }) => [styles.circularBackBtn, { opacity: pressed ? 0.75 : 1 }]}
            >
              <BackArrowIcon />
            </Pressable>

            <Text style={styles.headerTitle}>Add New Items</Text>
          </View>

          <Pressable
            onPress={handleReset}
            accessibilityRole="button"
            accessibilityLabel="Reset form"
            style={({ pressed }) => [styles.resetBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={styles.resetBtnText}>RESET</Text>
          </Pressable>
        </View>

        <KeyboardAwareScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 100 + Math.max(insets.bottom, 16) },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* 1. ITEM NAME field (Figma node 208:4495) */}
          <View style={styles.fieldSection}>
            <Text style={styles.fieldLabel}>ITEM NAME</Text>
            <View style={styles.inputContainer}>
              <TextInput
                value={name}
                onChangeText={(t) => {
                  setName(t);
                  if (error) setError("");
                }}
                placeholder="Aso Oke Gown"
                placeholderTextColor="#4A403B"
                style={styles.textInput}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* 2. UPLOAD PHOTO field (Figma node 208:4460) */}
          <View style={styles.fieldSection}>
            <Text style={styles.fieldLabel}>UPLOAD PHOTO</Text>
            <View style={styles.photoRow}>
              {/* Slot 1: Image Preview or Upload Slot */}
              {uploadingImage ? (
                <View style={[styles.photoCard, styles.loadingSlot]}>
                  <ActivityIndicator size="small" color="#F96951" />
                  <Text style={styles.uploadingText}>Uploading</Text>
                </View>
              ) : imageUrl ? (
                <View style={styles.photoPreviewCard}>
                  <Image source={{ uri: imageUrl }} style={styles.photoImage} resizeMode="cover" />
                  <Pressable
                    onPress={() => setImageUrl("")}
                    hitSlop={8}
                    style={styles.removePhotoBtn}
                  >
                    <X size={12} color="#FFFDF9" strokeWidth={2.5} />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={handlePickImage}
                  style={({ pressed }) => [styles.photoAddSlot, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Camera size={22} color="#F96951" />
                  <Text style={styles.addText}>Add</Text>
                </Pressable>
              )}

              {/* Slot 2: Dashed Add Slot */}
              <Pressable
                onPress={handlePickImage}
                style={({ pressed }) => [styles.photoAddSlot, { opacity: pressed ? 0.7 : 1 }]}
              >
                <UploadCloud size={20} color="#2B2B2B" />
                <Text style={styles.addText}>Add</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.fieldSection}>
            <Text style={styles.fieldLabel}>{fulfillmentType === "ready_to_wear" ? "PRICE" : "STARTING PRICE (OPTIONAL)"}</Text>
            <View style={styles.inputContainer}><TextInput value={price} onChangeText={setPrice} placeholder="Enter price" keyboardType="numeric" style={styles.textInput} /></View>
          </View>
          <CatalogOfferingFields type={fulfillmentType} onTypeChange={setFulfillmentType} sizes={sizesText} onSizesChange={setSizesText} colors={colorsText} onColorsChange={setColorsText} category={category} onCategoryChange={setCategory} disabled={saving} />

          {/* 4. DETAILS Multiline Text Area (Figma node 208:4456) */}
          <View style={styles.fieldSection}>
            <Text style={styles.fieldLabel}>DETAILS</Text>
            <View style={styles.detailsContainer}>
              <TextInput
                value={details}
                onChangeText={(t) => {
                  setDetails(t);
                  if (error) setError("");
                }}
                placeholder="Hand-woven aso oke, shaped into a gown that carries tradition with ease."
                placeholderTextColor="#4A403B"
                multiline
                numberOfLines={4}
                style={styles.detailsTextInput}
                textAlignVertical="top"
              />
            </View>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </KeyboardAwareScrollView>

        {/* Pinned Bottom Bar with Original App Rounded Pill Button */}
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Pressable
            onPress={handleSubmit}
            disabled={saving || uploadingImage}
            style={({ pressed }) => [
              styles.submitBtn,
              { opacity: pressed || saving || uploadingImage ? 0.85 : 1 },
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#FFFDF9" />
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
    backgroundColor: "#F9E8D3",
  },
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: SCREEN_TOP_SPACING,
    paddingBottom: 16,
    borderBottomWidth: 0,
    borderBottomColor: "#453332",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  circularBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(69, 51, 50, 0.25)",
    backgroundColor: "#F9E8D3",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    ...typeScale.pageTitle,
    color: "#4A403B",
    letterSpacing: -0.2,
  },
  resetBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  resetBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#F96951",
    letterSpacing: 0.5,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  fieldSection: {
    marginBottom: 24,
  },
  fieldLabel: {
    ...typeScale.label,
    color: "#4A403B",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  inputContainer: {
    backgroundColor: "#FFFDF9",
    borderWidth: 1,
    borderColor: "#453332",
    borderRadius: 10,
    height: 52,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  textInput: {
    fontSize: 14,
    color: "#4A403B",
    paddingVertical: 0,
  },
  photoRow: {
    flexDirection: "row",
    gap: 12,
  },
  photoCard: {
    width: 92,
    height: 92,
    borderRadius: 14,
  },
  photoPreviewCard: {
    width: 92,
    height: 92,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#FFFDF9",
  },
  photoImage: {
    width: "100%",
    height: "100%",
  },
  removePhotoBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(43, 43, 43, 0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingSlot: {
    backgroundColor: "#FFFDF9",
    borderWidth: 1,
    borderColor: "#453332",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  uploadingText: {
    fontSize: 10,
    color: "#4A403B",
  },
  photoAddSlot: {
    width: 92,
    height: 92,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#453332",
    borderStyle: "dashed",
    backgroundColor: "#F9E8D3",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  addText: {
    fontSize: 11,
    color: "#4A403B",
    fontWeight: "500",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  priceInputContainer: {
    width: 125,
    height: 50,
    backgroundColor: "#FFFDF9",
    borderWidth: 1,
    borderColor: "#453332",
    borderRadius: 10,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  priceTextInput: {
    fontSize: 14,
    color: "#4A403B",
    paddingVertical: 0,
  },
  checkboxOption: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 16,
    paddingVertical: 6,
  },
  checkboxBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#453332",
    backgroundColor: "#F9E8D3",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxBoxActive: {
    borderColor: "#F96951",
    backgroundColor: "#F96951",
  },
  checkboxLabel: {
    fontSize: 12,
    color: "#4A403B",
    marginLeft: 6,
    fontWeight: "500",
  },
  checkboxLabelActive: {
    color: "#4A403B",
  },
  detailsContainer: {
    backgroundColor: "#FFFDF9",
    borderWidth: 1,
    borderColor: "#453332",
    borderRadius: 10,
    minHeight: 110,
    padding: 14,
  },
  detailsTextInput: {
    fontSize: 13,
    lineHeight: 20,
    color: "#4A403B",
    paddingVertical: 0,
  },
  errorText: {
    fontSize: 13,
    color: "#F96951",
    marginBottom: 16,
    textAlign: "center",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#F9E8D3",
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  submitBtn: {
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F96951",
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnText: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 16,
    color: "#FFFDF9",
  },
});

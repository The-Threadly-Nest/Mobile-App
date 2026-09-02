import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check, Store, MapPin, Sparkles, Camera, UploadCloud, ArrowLeft } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { useAuthStore } from "@/stores/useAuthStore";
import { adminApi } from "@/shared/utils/apiClient";
import { uploadFile } from "@/shared/utils/upload";
import { PhoneInputWithCountry } from "@/shared/components/PhoneInputWithCountry";

const SPECIALIZATION_CATEGORIES = [
  "Bespoke Suits",
  "Agbada & Native",
  "Bridal & Evening Wear",
  "Kaftans & Casuals",
  "Aso-Ebi Production",
  "Corporate Tailoring",
  "Alterations & Fitting",
];

export default function AdminOnboardingScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [step, setStep] = useState<number>(1);
  const [shopName, setShopName] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [bio, setBio] = useState<string>("");
  const [brandLogoUrl, setBrandLogoUrl] = useState<string>("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["Bespoke Suits"]);
  const [currency, setCurrency] = useState<string>("NGN");

  const [loading, setLoading] = useState<boolean>(false);
  const [uploadingLogo, setUploadingLogo] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const setOnboardingCompleted = useAuthStore((s) => s.setOnboardingCompleted);
  const setStoredShopName = useAuthStore((s) => s.setShopName);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await adminApi.getProfile();
        if (data?.fashionHouse) {
          if (data.fashionHouse.shopName) setShopName(data.fashionHouse.shopName);
          if (data.fashionHouse.location) setLocation(data.fashionHouse.location);
          if (data.fashionHouse.phone) setPhone(data.fashionHouse.phone);
          if (data.fashionHouse.bio) setBio(data.fashionHouse.bio);
          if (data.fashionHouse.brandLogoUrl) setBrandLogoUrl(data.fashionHouse.brandLogoUrl);
          if (data.fashionHouse.categories?.length) setSelectedCategories(data.fashionHouse.categories);
          if (data.fashionHouse.currency) setCurrency(data.fashionHouse.currency);
        }
      } catch (err) {
        console.warn("Could not pre-fill profile data:", err);
      }
    };

    loadProfile();
  }, []);

  const toggleCategory = (cat: string) => {
    if (selectedCategories.includes(cat)) {
      if (selectedCategories.length === 1) return; // Must keep at least 1
      setSelectedCategories((prev) => prev.filter((c) => c !== cat));
    } else {
      setSelectedCategories((prev) => [...prev, cat]);
    }
  };

  const handlePickLogo = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError("Permission to access photo library is required.");
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
        setUploadingLogo(true);
        setError("");

        const filename = asset.fileName || `logo_${Date.now()}.jpg`;
        const contentType = asset.mimeType || "image/jpeg";

        const uploaded = await uploadFile(asset.uri, filename, contentType);
        setBrandLogoUrl(uploaded.fileUrl);
      }
    } catch (err: any) {
      setError(err.message || "Failed to upload brand logo.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleNext = () => {
    setError("");
    if (step === 1) {
      if (!shopName.trim()) {
        setError("Please enter your Fashion House name.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!location.trim()) {
        setError("Please enter your shop location or address.");
        return;
      }
      setStep(3);
    }
  };

  const handleSubmitOnboarding = async () => {
    setError("");
    setLoading(true);
    try {
      await adminApi.completeOnboarding({
        shopName: shopName.trim(),
        location: location.trim(),
        phone: phone.trim() || undefined,
        bio: bio.trim() || undefined,
        brandLogoUrl: brandLogoUrl || undefined,
        categories: selectedCategories,
        currency,
      });

      setOnboardingCompleted(true);
      setStoredShopName(shopName.trim());
      router.replace("/(admin)/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to save profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={isLandscape ? undefined : Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[
            styles.scrollContent,
            isLandscape && {
              paddingTop: 4,
              paddingBottom: 16,
              maxWidth: 680,
              alignSelf: "center",
              width: "100%",
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Top Progress Bar */}
          <View style={[styles.progressTrack, isLandscape && { marginBottom: 8 }]}>
            <View style={[styles.progressFill, { width: `${(step / 3) * 100}%` }]} />
          </View>

          {/* Back Arrow (shown only on step 2) */}
          {step === 2 && (
            <View style={[styles.topBackHeader, isLandscape && { height: 32, marginBottom: 6 }]}>
              <Pressable
                onPress={() => setStep((s) => s - 1)}
                style={({ pressed }) => [
                  styles.topBackBtn,
                  isLandscape && { width: 32, height: 32, borderRadius: 16 },
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <ArrowLeft size={isLandscape ? 16 : 18} color="#3B0508" />
              </Pressable>
            </View>
          )}

          {/* Step Badge */}
          <Text style={[styles.stepBadge, isLandscape && { marginBottom: 10 }]}>FASHION OWNER SETUP · STEP {step} OF 3</Text>

          {step === 1 && (
            <View style={[styles.stepContainer, isLandscape && { marginBottom: 16 }]}>
              <View style={[styles.iconCircle, isLandscape && { width: 44, height: 44, borderRadius: 22, marginBottom: 10 }]}>
                <Store size={isLandscape ? 22 : 28} color="#4A080C" />
              </View>
              <Text style={[styles.headline, isLandscape && { fontSize: 22, marginBottom: 4 }]}>Brand & Identity</Text>
              <Text style={[styles.subtext, isLandscape && { fontSize: 13, lineHeight: 18, marginBottom: 14 }]}>
                Set up your brand name, logo, and store tagline for clients.
              </Text>

              {/* Logo Upload Box (Cloudflare R2 Direct Upload) */}
              <View style={[styles.logoSection, isLandscape && { marginBottom: 14 }]}>
                <Text style={styles.label}>Brand Logo / Avatar </Text>
                <Pressable
                  onPress={handlePickLogo}
                  disabled={uploadingLogo}
                  style={({ pressed }) => [
                    styles.logoPickerBox,
                    isLandscape && { minHeight: 90, padding: 10 },
                    { opacity: pressed || uploadingLogo ? 0.8 : 1 },
                  ]}
                >
                  {uploadingLogo ? (
                    <View style={styles.logoUploadingWrap}>
                      <ActivityIndicator color="#4A080C" size="small" />
                      <Text style={styles.logoUploadingText}>Uploading....</Text>
                    </View>
                  ) : brandLogoUrl ? (
                    <View style={styles.logoPreviewWrap}>
                      <Image source={{ uri: brandLogoUrl }} style={[styles.logoPreviewImage, isLandscape && { width: 60, height: 60, borderRadius: 30 }]} />
                      <View style={styles.logoChangeBadge}>
                        <Camera size={12} color="#FFFFFF" />
                        <Text style={styles.logoChangeText}>Change</Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.logoPlaceholderWrap}>
                      <UploadCloud size={isLandscape ? 24 : 32} color="#4A080C" />
                      <Text style={[styles.logoPlaceholderText, isLandscape && { fontSize: 13 }]}>Tap to upload brand logo</Text>
                      <Text style={styles.logoSubtext}>JPG, PNG up to 5MB</Text>
                    </View>
                  )}
                </Pressable>
              </View>

              <View style={[styles.inputWrapper, isLandscape && { marginBottom: 14 }]}>
                <Text style={styles.label}>Business / Brand Name</Text>
                <TextInput
                  disableFullscreenUI={true}
                  style={[styles.input, isLandscape && { height: 48 }]}
                  placeholder="e.g. Royal Stitch Atelier"
                  placeholderTextColor="#8A7550"
                  value={shopName}
                  onChangeText={(t) => {
                    setShopName(t);
                    if (error) setError("");
                  }}
                />
              </View>

              <View style={[styles.inputWrapper, isLandscape && { marginBottom: 14 }]}>
                <Text style={styles.label}>Brand Bio / Motto (Optional)</Text>
                <TextInput
                  disableFullscreenUI={true}
                  style={[styles.input, { height: 60, paddingTop: 12 }, isLandscape && { height: 50, paddingTop: 8 }]}
                  placeholder="Crafting luxury bespoke wear in Lagos since 2018..."
                  placeholderTextColor="#8A7550"
                  multiline
                  numberOfLines={2}
                  maxLength={500}
                  value={bio}
                  onChangeText={setBio}
                />
                <Text style={styles.charCount}>{bio.length}/500</Text>
              </View>
            </View>
          )}

          {step === 2 && (
            <View style={[styles.stepContainer, isLandscape && { marginBottom: 16 }]}>
              <View style={[styles.iconCircle, isLandscape && { width: 44, height: 44, borderRadius: 22, marginBottom: 10 }]}>
                <MapPin size={isLandscape ? 22 : 28} color="#4A080C" />
              </View>
              <Text style={[styles.headline, isLandscape && { fontSize: 22, marginBottom: 4 }]}>Location & Contact</Text>
              <Text style={[styles.subtext, isLandscape && { fontSize: 13, lineHeight: 18, marginBottom: 14 }]}>
                Help customers locate your showroom or studio for fittings.
              </Text>

              <View style={[styles.inputWrapper, isLandscape && { marginBottom: 14 }]}>
                <Text style={styles.label}>Store Address / City</Text>
                <TextInput
                  disableFullscreenUI={true}
                  style={[styles.input, isLandscape && { height: 48 }]}
                  placeholder="e.g. 14 Admiralty Way, Lekki Phase 1, Lagos"
                  placeholderTextColor="#8A7550"
                  value={location}
                  onChangeText={(t) => {
                    setLocation(t);
                    if (error) setError("");
                  }}
                />
              </View>

              <View style={[styles.inputWrapper, isLandscape && { marginBottom: 14 }]}>
                <PhoneInputWithCountry
                  label="Official Business Phone (Optional)"
                  placeholder="801 234 5678"
                  value={phone}
                  onChangePhone={setPhone}
                />
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={[styles.stepContainer, isLandscape && { marginBottom: 16 }]}>
              <View style={[styles.iconCircle, isLandscape && { width: 44, height: 44, borderRadius: 22, marginBottom: 10 }]}>
                <Sparkles size={isLandscape ? 22 : 28} color="#4A080C" />
              </View>
              <Text style={[styles.headline, isLandscape && { fontSize: 22, marginBottom: 4 }]}>What do you specialize in?</Text>
              <Text style={[styles.subtext, isLandscape && { fontSize: 13, lineHeight: 18, marginBottom: 14 }]}>
                Select the fashion categories your brand creates best.
              </Text>

              <View style={styles.pillsContainer}>
                {SPECIALIZATION_CATEGORIES.map((cat) => {
                  const selected = selectedCategories.includes(cat);
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => toggleCategory(cat)}
                      style={[
                        styles.pill,
                        isLandscape && { height: 44 },
                        selected ? styles.pillSelected : styles.pillUnselected,
                      ]}
                    >
                      {selected && <Check size={16} color="#FFFFFF" style={{ marginRight: 6 }} />}
                      <Text style={selected ? styles.pillTextSelected : styles.pillTextUnselected}>
                        {cat}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>

        {/* Bottom Actions Pinned to Bottom */}
        <View style={[styles.actionRow, isLandscape && { paddingTop: 6, paddingBottom: 12 }]}>
          {step < 3 ? (
            <Pressable
              onPress={handleNext}
              style={[styles.nextBtn, isLandscape && { height: 44, borderRadius: 22 }]}
            >
              <Text style={styles.nextBtnText}>Continue</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={handleSubmitOnboarding}
              disabled={loading || uploadingLogo}
              style={[
                styles.nextBtn,
                isLandscape && { height: 44, borderRadius: 22 },
                { opacity: loading || uploadingLogo ? 0.8 : 1 },
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.nextBtnText}>Complete Setup</Text>
              )}
            </Pressable>
          )}
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
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
  },
  progressTrack: {
    width: "100%",
    height: 4,
    backgroundColor: "rgba(74, 8, 12, 0.15)",
    borderRadius: 2,
    marginTop: 4,
    marginBottom: 14,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#4A080C",
    borderRadius: 2,
  },
  stepBadge: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 12,
    letterSpacing: 1.2,
    color: "#4A080C",
    marginBottom: 16,
  },
  stepContainer: {
    marginBottom: 32,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#EBE0D3",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  headline: {
    fontFamily: "Fraunces-Bold",
    fontSize: 28,
    color: "#3B0508",
    marginBottom: 8,
  },
  subtext: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 15,
    color: "rgba(74, 8, 12, 0.75)",
    marginBottom: 24,
    lineHeight: 22,
  },
  logoSection: {
    marginBottom: 24,
  },
  logoPickerBox: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(74, 8, 12, 0.20)",
    borderRadius: 18,
    backgroundColor: "#F4EFE6",
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  logoPlaceholderWrap: {
    alignItems: "center",
    gap: 6,
  },
  logoPlaceholderText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 14,
    color: "#3B0508",
  },
  logoSubtext: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 12,
    color: "rgba(74, 8, 12, 0.6)",
  },
  logoUploadingWrap: {
    alignItems: "center",
    gap: 8,
  },
  logoUploadingText: {
    fontFamily: "WorkSans_500Medium",
    fontSize: 13,
    color: "#4A080C",
  },
  logoPreviewWrap: {
    alignItems: "center",
    gap: 8,
  },
  logoPreviewImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: "#C4A763",
  },
  logoChangeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#4A080C",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  logoChangeText: {
    fontFamily: "WorkSans_500Medium",
    fontSize: 12,
    color: "#FFFFFF",
  },
  inputWrapper: {
    marginBottom: 20,
  },
  label: {
    fontFamily: "Fraunces-SemiBold",
    fontSize: 15,
    color: "#3B0508",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(74, 8, 12, 0.3)",
    borderRadius: 14,
    height: 56,
    paddingHorizontal: 16,
    fontFamily: "WorkSans_400Regular",
    fontSize: 16,
    color: "#3B0508",
    backgroundColor: "#FFFFFF",
  },
  charCount: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 11,
    color: "rgba(74, 8, 12, 0.45)",
    textAlign: "right",
    marginTop: 4,
  },
  pillsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "48%",
    height: 52,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  pillSelected: {
    backgroundColor: "#4A080C",
    borderColor: "#4A080C",
  },
  pillUnselected: {
    backgroundColor: "transparent",
    borderColor: "rgba(74, 8, 12, 0.35)",
  },
  pillTextSelected: {
    fontFamily: "WorkSans_500Medium",
    fontSize: 14,
    color: "#FFFFFF",
  },
  pillTextUnselected: {
    fontFamily: "WorkSans_500Medium",
    fontSize: 14,
    color: "#3B0508",
  },
  errorText: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 13,
    color: "#D32F2F",
    marginBottom: 16,
  },
  topBackHeader: {
    height: 40,
    justifyContent: "center",
    marginBottom: 12,
  },
  topBackPlaceholder: {
    height: 40,
  },
  topBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(74, 8, 12, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: "#FBF7EF",
  },
  nextBtn: {
    width: "100%",
    maxWidth: 380,
    alignSelf: "center",
    height: 58,
    borderRadius: 29,
    backgroundColor: "#4A080C",
    alignItems: "center",
    justifyContent: "center",
  },
  nextBtnText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
  },
});

import { typeScale } from "@/shared/utils/typeScale";
import React, { useState, useEffect } from "react";
import { View, Pressable, Image, ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { Text, TextInput } from "@/shared/components/Typography";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "@/shared/components/KeyboardAwareScrollView";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Upload, Check, ChevronRight, Calendar } from "lucide-react-native";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import { adminApi, AdminOnboardingPayload } from "@/shared/utils/apiClient";
import { uploadFile } from "@/shared/utils/upload";
import { useAuthStore } from "@/stores/useAuthStore";
import { PhoneInputWithCountry } from "@/shared/components/PhoneInputWithCountry";
import { useAppAlert } from "@/shared/hooks/useAppAlert";
import { SCREEN_TOP_SPACING } from "@/shared/utils/screenSpacing";

const SPECIALIZATIONS = [
  "Bespoke Tailoring",
  "Bridal & Evening Wear",
  "Agbada & Traditional",
  "Kaftans & Senator Wear",
  "Aso-Ebi Production",
  "Suits & Corporate",
  "Couture & Custom Gowns",
  "Alterations & Fitting",
];

const STEPS = [
  { num: 1, title: "Profile", fullTitle: "1. Fashion House Profile" },
  { num: 2, title: "Brand", fullTitle: "2. Brand & Craft" },
  { num: 3, title: "Payment", fullTitle: "3. Payment Details" },
] as const;

export default function AdminProfileEditScreen({
  onClose,
  embedded = false,
}: { onClose?: () => void; embedded?: boolean } = {}) {
  const { showAlert } = useAppAlert();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Form states
  const [shopName, setShopName] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [turnaround, setTurnaround] = useState("2-3 week turnaround");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [brandLogoUrl, setBrandLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [existingSchedule, setExistingSchedule] = useState<any>(null);
  const [existingTimezone, setExistingTimezone] = useState("Africa/Lagos");
  const [existingDuration, setExistingDuration] = useState(60);

  const setStoredShopName = useAuthStore((s) => s.setShopName);
  const storedShopName = useAuthStore((s) => s.shopName);
  const fashionHouseName = shopName.trim() || storedShopName || "Fashion House";

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await adminApi.getProfile();
        if (res?.fashionHouse) {
          const house = res.fashionHouse;
          setShopName(house.shopName || house.name || "");
          setLocation(house.location || "");
          setPhone(house.phone || "");
          setBankName(house.bankName || "");
          setAccountNumber(house.accountNumber || "");
          setAccountName(house.accountName || "");
          if (house.bio) {
            if (house.bio.includes(" • ")) {
              const [savedBio, savedTurnaround] = house.bio.split(" • ");
              setBio(savedBio || "");
              setTurnaround(savedTurnaround || "");
            } else {
              setBio(house.bio);
            }
          }
          setBrandLogoUrl(house.brandLogoUrl || null);
          setExistingSchedule(house.bookingSchedule || null);
          setExistingTimezone(house.timezone || "Africa/Lagos");
          setExistingDuration(house.slotDurationMinutes || 60);
          if (Array.isArray(house.categories) && house.categories.length > 0) {
            setSelectedCategories(house.categories);
          }
        }
      } catch (err) {
        console.warn("Failed to load profile for edit", err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  const handlePickLogo = async () => {
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
        setUploadingLogo(true);

        const filename = asset.fileName || `logo_${Date.now()}.jpg`;
        const contentType = asset.mimeType || "image/jpeg";

        const uploaded = await uploadFile(asset.uri, filename, contentType);
        setBrandLogoUrl(uploaded.fileUrl);
      }
    } catch (err: any) {
      showAlert("Upload Failed", err?.message || "Could not upload brand logo. Please try again.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleHeaderBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3);
    } else {
      if (onClose) onClose();
      else router.push("/(admin)/settings" as any);
    }
  };

  const handleNextStep1 = () => {
    if (!shopName.trim()) {
      showAlert("Required Field", "Please enter your business or shop name before continuing.");
      return;
    }
    setCurrentStep(2);
  };

  const handleNextStep2 = () => {
    setCurrentStep(3);
  };

  const handleSave = async () => {
    if (!shopName.trim()) {
      showAlert("Required Field", "Please enter your business or shop name.");
      setCurrentStep(1);
      return;
    }
    const hasSomePaymentDetails = bankName.trim() || accountNumber.trim() || accountName.trim();
    if (
      hasSomePaymentDetails &&
      (!bankName.trim() || !/^\d{10}$/.test(accountNumber.trim()) || !accountName.trim())
    ) {
      showAlert("Payment Details", "Enter a bank name, a valid 10-digit account number, and the account holder name.");
      return;
    }

    setSaving(true);
    try {
      const combinedBio = turnaround.trim()
        ? bio.trim()
          ? `${bio.trim()} • ${turnaround.trim()}`
          : turnaround.trim()
        : bio.trim();

      const payload: AdminOnboardingPayload = {
        shopName: shopName.trim(),
        location: location.trim(),
        phone: phone.trim(),
        bio: combinedBio,
        categories: selectedCategories,
        brandLogoUrl: brandLogoUrl || undefined,
        bankName: bankName.trim() || undefined,
        accountNumber: accountNumber.trim() || undefined,
        accountName: accountName.trim() || undefined,
        timezone: existingTimezone,
        slotDurationMinutes: existingDuration,
        ...(existingSchedule ? { bookingSchedule: existingSchedule } : {}),
      };

      await adminApi.completeOnboarding(payload);
      setStoredShopName(shopName.trim());

      showAlert("Success", "Your profile & business info have been updated.");
      if (onClose) onClose();
      else router.push("/(admin)/settings" as any);
    } catch (err: any) {
      showAlert("Update Failed", err.message || "Could not update profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F9E8D3" }} edges={embedded ? [] : ["top"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={embedded ? undefined : Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 20}
      >
        {/* Header */}
        {!embedded && (
          <View style={styles.header}>
            <Pressable
              onPress={handleHeaderBack}
              style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <BackArrowIcon size={24} color="#453332" />
            </Pressable>
            <Text style={styles.headerTitle}>Personal Info</Text>
          </View>
        )}

        {/* 3-Step Progress Indicator */}
        <View style={styles.stepIndicatorContainer}>
          {STEPS.map((step) => {
            const isActive = currentStep === step.num;
            const isCompleted = currentStep > step.num;
            return (
              <Pressable
                key={step.num}
                onPress={() => {
                  if (step.num === 1 || shopName.trim()) {
                    setCurrentStep(step.num);
                  }
                }}
                style={styles.stepItem}
              >
                <View
                  style={[
                    styles.stepBar,
                    (isActive || isCompleted) && styles.stepBarActive,
                  ]}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.stepLabel,
                    isActive && styles.stepLabelActive,
                  ]}
                >
                  {step.fullTitle}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#453332" size="large" />
          </View>
        ) : (
          <KeyboardAwareScrollView
            keyboardGap={110}
            automaticallyAdjustKeyboardInsets={true}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.scrollContent,
              { paddingHorizontal: embedded ? 0 : 20, paddingBottom: 110 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {/* ─── STEP 1: FASHION HOUSE PROFILE ─── */}
            {currentStep === 1 && (
              <View>
                <Text style={styles.stepSubtitle}>
                  Set up brand identity and public contact details for {fashionHouseName}.
                </Text>

                {/* Brand Logo Card */}
                <Text style={styles.fieldLabel}>Brand Logo</Text>
                <Pressable onPress={handlePickLogo} style={styles.logoPickerBox}>
                  {uploadingLogo ? (
                    <ActivityIndicator color="#453332" />
                  ) : brandLogoUrl ? (
                    <Image source={{ uri: brandLogoUrl }} style={styles.logoImage} />
                  ) : (
                    <View style={{ alignItems: "center" }}>
                      <Upload size={24} color="#453332" style={{ marginBottom: 6 }} />
                      <Text style={styles.uploadHint}>Tap to upload brand logo</Text>
                    </View>
                  )}
                </Pressable>

                {/* Shop / Business Name */}
                <Text style={styles.fieldLabel}>Business / Shop Name *</Text>
                <TextInput
                  value={shopName}
                  onChangeText={setShopName}
                  placeholder="e.g. Royal Stitch Atelier"
                  placeholderTextColor="#453332"
                  style={styles.textInput}
                />

                {/* Location */}
                <Text style={styles.fieldLabel}>Location / City</Text>
                <TextInput
                  value={location}
                  onChangeText={setLocation}
                  placeholder="e.g. Victoria Island, Lagos"
                  placeholderTextColor="#453332"
                  style={styles.textInput}
                />

                {/* Phone */}
                <PhoneInputWithCountry
                  label="Official Business Phone"
                  placeholder="801 234 5678"
                  value={phone}
                  onChangePhone={setPhone}
                />
              </View>
            )}

            {/* ─── STEP 2: BRAND & CRAFT ─── */}
            {currentStep === 2 && (
              <View>
                <Text style={styles.stepSubtitle}>
                  Highlight {fashionHouseName}'s craftsmanship story and garment specialties.
                </Text>

                {/* Brand Bio / Motto */}
                <View style={styles.bioHeaderRow}>
                  <Text style={styles.fieldLabel}>Brand Bio / Motto</Text>
                  <Text style={styles.charCount}>{bio.length}/500</Text>
                </View>
                <TextInput
                  value={bio}
                  onChangeText={setBio}
                  maxLength={500}
                  multiline
                  numberOfLines={3}
                  placeholder="Describe your fashion house craftsmanship style & bespoke heritage..."
                  placeholderTextColor="#453332"
                  style={styles.bioInput}
                />

                {/* Standard Turnaround Time */}
                <Text style={styles.fieldLabel}>Standard Turnaround Time</Text>
                <TextInput
                  value={turnaround}
                  onChangeText={setTurnaround}
                  placeholder="e.g. 2-3 week turnaround"
                  placeholderTextColor="#453332"
                  style={styles.textInput}
                />

                {/* Specializations (2 per row) */}
                <Text style={[styles.fieldLabel, { marginTop: 6, marginBottom: 12 }]}>
                  What do you specialize in?
                </Text>
                <View style={styles.categoriesWrap}>
                  {SPECIALIZATIONS.map((spec) => {
                    const selected = selectedCategories.includes(spec);
                    return (
                      <Pressable
                        key={spec}
                        onPress={() => toggleCategory(spec)}
                        style={[
                          styles.categoryPill,
                          selected && styles.categoryPillActive,
                        ]}
                      >
                        {selected && <Check size={16} color="#FFFFFF" />}
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.categoryText,
                            selected && styles.categoryTextActive,
                          ]}
                        >
                          {spec}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ─── STEP 3: PAYMENT DETAILS ─── */}
            {currentStep === 3 && (
              <View>
                <Text style={styles.stepTitle}>Invoice Payout Details</Text>
                <Text style={styles.stepSubtitle}>
                  These bank details appear directly on official client invoices generated for {fashionHouseName}.
                </Text>

                <Text style={styles.fieldLabel}>Bank Name</Text>
                <TextInput
                  value={bankName}
                  onChangeText={setBankName}
                  placeholder="e.g. Zenith Bank, GTBank, Access Bank"
                  placeholderTextColor="#4A403B"
                  style={styles.textInput}
                />

                <Text style={styles.fieldLabel}>10-Digit Account Number</Text>
                <TextInput
                  value={accountNumber}
                  onChangeText={(value) => setAccountNumber(value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="0123456789"
                  placeholderTextColor="#4A403B"
                  keyboardType="number-pad"
                  maxLength={10}
                  style={styles.textInput}
                />

                <Text style={styles.fieldLabel}>Account Holder Name</Text>
                <TextInput
                  value={accountName}
                  onChangeText={setAccountName}
                  placeholder="e.g. Royal Stitch Atelier Ltd"
                  placeholderTextColor="#4A403B"
                  style={styles.textInput}
                />

                {/* Quick Link to Fitting Slots */}
                <Pressable
                  onPress={() => router.push("/(admin)/fitting-slots" as any)}
                  style={({ pressed }) => [styles.slotsLinkCard, { opacity: pressed ? 0.75 : 1 }]}
                >
                  <View style={styles.slotsLinkIconWrap}>
                    <Calendar size={20} color="#453332" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.slotsLinkTitle}>Manage Fitting Availability</Text>
                    <Text style={styles.slotsLinkDesc}>Set working hours and appointment slots</Text>
                  </View>
                  <ChevronRight size={18} color="#453332" />
                </Pressable>
              </View>
            )}
          </KeyboardAwareScrollView>
        )}

        {/* Pinned Bottom Action Button Bar */}
        <View style={styles.bottomBar}>
          {currentStep === 1 && (
            <Pressable
              onPress={handleNextStep1}
              style={({ pressed }) => [styles.primaryBtn, { opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={styles.primaryBtnText}>Continue to Brand & Craft</Text>
            </Pressable>
          )}

          {currentStep === 2 && (
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                onPress={() => setCurrentStep(1)}
                style={({ pressed }) => [styles.secondaryBtn, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={styles.secondaryBtnText}>Back</Text>
              </Pressable>
              <Pressable
                onPress={handleNextStep2}
                style={({ pressed }) => [styles.primaryBtn, { flex: 1, opacity: pressed ? 0.85 : 1 }]}
              >
                <Text style={styles.primaryBtnText}>Continue to Payment</Text>
              </Pressable>
            </View>
          )}

          {currentStep === 3 && (
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                onPress={() => setCurrentStep(2)}
                style={({ pressed }) => [styles.secondaryBtn, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={styles.secondaryBtnText}>Back</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={saving}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { flex: 1, opacity: pressed || saving ? 0.85 : 1 },
                ]}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>Save Changes</Text>
                )}
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: SCREEN_TOP_SPACING,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(69, 51, 50, 0.25)",
    backgroundColor: "#F9E8D3",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { ...typeScale.pageTitle,
    color: "#4A403B",
    letterSpacing: -0.2,
  },
  stepIndicatorContainer: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  stepItem: {
    flex: 1,
  },
  stepBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(69, 51, 50, 0.12)",
    marginBottom: 6,
  },
  stepBarActive: {
    backgroundColor: "#453332",
  },
  stepLabel: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 11,
    color: "#4A403B",
  },
  stepLabelActive: {
    fontFamily: "InstrumentSans-SemiBold",
    color: "#4A403B",
  },
  stepTitle: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 20,
    color: "#4A403B",
    marginBottom: 6,
  },
  stepSubtitle: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 14,
    color: "#4A403B",
    marginBottom: 20,
    lineHeight: 20,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingTop: 8,
  },
  fieldLabel: { ...typeScale.label,
    color: "#4A403B",
    marginBottom: 8,
  },
  logoPickerBox: {
    height: 120,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "rgba(69, 51, 50, 0.20)",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    overflow: "hidden",
  },
  logoImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  uploadHint: {
    fontFamily: "InstrumentSans-Medium",
    fontSize: 13,
    color: "#4A403B",
  },
  textInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    fontFamily: "InstrumentSans-Medium",
    fontSize: 15,
    color: "#4A403B",
    borderWidth: 1,
    borderColor: "rgba(69, 51, 50,0.08)",
    marginBottom: 20,
  },
  bioHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  charCount: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 11,
    color: "#4A403B",
  },
  bioInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 88,
    fontFamily: "InstrumentSans-Regular",
    fontSize: 14,
    color: "#4A403B",
    borderWidth: 1,
    borderColor: "rgba(69, 51, 50,0.08)",
    textAlignVertical: "top",
    marginBottom: 20,
  },
  categoriesWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  categoryPill: {
    width: "48%",
    height: 50,
    borderRadius: 25,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(69, 51, 50,0.1)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    flexDirection: "row",
    gap: 6,
  },
  categoryPillActive: {
    backgroundColor: "#F96951",
    borderColor: "#F96951",
  },
  categoryText: {
    fontFamily: "InstrumentSans-Medium",
    fontSize: 13,
    color: "#4A403B",
  },
  categoryTextActive: {
    color: "#FFFFFF",
  },
  slotsLinkCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(69, 51, 50, 0.10)",
    marginTop: 8,
  },
  slotsLinkIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F9E8D3",
    alignItems: "center",
    justifyContent: "center",
  },
  slotsLinkTitle: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 14,
    color: "#4A403B",
  },
  slotsLinkDesc: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 12,
    color: "#4A403B",
    marginTop: 2,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#F9E8D3",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
  },
  primaryBtn: {
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F96951",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { ...typeScale.button,
    color: "#FFFFFF",
  },
  secondaryBtn: {
    width: 90,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: "rgba(69, 51, 50, 0.25)",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 15,
    color: "#4A403B",
  },
});

import React, { useState, useEffect, useRef } from "react";
import { View, Pressable, StyleSheet, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Image, useWindowDimensions, Keyboard } from "react-native";
import { Text, TextInput } from "@/shared/components/Typography";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "@/shared/components/KeyboardAwareScrollView";
import { BookingScheduleForm, DEFAULT_BOOKING_SCHEDULE, bookingScheduleError } from "@/shared/components/BookingScheduleForm";
import type { WeeklyBookingSchedule } from "@/shared/utils/apiClient";
import { Check, Store, MapPin, Sparkles, Camera, UploadCloud, Calendar, Clock, Trash2, Plus } from "lucide-react-native";
import { SCREEN_TOP_SPACING } from "@/shared/utils/screenSpacing";
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
  const [bookingSchedule, setBookingSchedule] = useState<WeeklyBookingSchedule>(DEFAULT_BOOKING_SCHEDULE);
  const [shopName, setShopName] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [bio, setBio] = useState<string>("");
  const [brandLogoUrl, setBrandLogoUrl] = useState<string>("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["Bespoke Suits"]);
  const [customCategory, setCustomCategory] = useState("");
  const addCustomCategory = () => {
    const category = customCategory.trim().replace(/\s+/g, " ");
    if (!category || category.length > 100) { setError("Enter a category name, up to 100 characters."); return; }
    if (selectedCategories.some(value => value.toLowerCase() === category.toLowerCase())) { setCustomCategory(""); setError(""); return; }
    if (selectedCategories.length >= 30) { setError("Choose up to 30 specializations."); return; }
    const preset = SPECIALIZATION_CATEGORIES.find(value => value.toLowerCase() === category.toLowerCase());
    setSelectedCategories(values => [...values, preset || category]);
    setCustomCategory("");
    setError("");
  };
  const [currency, setCurrency] = useState<string>("NGN");
  const [timezone, setTimezone] = useState<string>("Africa/Lagos");

  const [loading, setLoading] = useState<boolean>(false);
  const [uploadingLogo, setUploadingLogo] = useState<boolean>(false);
  const [error, setError] = useState<string>("");


  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardHeight(0)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const setOnboardingCompleted = useAuthStore((s) => s.setOnboardingCompleted);
  const setStoredShopName = useAuthStore((s) => s.setShopName);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await adminApi.getProfile();
        if (data?.fashionHouse) {
          if (data.fashionHouse.bookingSchedule) setBookingSchedule(data.fashionHouse.bookingSchedule);
          if (data.fashionHouse.shopName) setShopName(data.fashionHouse.shopName);
          if (data.fashionHouse.location) setLocation(data.fashionHouse.location);
          if (data.fashionHouse.phone) setPhone(data.fashionHouse.phone);
          if (data.fashionHouse.bio) setBio(data.fashionHouse.bio);
          if (data.fashionHouse.brandLogoUrl) setBrandLogoUrl(data.fashionHouse.brandLogoUrl);
          if (data.fashionHouse.categories?.length) setSelectedCategories(data.fashionHouse.categories);
          if (data.fashionHouse.currency) setCurrency(data.fashionHouse.currency);
          if (data.fashionHouse.timezone) setTimezone(data.fashionHouse.timezone);
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
      if (selectedCategories.length >= 30) { setError("Choose up to 30 specializations."); return; }
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
        aspect: [3, 4],
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
    if (step === 3 && customCategory.trim()) { setError("Tap + to save your custom specialization before continuing."); return; }
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
    } else if (step === 3) {
      setStep(4);
    }
  };

  const handleSubmitOnboarding = async () => {
    setError("");
    const scheduleError = bookingScheduleError(bookingSchedule);
    if (scheduleError) { setError(scheduleError); return; }
    const duration = bookingSchedule.durationMinutes;
    if (!timezone.trim() || !Number.isInteger(duration) || duration < 15 || duration > 480) {
      setError("Choose a valid timezone and fitting duration.");
      return;
    }
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
        timezone: timezone.trim(),
        slotDurationMinutes: duration,
        bookingSchedule,
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
        keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}
        style={{ flex: 1 }}
      >
        <KeyboardAwareScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: keyboardHeight > 0 ? 60 : 40 },
            isLandscape && {
              paddingTop: 4,
              paddingBottom: 16,
              maxWidth: 680,
              alignSelf: "center",
              width: "100%",
            },
          ]}
        >
          {/* Top Progress Bar */}
          <View style={[styles.progressTrack, isLandscape && { marginBottom: 8 }]}>
            {[1, 2, 3, 4].map(segment => (
              <View key={segment} accessibilityLabel={`Step ${segment}${segment <= step ? ', reached' : ''}`} style={[styles.progressFill, { flex: 1, backgroundColor: segment <= step ? "#453332" : "rgba(69, 51, 50, 0.15)" }]} />
            ))}
          </View>

          {/* Step Badge */}
          <Text style={[styles.stepBadge, isLandscape && { marginBottom: 10 }]}>FASHION OWNER SETUP · STEP {step} OF 4</Text>

          {step === 1 && (
            <View style={[styles.stepContainer, isLandscape && { marginBottom: 16 }]}>
              <View style={[styles.iconCircle, isLandscape && { width: 44, height: 44, borderRadius: 22, marginBottom: 10 }]}>
                <Store size={isLandscape ? 22 : 28} color="#453332" />
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
                      <ActivityIndicator color="#453332" size="small" />
                      <Text style={styles.logoUploadingText}>Uploading....</Text>
                    </View>
                  ) : brandLogoUrl ? (
                    <View style={styles.logoPreviewWrap}>
                      <Image source={{ uri: brandLogoUrl }} style={[styles.logoPreviewImage, isLandscape && { width: 60, height: 60, borderRadius: 30 }]} />
                      <View style={styles.logoChangeBadge}>
                        <Camera size={12} color="#FFFDF9" />
                        <Text style={styles.logoChangeText}>Change</Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.logoPlaceholderWrap}>
                      <UploadCloud size={isLandscape ? 24 : 32} color="#453332" />
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
                  placeholderTextColor="#453332"
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
                  placeholderTextColor="#453332"
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
                <MapPin size={isLandscape ? 22 : 28} color="#453332" />
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
                  placeholderTextColor="#453332"
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
                  placeholder=""
                  value={phone}
                  onChangePhone={setPhone}
                />
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={[styles.stepContainer, { marginBottom: 0 }]}>
              <View style={[styles.iconCircle, isLandscape && { width: 44, height: 44, borderRadius: 22, marginBottom: 10 }]}>
                <Sparkles size={isLandscape ? 22 : 28} color="#453332" />
              </View>
              <Text style={[styles.headline, isLandscape && { fontSize: 22, marginBottom: 4 }]}>What do you specialize in?</Text>
              <Text style={[styles.subtext, isLandscape && { fontSize: 13, lineHeight: 18, marginBottom: 14 }]}>
                Select the fashion categories your brand creates best.
              </Text>

              <View style={styles.pillsContainer}>
                {[...new Set([...SPECIALIZATION_CATEGORIES, ...selectedCategories])].map((cat) => {
                  const selected = selectedCategories.includes(cat);
                  return (
                    <Pressable
                      key={cat}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      onPress={() => toggleCategory(cat)}
                      style={[
                        styles.pill,
                        selected ? styles.pillSelected : styles.pillUnselected,
                      ]}
                    >
                      <Text style={selected ? styles.pillTextSelected : styles.pillTextUnselected}>
                        {cat}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={{ marginTop: 20, gap: 10 }}>
                <Text style={styles.label}>Custom specialization</Text>
                <View style={{ position: "relative" }}>
                  <TextInput accessibilityLabel="Custom specialization" placeholder="Ankara suit" value={customCategory} onChangeText={value => { setCustomCategory(value); setError(""); }} maxLength={100} returnKeyType="done" onSubmitEditing={addCustomCategory} style={[styles.input, { paddingRight: 60 }]} />
                  <Pressable accessibilityRole="button" accessibilityLabel="Add category" disabled={!customCategory.trim()} onPress={addCustomCategory} style={{ position: "absolute", right: 6, top: 6, width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: customCategory.trim() ? 1 : 0.4 }}>
                    <Plus size={22} color="#453332" />
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {step === 4 && (
            <View style={[styles.stepContainer, isLandscape && { marginBottom: 16 }]}>
              <View style={[styles.iconCircle, isLandscape && { width: 44, height: 44, borderRadius: 22, marginBottom: 10 }]}>
                <Calendar size={isLandscape ? 22 : 28} color="#453332" />
              </View>
              <Text style={[styles.headline, isLandscape && { fontSize: 22, marginBottom: 4 }]}>Fitting & Booking Slots</Text>
              <Text style={[styles.subtext, isLandscape && { fontSize: 13, lineHeight: 18, marginBottom: 14 }]}>
                Choose the days and hours clients can book.
              </Text>

              <BookingScheduleForm value={bookingSchedule} onChange={setBookingSchedule} timezone={timezone} onTimezoneChange={setTimezone} disabled={loading} />
            </View>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Bottom Actions positioned inside ScrollView so they don't cover cards when typing */}
          <View style={[styles.actionRow, step === 3 && { marginTop: 16 }, isLandscape && { paddingTop: 6, paddingBottom: 12 }]}>
            {step < 4 ? (
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
                  <ActivityIndicator color="#FFFDF9" />
                ) : (
                  <Text style={styles.nextBtnText}>Complete Setup</Text>
                )}
              </Pressable>
            )}
          </View>
        </KeyboardAwareScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: SCREEN_TOP_SPACING,
    paddingBottom: 40,
  },
  progressTrack: {
    width: "100%",
    height: 4,
    flexDirection: "row",
    gap: 8,
    borderRadius: 2,
    marginTop: 4,
    marginBottom: 14,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#453332",
    borderRadius: 2,
  },
  stepBadge: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 12,
    letterSpacing: 1.2,
    color: "#4A403B",
    marginBottom: 16,
  },
  stepContainer: {
    marginBottom: 32,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  headline: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 24,
    lineHeight: 32,
    color: "#4A403B",
    marginBottom: 8,
  },
  subtext: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 15,
    color: "#4A403B",
    marginBottom: 24,
    lineHeight: 22,
  },
  logoSection: {
    marginBottom: 24,
  },
  logoPickerBox: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(69, 51, 50, 0.20)",
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
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
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 14,
    color: "#4A403B",
  },
  logoSubtext: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 12,
    color: "#4A403B",
  },
  logoUploadingWrap: {
    alignItems: "center",
    gap: 8,
  },
  logoUploadingText: {
    fontFamily: "InstrumentSans-Medium",
    fontSize: 13,
    color: "#4A403B",
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
    borderColor: "#453332",
  },
  logoChangeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#453332",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  logoChangeText: {
    fontFamily: "InstrumentSans-Medium",
    fontSize: 12,
    color: "#FFFDF9",
  },
  inputWrapper: {
    marginBottom: 20,
  },
  label: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 14,
    lineHeight: 20,
    color: "#4A403B",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(69, 51, 50, 0.3)",
    borderRadius: 14,
    height: 56,
    paddingHorizontal: 16,
    fontFamily: "InstrumentSans-Regular",
    fontSize: 14,
    color: "#4A403B",
    backgroundColor: "#FFFFFF",
  },
  charCount: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 11,
    color: "#4A403B",
    textAlign: "right",
    marginTop: 4,
  },
  pillsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "flex-start",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexBasis: "46%",
      flexGrow: 0,
    minHeight: 52,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillSelected: {
    backgroundColor: "#F96951",
    borderColor: "#F96951",
  },
  pillUnselected: {
    backgroundColor: "transparent",
    borderColor: "rgba(69, 51, 50, 0.35)",
  },
  pillTextSelected: {
    fontFamily: "InstrumentSans-Medium",
    fontSize: 14,
    color: "#FFFFFF",
    textAlign: "center",
  },
  pillTextUnselected: {
    fontFamily: "InstrumentSans-Medium",
    fontSize: 14,
    color: "#4A403B",
    textAlign: "center",
  },
  errorText: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 13,
    color: "#F96951",
    marginBottom: 16,
  },
  topBackHeader: {
    height: 40,
    justifyContent: "center",
    marginTop: 16,
    marginBottom: 12,
  },
  topBackPlaceholder: {
    height: 40,
  },
  topBackBtn: {
    width: 40,
    height: 40,
    
    
    
    alignItems: "center",
    justifyContent: "center",
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    marginBottom: 20,
  },
  nextBtn: {
    width: "100%",
    maxWidth: 380,
    alignSelf: "center",
    height: 58,
    borderRadius: 29,
    backgroundColor: "#F96951",
    alignItems: "center",
    justifyContent: "center",
  },
  nextBtnText: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 16,
    color: "#FFFDF9",
  },
  addSlotBtn: {
    width: "100%",
    maxWidth: 380,
    alignSelf: "center",
    height: 56,
    borderRadius: 28,
    backgroundColor: "#453332",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
    marginBottom: 20,
  },
  addSlotBtnText: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 16,
    color: "#FFFDF9",
  },
});

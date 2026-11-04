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
import { Check, Store, MapPin, Sparkles, Camera, UploadCloud, ArrowLeft, Calendar, Clock, Trash2, Plus } from "lucide-react-native";
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

type OnboardingSlot = {
  id: string;
  date: string;
  time: string;
  booked: boolean;
  label?: string;
};

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getUpcomingDate = (daysAhead: number) => {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return formatLocalDate(date);
};

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
  const [timezone, setTimezone] = useState<string>("Africa/Lagos");
  const [slotDurationMinutes, setSlotDurationMinutes] = useState<string>("60");

  const [loading, setLoading] = useState<boolean>(false);
  const [uploadingLogo, setUploadingLogo] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // Fitting slots state
  const [slotsList, setSlotsList] = useState<OnboardingSlot[]>([]);
  const [newSlotDate, setNewSlotDate] = useState<string>("");
  const [newSlotTime, setNewSlotTime] = useState<string>("");

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
          if (data.fashionHouse.timezone) setTimezone(data.fashionHouse.timezone);
          if (data.fashionHouse.slotDurationMinutes) setSlotDurationMinutes(String(data.fashionHouse.slotDurationMinutes));
          if (Array.isArray(data.fashionHouse.availableSlots)) {
            setSlotsList(data.fashionHouse.availableSlots);
          }
        }
      } catch (err) {
        console.warn("Could not pre-fill profile data:", err);
      }
    };

    loadProfile();
  }, []);

  const handleAddSlot = (dateStr?: string, timeStr?: string) => {
    const dateToUse = dateStr || newSlotDate.trim();
    const timeToUse = timeStr || newSlotTime.trim();

    if (!dateToUse || !timeToUse) {
      setError("Please enter both slot date and time.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateToUse) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(timeToUse)) {
      setError("Use YYYY-MM-DD for the date and HH:MM (24-hour time) for the time.");
      return;
    }
    if (slotsList.some((slot) => slot.date === dateToUse && slot.time === timeToUse)) {
      setError("That fitting slot has already been added.");
      return;
    }

    setError("");
    setSlotsList((prev) => [
      ...prev,
      { id: `new-${Date.now()}-${prev.length}`, date: dateToUse, time: timeToUse, booked: false },
    ]);
    if (!dateStr) setNewSlotDate("");
    if (!timeStr) setNewSlotTime("");
  };

  const handleDeleteSlot = (slotId: string) => {
    setSlotsList((prev) => prev.filter((slot) => slot.id !== slotId));
  };

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
    } else if (step === 3) {
      setStep(4);
    }
  };

  const handleSubmitOnboarding = async () => {
    setError("");
    if (slotsList.length === 0) {
      setError("Please add at least one fitting slot.");
      return;
    }
    const duration = Number(slotDurationMinutes);
    if (!timezone.trim() || !Number.isInteger(duration) || duration < 15 || duration > 480) {
      setError("Enter a valid timezone and a slot duration between 15 and 480 minutes.");
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
        availableSlots: slotsList.map(({ date, time }) => ({ date, time })),
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
        behavior={isLandscape ? undefined : Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 20}
        style={{ flex: 1 }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets={true}
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
            <View style={[styles.progressFill, { width: `${(step / 4) * 100}%` }]} />
          </View>

          {/* Back Arrow (shown on steps > 1) */}
          {step > 1 && (
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
                        <Camera size={12} color="#FFFFFF" />
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
                <Sparkles size={isLandscape ? 22 : 28} color="#453332" />
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

          {step === 4 && (
            <View style={[styles.stepContainer, isLandscape && { marginBottom: 16 }]}>
              <View style={[styles.iconCircle, isLandscape && { width: 44, height: 44, borderRadius: 22, marginBottom: 10 }]}>
                <Calendar size={isLandscape ? 22 : 28} color="#453332" />
              </View>
              <Text style={[styles.headline, isLandscape && { fontSize: 22, marginBottom: 4 }]}>Fitting & Booking Slots</Text>
              <Text style={[styles.subtext, isLandscape && { fontSize: 13, lineHeight: 18, marginBottom: 14 }]}>
                Set up appointment time slots for your AI assistant & clients to schedule consultations.
              </Text>

              {/* Quick Presets */}
              <Text style={[styles.label, { fontSize: 13, marginBottom: 8 }]}>Quick Preset Slots</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                {[
                  { date: getUpcomingDate(1), time: "10:00" },
                  { date: getUpcomingDate(2), time: "14:00" },
                  { date: getUpcomingDate(3), time: "11:00" },
                  { date: getUpcomingDate(4), time: "15:00" },
                ].map((preset, idx) => (
                  <Pressable
                    key={idx}
                    onPress={() => handleAddSlot(preset.date, preset.time)}
                    style={({ pressed }) => [
                      {
                        backgroundColor: "#FFFFFF",
                        borderWidth: 1,
                        borderColor: "rgba(74, 8, 12, 0.2)",
                        borderRadius: 20,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Plus size={14} color="#453332" />
                    <Text style={{ fontFamily: "InstrumentSans-Medium", fontSize: 12, color: "#3B0508" }}>
                      {preset.date} · {preset.time}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.label, { fontSize: 13, marginBottom: 8 }]}>Scheduling Rules</Text>
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
                <TextInput
                  style={{ flex: 2, backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: "rgba(74, 8, 12, 0.25)", height: 46, paddingHorizontal: 12, color: "#3B0508" }}
                  placeholder="Timezone, e.g. Africa/Lagos"
                  placeholderTextColor="#8A7550"
                  value={timezone}
                  onChangeText={setTimezone}
                  autoCapitalize="none"
                />
                <TextInput
                  style={{ flex: 1, backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: "rgba(74, 8, 12, 0.25)", height: 46, paddingHorizontal: 12, color: "#3B0508" }}
                  placeholder="Minutes"
                  placeholderTextColor="#8A7550"
                  value={slotDurationMinutes}
                  onChangeText={setSlotDurationMinutes}
                  keyboardType="number-pad"
                />
              </View>

              {/* Custom Slot Input */}
              <Text style={[styles.label, { fontSize: 13, marginBottom: 8 }]}>Add Custom Slot</Text>
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
                <View
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "#FFFFFF",
                    borderRadius: 12,
                    paddingHorizontal: 10,
                    height: 46,
                    borderWidth: 1,
                    borderColor: "rgba(74, 8, 12, 0.25)",
                  }}
                >
                  <Calendar size={14} color="#8A7550" style={{ marginRight: 6 }} />
                  <TextInput
                    disableFullscreenUI={true}
                    style={{ flex: 1, fontFamily: "InstrumentSans-Regular", fontSize: 13, color: "#3B0508" }}
                    placeholder="Date (YYYY-MM-DD)"
                    placeholderTextColor="#8A7550"
                    value={newSlotDate}
                    onChangeText={setNewSlotDate}
                  />
                </View>
                <View
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "#FFFFFF",
                    borderRadius: 12,
                    paddingHorizontal: 10,
                    height: 46,
                    borderWidth: 1,
                    borderColor: "rgba(74, 8, 12, 0.25)",
                  }}
                >
                  <Clock size={14} color="#8A7550" style={{ marginRight: 6 }} />
                  <TextInput
                    disableFullscreenUI={true}
                    style={{ flex: 1, fontFamily: "InstrumentSans-Regular", fontSize: 13, color: "#3B0508" }}
                    placeholder="Time (HH:MM)"
                    placeholderTextColor="#8A7550"
                    value={newSlotTime}
                    onChangeText={setNewSlotTime}
                  />
                </View>
              </View>

              <Pressable
                onPress={() => handleAddSlot()}
                style={({ pressed }) => [
                  {
                    backgroundColor: "#453332",
                    height: 44,
                    borderRadius: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    marginBottom: 16,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Plus size={16} color="#FFFFFF" />
                <Text style={{ fontFamily: "InstrumentSans-SemiBold", fontSize: 14, color: "#FFFFFF" }}>
                  Add Slot
                </Text>
              </Pressable>

              {/* Active Slots list */}
              {slotsList.length > 0 ? (
                <View style={{ marginTop: 4 }}>
                  <Text style={{ fontFamily: "InstrumentSans-SemiBold", fontSize: 13, color: "#453332", marginBottom: 8 }}>
                    Configured Fitting Slots ({slotsList.length})
                  </Text>
                  {slotsList.map((slot) => (
                    <View
                      key={slot.id}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        backgroundColor: "#FFFFFF",
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderRadius: 12,
                        marginBottom: 8,
                        borderWidth: 1,
                        borderColor: "rgba(0,0,0,0.06)",
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Calendar size={15} color="#453332" />
                        <Text style={{ fontFamily: "InstrumentSans-SemiBold", fontSize: 13, color: "#3B0508" }}>
                          {slot.label || `${slot.date} · ${slot.time}`}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => handleDeleteSlot(slot.id)}
                        disabled={slot.booked}
                        style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, padding: 4 }]}
                      >
                        {slot.booked ? (
                          <Text style={{ fontFamily: "InstrumentSans-Medium", fontSize: 12, color: "#8A7550" }}>
                            Booked
                          </Text>
                        ) : (
                          <Trash2 size={16} color="#D32F2F" />
                        )}
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>

        {/* Bottom Actions Pinned to Bottom */}
        <View style={[styles.actionRow, isLandscape && { paddingTop: 6, paddingBottom: 12 }]}>
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
    backgroundColor: "#FFFFFF",
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
    backgroundColor: "#453332",
    borderRadius: 2,
  },
  stepBadge: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 12,
    letterSpacing: 1.2,
    color: "#453332",
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
    fontFamily: "HedvigLettersSerif-Regular",
    fontSize: 28,
    color: "#3B0508",
    marginBottom: 8,
  },
  subtext: {
    fontFamily: "InstrumentSans-Regular",
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
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 14,
    color: "#3B0508",
  },
  logoSubtext: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 12,
    color: "rgba(74, 8, 12, 0.6)",
  },
  logoUploadingWrap: {
    alignItems: "center",
    gap: 8,
  },
  logoUploadingText: {
    fontFamily: "InstrumentSans-Medium",
    fontSize: 13,
    color: "#453332",
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
    backgroundColor: "#453332",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  logoChangeText: {
    fontFamily: "InstrumentSans-Medium",
    fontSize: 12,
    color: "#FFFFFF",
  },
  inputWrapper: {
    marginBottom: 20,
  },
  label: {
    fontFamily: "HedvigLettersSerif-Regular",
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
    fontFamily: "InstrumentSans-Regular",
    fontSize: 16,
    color: "#3B0508",
    backgroundColor: "#FFFFFF",
  },
  charCount: {
    fontFamily: "InstrumentSans-Regular",
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
    backgroundColor: "#453332",
    borderColor: "#453332",
  },
  pillUnselected: {
    backgroundColor: "transparent",
    borderColor: "rgba(74, 8, 12, 0.35)",
  },
  pillTextSelected: {
    fontFamily: "InstrumentSans-Medium",
    fontSize: 14,
    color: "#FFFFFF",
  },
  pillTextUnselected: {
    fontFamily: "InstrumentSans-Medium",
    fontSize: 14,
    color: "#3B0508",
  },
  errorText: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 13,
    color: "#D32F2F",
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
    backgroundColor: "#FFFFFF",
  },
  nextBtn: {
    width: "100%",
    maxWidth: 380,
    alignSelf: "center",
    height: 58,
    borderRadius: 29,
    backgroundColor: "#453332",
    alignItems: "center",
    justifyContent: "center",
  },
  nextBtnText: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
  },
});

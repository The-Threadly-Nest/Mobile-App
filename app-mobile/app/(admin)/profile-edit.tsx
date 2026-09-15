import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Upload, Check, Calendar, Clock, Trash2, Plus } from "lucide-react-native";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import { adminApi, slotsApi, AdminOnboardingPayload } from "@/shared/utils/apiClient";
import { uploadFile } from "@/shared/utils/upload";
import { useAuthStore } from "@/stores/useAuthStore";
import { PhoneInputWithCountry } from "@/shared/components/PhoneInputWithCountry";
import { useAppAlert } from "@/shared/hooks/useAppAlert";

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

export default function AdminProfileEditScreen() {
  const { showAlert } = useAppAlert();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [shopName, setShopName] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [turnaround, setTurnaround] = useState("2-3 week turnaround");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [brandLogoUrl, setBrandLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Fitting slots state
  const [slotsList, setSlotsList] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [newSlotDate, setNewSlotDate] = useState("");
  const [newSlotTime, setNewSlotTime] = useState("");
  const [addingSlot, setAddingSlot] = useState(false);

  const setStoreName = useAuthStore((s) => s.setName);
  const setStoredShopName = useAuthStore((s) => s.setShopName);

  const fetchSlots = async () => {
    setLoadingSlots(true);
    try {
      const data = await slotsApi.getSlots();
      if (Array.isArray(data)) {
        setSlotsList(data);
      }
    } catch (err) {
      console.warn("Could not fetch fitting slots:", err);
    } finally {
      setLoadingSlots(false);
    }
  };

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await adminApi.getProfile();
        if (res?.fashionHouse) {
          const house = res.fashionHouse;
          setShopName(house.shopName || house.name || "");
          setLocation(house.location || "");
          setPhone(house.phone || "");
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
    fetchSlots();
  }, []);

  const handleAddSlot = async (dateStr?: string, timeStr?: string) => {
    const dateToUse = dateStr || newSlotDate.trim();
    const timeToUse = timeStr || newSlotTime.trim();

    if (!dateToUse || !timeToUse) {
      showAlert("Missing Fields", "Please enter both date (e.g. Sat, 12 Sep) and time (e.g. 10:00 AM).");
      return;
    }
    setAddingSlot(true);
    try {
      const created = await slotsApi.createSlot(dateToUse, timeToUse);
      setSlotsList((prev) => [...prev, created]);
      if (!dateStr) setNewSlotDate("");
      if (!timeStr) setNewSlotTime("");
      showAlert("Slot Added", `Fitting slot for ${created.date} at ${created.time} is now available.`);
    } catch (err: any) {
      showAlert("Add Failed", err?.message || "Could not add fitting slot.");
    } finally {
      setAddingSlot(false);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    try {
      await slotsApi.deleteSlot(slotId);
      setSlotsList((prev) => prev.filter((s) => s.id !== slotId));
    } catch (err: any) {
      showAlert("Error", err?.message || "Could not delete slot.");
    }
  };

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

  const handleSave = async () => {
    if (!shopName.trim()) {
      showAlert("Required Field", "Please enter your business or shop name.");
      return;
    }

    setSaving(true);
    try {
      const combinedBio = turnaround.trim()
        ? (bio.trim() ? `${bio.trim()} • ${turnaround.trim()}` : turnaround.trim())
        : bio.trim();

      const payload: AdminOnboardingPayload = {
        shopName: shopName.trim(),
        location: location.trim(),
        phone: phone.trim(),
        bio: combinedBio,
        categories: selectedCategories,
        brandLogoUrl: brandLogoUrl || undefined,
      };

      await adminApi.completeOnboarding(payload);
      setStoredShopName(shopName.trim());

      showAlert("Success", "Your profile & business info have been updated.");
      setTimeout(() => router.push("/(admin)/settings" as any), 1400);
    } catch (err: any) {
      showAlert("Update Failed", err.message || "Could not update profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FBF7EF" }} edges={["top"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 20}
      >
        {/* Header */}
        <View
          style={{
            height: 52,
            paddingHorizontal: 20,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Pressable
            onPress={() => router.push("/(admin)/settings" as any)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
            }}
          >
            <BackArrowIcon size={20} color="#3B0508" />
          </Pressable>
          <Text
            style={{
              fontFamily: "Fraunces-SemiBold",
              fontSize: 20,
              color: "#3B0508",
            }}
          >
            Profile & Business Info
          </Text>
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color="#4A080C" size="large" />
          </View>
        ) : (
          <ScrollView
            automaticallyAdjustKeyboardInsets={true}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 36, paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Brand Logo Card */}
            <Text
              style={{
                fontFamily: "WorkSans_600SemiBold",
                fontSize: 13,
                color: "#4A080C",
                marginBottom: 8,
              }}
            >
              Brand Logo
            </Text>

            <Pressable
              onPress={handlePickLogo}
              style={{
                height: 120,
                backgroundColor: "#FFFFFF",
                borderRadius: 20,
                borderWidth: 1.5,
                borderColor: "rgba(74, 8, 12, 0.20)",
                borderStyle: "dashed",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 24,
                overflow: "hidden",
              }}
            >
              {uploadingLogo ? (
                <ActivityIndicator color="#4A080C" />
              ) : brandLogoUrl ? (
                <Image
                  source={{ uri: brandLogoUrl }}
                  style={{ width: "100%", height: "100%", resizeMode: "cover" }}
                />
              ) : (
                <View style={{ alignItems: "center" }}>
                  <Upload size={24} color="#8A7550" style={{ marginBottom: 6 }} />
                  <Text
                    style={{
                      fontFamily: "WorkSans_500Medium",
                      fontSize: 13,
                      color: "#8A7550",
                    }}
                  >
                    Tap to upload brand logo
                  </Text>
                </View>
              )}
            </Pressable>

            {/* Shop / Business Name */}
            <Text
              style={{
                fontFamily: "WorkSans_600SemiBold",
                fontSize: 13,
                color: "#4A080C",
                marginBottom: 8,
              }}
            >
              Business / Shop Name *
            </Text>
            <TextInput
              value={shopName}
              onChangeText={setShopName}
              placeholder="e.g. Royal Stitch Atelier"
              placeholderTextColor="#B0966C"
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 16,
                paddingHorizontal: 16,
                height: 52,
                fontFamily: "WorkSans_500Medium",
                fontSize: 15,
                color: "#3B0508",
                borderWidth: 1,
                borderColor: "rgba(0,0,0,0.08)",
                marginBottom: 20,
              }}
            />

            {/* Location */}
            <Text
              style={{
                fontFamily: "WorkSans_600SemiBold",
                fontSize: 13,
                color: "#4A080C",
                marginBottom: 8,
              }}
            >
              Location / City
            </Text>
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="e.g. Victoria Island, Lagos"
              placeholderTextColor="#B0966C"
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 16,
                paddingHorizontal: 16,
                height: 52,
                fontFamily: "WorkSans_500Medium",
                fontSize: 15,
                color: "#3B0508",
                borderWidth: 1,
                borderColor: "rgba(0,0,0,0.08)",
                marginBottom: 20,
              }}
            />

            {/* Phone */}
            <PhoneInputWithCountry
              label="Official Business Phone"
              placeholder="801 234 5678"
              value={phone}
              onChangePhone={setPhone}
            />

            {/* Standard Turnaround Time */}
            <Text
              style={{
                fontFamily: "WorkSans_600SemiBold",
                fontSize: 13,
                color: "#4A080C",
                marginBottom: 8,
              }}
            >
              Standard Turnaround Time
            </Text>
            <TextInput
              value={turnaround}
              onChangeText={setTurnaround}
              placeholder="e.g. 2-3 week turnaround"
              placeholderTextColor="#B0966C"
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 16,
                paddingHorizontal: 16,
                height: 52,
                fontFamily: "WorkSans_500Medium",
                fontSize: 15,
                color: "#3B0508",
                borderWidth: 1,
                borderColor: "rgba(0,0,0,0.08)",
                marginBottom: 20,
              }}
            />

            {/* Brand Bio / Motto */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  fontFamily: "WorkSans_600SemiBold",
                  fontSize: 13,
                  color: "#4A080C",
                }}
              >
                Brand Bio / Motto
              </Text>
              <Text
                style={{
                  fontFamily: "WorkSans_400Regular",
                  fontSize: 11,
                  color: "#8A7550",
                }}
              >
                {bio.length}/500
              </Text>
            </View>
            <TextInput
              value={bio}
              onChangeText={setBio}
              maxLength={500}
              multiline
              numberOfLines={2}
              placeholder="Briefly describe your fashion house specialization & craftsmanship style..."
              placeholderTextColor="#B0966C"
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 16,
                paddingHorizontal: 16,
                paddingVertical: 12,
                height: 60,
                fontFamily: "WorkSans_400Regular",
                fontSize: 14,
                color: "#3B0508",
                borderWidth: 1,
                borderColor: "rgba(0,0,0,0.08)",
                textAlignVertical: "top",
                marginBottom: 24,
              }}
            />

            {/* Specialization Pills (2 per row) */}
            <Text
              style={{
                fontFamily: "WorkSans_600SemiBold",
                fontSize: 13,
                color: "#4A080C",
                marginBottom: 12,
              }}
            >
              What do you specialize in?
            </Text>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
              {SPECIALIZATIONS.map((spec) => {
                const selected = selectedCategories.includes(spec);
                return (
                  <Pressable
                    key={spec}
                    onPress={() => toggleCategory(spec)}
                    style={{
                      width: "48%",
                      height: 52,
                      borderRadius: 26,
                      backgroundColor: selected ? "#4A080C" : "#FFFFFF",
                      borderWidth: selected ? 0 : 1,
                      borderColor: "rgba(0,0,0,0.1)",
                      alignItems: "center",
                      justifyContent: "center",
                      paddingHorizontal: 12,
                      flexDirection: "row",
                      gap: 6,
                    }}
                  >
                    {selected && <Check size={16} color="#FFFFFF" />}
                    <Text
                      numberOfLines={1}
                      style={{
                        fontFamily: "WorkSans_500Medium",
                        fontSize: 13,
                        color: selected ? "#FFFFFF" : "#3B0508",
                      }}
                    >
                      {spec}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Fitting Slots Management Section */}
            <View
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 20,
                padding: 18,
                borderWidth: 1,
                borderColor: "rgba(74, 8, 12, 0.12)",
                marginBottom: 24,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                <Calendar size={18} color="#4A080C" style={{ marginRight: 8 }} />
                <Text
                  style={{
                    fontFamily: "Fraunces-SemiBold",
                    fontSize: 16,
                    color: "#3B0508",
                  }}
                >
                  Fitting Slots & Availability
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: "WorkSans_400Regular",
                  fontSize: 12,
                  color: "#8A7550",
                  marginBottom: 14,
                }}
              >
                Configure open slots for AI assistant & client appointment bookings.
              </Text>

              {/* Input for new slot */}
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
                <View
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "#FBF7EF",
                    borderRadius: 12,
                    paddingHorizontal: 10,
                    height: 44,
                    borderWidth: 1,
                    borderColor: "rgba(0,0,0,0.08)",
                  }}
                >
                  <Calendar size={14} color="#8A7550" style={{ marginRight: 6 }} />
                  <TextInput
                    style={{ flex: 1, fontFamily: "WorkSans_400Regular", fontSize: 13, color: "#3B0508" }}
                    placeholder="Sat, 12 Sep"
                    placeholderTextColor="#B0966C"
                    value={newSlotDate}
                    onChangeText={setNewSlotDate}
                  />
                </View>
                <View
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "#FBF7EF",
                    borderRadius: 12,
                    paddingHorizontal: 10,
                    height: 44,
                    borderWidth: 1,
                    borderColor: "rgba(0,0,0,0.08)",
                  }}
                >
                  <Clock size={14} color="#8A7550" style={{ marginRight: 6 }} />
                  <TextInput
                    style={{ flex: 1, fontFamily: "WorkSans_400Regular", fontSize: 13, color: "#3B0508" }}
                    placeholder="10:00 AM"
                    placeholderTextColor="#B0966C"
                    value={newSlotTime}
                    onChangeText={setNewSlotTime}
                  />
                </View>
              </View>

              <Pressable
                onPress={() => handleAddSlot()}
                disabled={addingSlot}
                style={({ pressed }) => [
                  {
                    backgroundColor: "#4A080C",
                    height: 42,
                    borderRadius: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    marginBottom: 16,
                    opacity: pressed || addingSlot ? 0.85 : 1,
                  },
                ]}
              >
                {addingSlot ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Plus size={16} color="#FFFFFF" />
                    <Text style={{ fontFamily: "WorkSans_600SemiBold", fontSize: 13, color: "#FFFFFF" }}>
                      Add Slot
                    </Text>
                  </>
                )}
              </Pressable>

              {/* Active Slots list */}
              <Text
                style={{
                  fontFamily: "WorkSans_600SemiBold",
                  fontSize: 13,
                  color: "#4A080C",
                  marginBottom: 10,
                }}
              >
                Configured Slots ({slotsList.length})
              </Text>

              {loadingSlots ? (
                <ActivityIndicator color="#4A080C" style={{ marginVertical: 12 }} />
              ) : slotsList.length === 0 ? (
                <Text style={{ fontFamily: "WorkSans_400Regular", fontSize: 13, color: "#8A7550", textAlign: "center", marginVertical: 12 }}>
                  No fitting slots added yet. Add your first slot above.
                </Text>
              ) : (
                slotsList.map((slot) => (
                  <View
                    key={slot.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor: "#FBF7EF",
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderRadius: 12,
                      marginBottom: 8,
                      borderWidth: 1,
                      borderColor: "rgba(0,0,0,0.06)",
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Calendar size={15} color="#4A080C" />
                      <Text style={{ fontFamily: "WorkSans_600SemiBold", fontSize: 13, color: "#3B0508" }}>
                        {slot.date} · {slot.time}
                      </Text>
                      {slot.booked ? (
                        <View style={{ backgroundColor: "#FDE8E8", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ fontFamily: "WorkSans_600SemiBold", fontSize: 10, color: "#D32F2F" }}>Booked</Text>
                        </View>
                      ) : (
                        <View style={{ backgroundColor: "#E8F5E9", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ fontFamily: "WorkSans_600SemiBold", fontSize: 10, color: "#2E7D32" }}>Available</Text>
                        </View>
                      )}
                    </View>

                    <Pressable
                      onPress={() => handleDeleteSlot(slot.id)}
                      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, padding: 4 }]}
                    >
                      <Trash2 size={16} color="#D32F2F" />
                    </Pressable>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        )}

        {/* Pinned Bottom Action Button */}
        <View
          style={{
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
          }}
        >
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => [
              {
                height: 56,
                borderRadius: 28,
                backgroundColor: "#4A080C",
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed || saving ? 0.85 : 1,
              },
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text
                style={{
                  fontFamily: "WorkSans_600SemiBold",
                  fontSize: 16,
                  color: "#FFFFFF",
                }}
              >
                Save Changes
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

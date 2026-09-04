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
import { Upload, Check } from "lucide-react-native";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import { adminApi, AdminOnboardingPayload } from "@/shared/utils/apiClient";
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

  const setStoreName = useAuthStore((s) => s.setName);
  const setStoredShopName = useAuthStore((s) => s.setShopName);

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
            borderBottomWidth: 1,
            borderBottomColor: "rgba(0,0,0,0.05)",
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
            contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 100 }}
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

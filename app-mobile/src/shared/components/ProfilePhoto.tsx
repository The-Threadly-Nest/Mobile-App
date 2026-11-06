import React, { useEffect, useState } from "react";
import { View, Text, Image, Pressable, ActivityIndicator } from "react-native";
import { Camera } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";
import { useAuthStore } from "@/stores/useAuthStore";
import { uploadFile } from "@/shared/utils/upload";
import { useAppAlert } from "@/shared/hooks/useAppAlert";
import { apiFetch, ApiError } from "@/shared/utils/apiClient";

const STORAGE_KEY = "owuja.profilePhoto";
export function ProfilePhoto() {
  const name = useAuthStore(s => s.name);
  const email = useAuthStore(s => s.email);
  const role = useAuthStore(s => s.role);
  const owner = `${role}:${email.trim().toLowerCase()}`;
  const [photo, setPhoto] = useState<{ owner: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const { showAlert } = useAppAlert();
  useEffect(() => {
    let active = true;
    setPhoto(null);
    async function loadPhoto() {
      const cached = await SecureStore.getItemAsync(STORAGE_KEY).catch(() => null);
      if (active && cached) {
        try { const saved = JSON.parse(cached); if (saved.owner === owner && typeof saved.url === "string") setPhoto(saved); } catch {}
      }
      try {
        const profile = await apiFetch<{ photoUrl: string | null }>("/api/preferences", { silent: true });
        if (!active) return;
        const saved = profile.photoUrl ? { owner, url: profile.photoUrl } : null;
        setPhoto(saved);
        if (saved) await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(saved));
        else await SecureStore.deleteItemAsync(STORAGE_KEY);
      } catch (error) {
        if (active && error instanceof ApiError && error.details.status === 404) setPhoto(null);
      }
    }
    void loadPhoto();
    return () => { active = false; };
  }, [owner]);
  async function choosePhoto() {
    if (busy) return;
    setBusy(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { showAlert("Photo access needed", "Allow photo library access to choose your profile picture."); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const uploaded = await uploadFile(asset.uri, asset.fileName || `profile_${Date.now()}.jpg`, asset.mimeType || "image/jpeg");
      const current = useAuthStore.getState();
      if (`${current.role}:${current.email.trim().toLowerCase()}` !== owner) return;
      const profile = await apiFetch<{ photoUrl: string }>("/api/preferences", {
        method: "POST", body: JSON.stringify({ photoKey: uploaded.key }), silent: true,
      });
      if (typeof profile.photoUrl !== "string" || !profile.photoUrl.startsWith("https://")) {
        throw new Error("The server hasn't enabled profile photos yet. Please update the backend and try again.");
      }
      if (`${useAuthStore.getState().role}:${useAuthStore.getState().email.trim().toLowerCase()}` !== owner) return;
      const saved = { owner, url: profile.photoUrl };
      setPhoto(saved);
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(saved)).catch(() => {});
    } catch (error) {
      showAlert("Photo upload failed", error instanceof Error ? error.message : "We couldn't save your photo. Please check your connection and try again.");
    } finally { setBusy(false); }
  }
  const displayName = name.trim() || email.split("@")[0] || "Your profile";
  return <View style={{ alignItems: "center", marginTop: 16, marginBottom: 12 }}>
    <Pressable onPress={choosePhoto} disabled={busy} accessibilityRole="button" accessibilityLabel="Upload profile photo"
      accessibilityState={{ disabled: busy, busy }} style={{ width: 88, height: 88 }}>
      <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: "#F6F6F6", overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
        {busy ? <ActivityIndicator color="#453332" /> : photo?.owner === owner
          ? <Image source={{ uri: photo.url }} style={{ width: 88, height: 88 }} resizeMode="cover" />
          : <Text style={{ fontFamily: "InstrumentSans-SemiBold", fontSize: 30, color: "#453332" }}>{displayName.charAt(0).toUpperCase()}</Text>}
      </View>
      <View style={{ position: "absolute", right: -2, bottom: 0, backgroundColor: "#453332", borderRadius: 16, width: 32, height: 32, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "white" }}>
        <Camera size={16} color="white" />
      </View>
    </Pressable>
    <Text style={{ fontFamily: "InstrumentSans-SemiBold", fontSize: 20, color: "#453332", marginTop: 12, textAlign: "center" }}>{displayName}</Text>
  </View>;
}

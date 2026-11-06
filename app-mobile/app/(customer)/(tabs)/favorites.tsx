import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, Image, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Heart } from "lucide-react-native";
import { apiFetch, ApiError } from "@/shared/utils/apiClient";

type SavedItem = { id: string; name: string; imageUrl: string; priceFrom: number | null };
type SavedProfile = { savedCatalogIds: string[]; savedItems: SavedItem[] };

export default function FavoritesScreen() {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [ids, setIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const busy = React.useRef(false);

  const load = useCallback(async (active: () => boolean = () => true) => {
    setRefreshing(true); setError("");
    try {
      const profile = await apiFetch<SavedProfile>("/api/preferences", { silent: true });
      if (!active()) return;
      if (!Array.isArray(profile.savedItems)) throw new Error("Favorites needs the updated backend. Please deploy it and try again.");
      setItems(profile.savedItems);
      setIds(profile.savedItems.map(item => item.id));
    } catch (err) {
      if (!active()) return;
      if (err instanceof ApiError && err.details.status === 404) { setItems([]); setIds([]); }
      else setError(err instanceof Error ? err.message : "We couldn't load your favorites. Please try again.");
    } finally { if (active()) { setLoading(false); setRefreshing(false); } }
  }, []);
  useFocusEffect(useCallback(() => {
    let active = true;
    void load(() => active);
    return () => { active = false; };
  }, [load]));

  async function remove(id: string) {
    if (busy.current) return;
    busy.current = true; setSaving(true); setError("");
    try {
      const profile = await apiFetch<SavedProfile>("/api/preferences", {
        method: "POST", body: JSON.stringify({ savedCatalogIds: ids.filter(saved => saved !== id) }), silent: true,
      });
      if (!Array.isArray(profile.savedItems)) throw new Error("Favorites needs the updated backend. Please deploy it and try again.");
      setItems(profile.savedItems); setIds(profile.savedItems.map(item => item.id));
    } catch (err) { setError(err instanceof Error ? err.message : "We couldn't remove this item. Please try again."); }
    finally { busy.current = false; setSaving(false); }
  }

  return <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: "white" }}>
    <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 120, gap: 14 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load(); }} tintColor="#453332" />}>
      <Text accessibilityRole="header" style={{ fontFamily: "InstrumentSans-SemiBold", fontSize: 24, color: "#453332", textAlign: "center", marginBottom: 12 }}>Favorites</Text>
      {error ? <Pressable onPress={() => { void load(); }}><Text style={{ color: "#9F1239" }}>{error} Tap to retry.</Text></Pressable> : null}
      {loading ? <ActivityIndicator color="#453332" /> : !items.length && !error ? <View style={{ alignItems: "center", paddingVertical: 40, gap: 16 }}>
        <Heart size={36} color="#F96951" />
        <Text style={{ fontFamily: "InstrumentSans-Regular", color: "#646464", textAlign: "center" }}>Save items with the heart in Discover to find them here.</Text>
      </View> : null}
      {items.map(item => <View key={item.id} style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F6F6F6", borderRadius: 15, padding: 14, gap: 12 }}>
        <Pressable onPress={() => router.push({ pathname: "/(customer)/catalog/[id]", params: { id: item.id } })}
          accessibilityRole="button" accessibilityLabel={`View ${item.name}`} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 14 }}>
          <Image source={{ uri: item.imageUrl }} style={{ width: 64, height: 78, borderRadius: 10 }} resizeMode="cover" />
          <Text style={{ flex: 1, fontFamily: "InstrumentSans-Regular", fontSize: 16, color: "#453332" }}>{item.name}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.name} from favorites`} disabled={saving}
          onPress={() => { void remove(item.id); }} style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", opacity: saving ? 0.5 : 1 }}>
          <Heart size={22} color="#F96951" fill="#F96951" />
        </Pressable>
      </View>)}
    </ScrollView>
  </SafeAreaView>;
}

import React, { useState, useEffect } from "react";
import {
  View,
  FlatList,
  Pressable,
  Text,
  Image,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { ArrowLeft, Sparkles, CheckCircle2, PenTool } from "lucide-react-native";
import { Headline, Subtext } from "@/shared/components/Headline";
import { Input } from "@/shared/components/Input";
import { Button } from "@/shared/components/Button";
import { useAuthStore } from "@/stores/useAuthStore";
import { API_BASE_URL } from "@/api/config";
import { useAppAlert } from "@/shared/hooks/useAppAlert";

interface Sketch {
  id: string;
  title: string;
  imageUrl: string;
  promotedToCatalog: boolean;
  createdAt: string;
}

export default function AdminStaffMoodBoardScreen() {
  const { showAlert } = useAppAlert();
  const params = useLocalSearchParams<{ staffId: string; staffName?: string }>();
  const { staffId, staffName } = params;
  
  const [sketches, setSketches] = useState<Sketch[]>([]);
  const [loading, setLoading] = useState(false);
  const [promotingId, setPromotingId] = useState<string | null>(null);

  // Modal state for price input during promotion
  const [selectedSketch, setSelectedSketch] = useState<Sketch | null>(null);
  const [priceFrom, setPriceFrom] = useState("");
  const [customName, setCustomName] = useState("");
  const [error, setError] = useState("");

  const token = useAuthStore((s) => s.token);

  const fetchStaffSketches = async () => {
    if (!token || !staffId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/moodboard/staff/${staffId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setSketches(data);
      } else {
        console.error("Error loading staff sketches:", data.error);
      }
    } catch (e) {
      console.error("Failed to fetch staff sketches", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaffSketches();
  }, [staffId, token]);

  const openPromoteModal = (sketch: Sketch) => {
    setSelectedSketch(sketch);
    setCustomName(sketch.title);
    setPriceFrom("");
    setError("");
  };

  const handlePromoteToCatalog = async () => {
    if (!selectedSketch) return;
    
    setPromotingId(selectedSketch.id);
    setError("");

    try {
      const numPrice = priceFrom ? parseInt(priceFrom, 10) : 0;
      if (isNaN(numPrice) || numPrice < 0) {
        setError("Please enter a valid price.");
        setPromotingId(null);
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/moodboard/${selectedSketch.id}/promote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          priceFrom: numPrice,
          name: customName.trim() || selectedSketch.title,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Could not promote sketch to catalog.");
      }

      // Update local state to show promoted status
      setSketches((prev) =>
        prev.map((s) => (s.id === selectedSketch.id ? { ...s, promotedToCatalog: true } : s))
      );

      showAlert("Success", `"${selectedSketch.title}" was promoted to your public Catalog!`);
      setSelectedSketch(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPromotingId(null);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center px-5 pt-4 pb-2 gap-3">
        <Pressable
          onPress={() => router.push("/(admin)/staff" as any)}
          className="w-10 h-10 border border-oxblood/20 rounded-full items-center justify-center"
        >
          <ArrowLeft size={20} color="#3B0508" />
        </Pressable>
        <View className="flex-1">
          <Headline className="text-xl">{staffName ? `${staffName}'s Moodboard` : "Staff Moodboard"}</Headline>
          <Subtext className="text-xs">Promote private sketches to your public catalog</Subtext>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#4A080C" />
        </View>
      ) : (
        <FlatList
          data={sketches}
          keyExtractor={(i) => i.id}
          numColumns={2}
          contentContainerStyle={{ padding: 16 }}
          columnWrapperStyle={{ gap: 12 }}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-20">
              <PenTool size={36} color="#A6926B" />
              <Text className="font-body text-grey700 text-sm mt-3 text-center">
                This staff member has not uploaded any sketches yet.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="flex-1 mb-4 border border-grey100 bg-white rounded-xl overflow-hidden aspect-square">
              <Image source={{ uri: item.imageUrl }} className="w-full h-3/5" style={{ resizeMode: "cover" }} />
              
              <View className="h-2/5 bg-white px-2 justify-between py-2">
                <Text className="font-body-semibold text-ink text-xs text-center" numberOfLines={1}>
                  {item.title}
                </Text>

                {item.promotedToCatalog ? (
                  <View className="bg-oxblood/10 py-1.5 px-2 rounded-lg flex-row items-center justify-center gap-1">
                    <CheckCircle2 size={12} color="#4A080C" />
                    <Text className="font-body-semibold text-oxblood text-[10px]">In Catalog</Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => openPromoteModal(item)}
                    className="bg-oxblood py-1.5 px-2 rounded-lg flex-row items-center justify-center gap-1"
                  >
                    <Sparkles size={12} color="#C4A763" />
                    <Text className="font-body-semibold text-cream text-[10px]">Promote</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}
        />
      )}

      {/* Promotion Price Modal */}
      <Modal visible={!!selectedSketch} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-cream rounded-t-3xl p-6">
            <Headline className="text-xl text-oxblood mb-1">Promote to Catalog</Headline>
            <Subtext className="text-xs mb-4">
              Add this sketch to your public Fashion House catalog for customers to view.
            </Subtext>

            <Input
              placeholder="Item Name in Catalog"
              value={customName}
              onChangeText={setCustomName}
            />

            <Input
              placeholder="Starting Price (NGN e.g. 75000)"
              value={priceFrom}
              onChangeText={setPriceFrom}
              keyboardType="number-pad"
            />

            {error ? (
              <Text className="font-body text-red-500 text-xs mb-3">{error}</Text>
            ) : null}

            <View className="mt-2 gap-3">
              <Button
                label={promotingId ? "Promoting..." : "Confirm & Add to Catalog"}
                onPress={handlePromoteToCatalog}
                loading={!!promotingId}
              />
              <Pressable onPress={() => setSelectedSketch(null)} className="py-2">
                <Text className="font-body text-center text-grey700 text-sm">Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

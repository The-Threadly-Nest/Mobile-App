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
import { Sparkles, CheckCircle2, PenTool } from "lucide-react-native";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import { Headline, Subtext } from "@/shared/components/Headline";
import { Input } from "@/shared/components/Input";
import { Button } from "@/shared/components/Button";
import { useAuthStore } from "@/stores/useAuthStore";
import { apiFetch } from "@/shared/utils/apiClient";
import { useAppAlert } from "@/shared/hooks/useAppAlert";
import { SCREEN_TOP_SPACING } from "@/shared/utils/screenSpacing";

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
  const [loading, setLoading] = useState(true);
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
      setSketches(await apiFetch<Sketch[]>(`/api/moodboard/staff/${staffId}`, { silent: true }));
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

      await apiFetch(`/api/moodboard/${selectedSketch.id}/promote`, {
        method: "POST",
        body: JSON.stringify({
          priceFrom: numPrice,
          name: customName.trim() || selectedSketch.title,
        }),
      });

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
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Header */}
      <View style={{ paddingTop: SCREEN_TOP_SPACING, paddingBottom: 16 }} className="flex-row items-center px-5 gap-3">
        <Pressable
          onPress={() => router.push("/(admin)/staff" as any)}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: "rgba(74, 8, 12, 0.25)",
            backgroundColor: "#FFFFFF",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 4,
          }}
        >
          <BackArrowIcon size={18} color="#3B0508" />
        </Pressable>
        <View className="flex-1">
          <Text
            style={{
              fontFamily: "HedvigLettersSerif-Regular",
              fontSize: 24,
              lineHeight: 28,
              color: "#000000",
              letterSpacing: -0.2,
            }}
          >
            {staffName ? `${staffName}'s Moodboard` : "Staff Moodboard"}
          </Text>
          <Subtext className="text-xs">Promote private sketches to your public catalog</Subtext>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#453332" />
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
              <Text className="font-body text-black text-sm mt-3 text-center">
                This staff member has not uploaded any sketches yet.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="flex-1 mb-4 border border-grey100 bg-white rounded-xl overflow-hidden aspect-square">
              <Image source={{ uri: item.imageUrl }} className="w-full h-3/5" style={{ resizeMode: "cover" }} />
              
              <View className="h-2/5 bg-white px-2 justify-between py-2">
                <Text className="font-body-semibold text-black text-xs text-center" numberOfLines={1}>
                  {item.title}
                </Text>

                {item.promotedToCatalog ? (
                  <View className="bg-oxblood/10 py-1.5 px-2 rounded-lg flex-row items-center justify-center gap-1">
                    <CheckCircle2 size={12} color="#453332" />
                    <Text className="font-body-semibold text-black text-[10px]">In Catalog</Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => openPromoteModal(item)}
                    className="bg-tomato py-1.5 px-2 rounded-lg flex-row items-center justify-center gap-1"
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
          <View className="bg-white rounded-t-3xl p-6">
            <Headline className="text-xl text-black mb-1">Promote to Catalog</Headline>
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
                <Text className="font-body text-center text-black text-sm">Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

import React, { useState, useEffect } from "react";
import { View, FlatList, Pressable, Text, Modal, Image, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Plus, PenTool, X } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { Headline, Subtext } from "@/shared/components/Headline";
import { Input } from "@/shared/components/Input";
import { Button } from "@/shared/components/Button";
import { useAuthStore } from "@/stores/useAuthStore";
import { uploadFile } from "@/shared/utils/upload";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

interface Sketch {
  id: string;
  title: string;
  imageUrl: string;
  createdAt: string;
}

export default function MoodBoardScreen() {
  const [sketches, setSketches] = useState<Sketch[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");

  const token = useAuthStore((s) => s.token);

  const fetchSketches = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/sketches`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setSketches(data);
      }
    } catch (e) {
      console.error("Failed to fetch sketches", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSketches();
  }, [token]);

  const handlePickImage = async () => {
    setError("");
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      alert("Permission to access camera roll is required!");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setSelectedUri(asset.uri);
      setTitle("");
      setModalVisible(true);
    }
  };

  const handleUploadSketch = async () => {
    if (!selectedUri || !title.trim()) {
      setError("Please provide a title for your sketch.");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const filename = selectedUri.split("/").pop() || "sketch.jpg";
      let ext = filename.split(".").pop()?.toLowerCase() || "jpg";
      if (ext === "jpeg") ext = "jpg";
      const contentType = `image/${ext === "png" ? "png" : ext === "gif" ? "gif" : "jpeg"}`;

      // 1. Upload to storage
      const uploadResult = await uploadFile(selectedUri, filename, contentType);

      // 2. Save sketch to backend DB
      const res = await fetch(`${API_BASE_URL}/api/sketches`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          imageUrl: uploadResult.fileUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to save sketch to database.");
      }

      setSketches((prev) => [data, ...prev]);
      setModalVisible(false);
      setSelectedUri(null);
      setTitle("");
    } catch (e: any) {
      setError(e.message ?? "Something went wrong during upload.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row justify-between items-center px-5 pt-4 pb-2">
        <Headline className="text-2xl">My Mood Board</Headline>
        <Pressable
          onPress={handlePickImage}
          className="w-10 h-10 bg-oxblood rounded-full items-center justify-center"
        >
          <Plus size={20} color="#FBF7EF" />
        </Pressable>
      </View>
      <Subtext className="text-xs px-5 mb-4">Private sketches — Admin can move any into the public catalog</Subtext>

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
                No sketches uploaded yet. Tap the + icon to upload.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="flex-1 mb-4 border border-grey100 bg-white rounded-xl overflow-hidden aspect-square">
              <Image source={{ uri: item.imageUrl }} className="w-full h-3/4" style={{ resizeMode: "cover" }} />
              <View className="h-1/4 bg-white px-2 justify-center">
                <Text className="font-body text-ink text-xs text-center" numberOfLines={1}>
                  {item.title}
                </Text>
              </View>
            </View>
          )}
        />
      )}

      {/* Upload Preview Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-cream rounded-t-3xl p-6 min-h-[50%]">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="font-display text-oxblood text-lg">New Moodboard Sketch</Text>
              <Pressable onPress={() => setModalVisible(false)} className="p-1">
                <X size={20} color="#4A080C" />
              </Pressable>
            </View>

            {selectedUri && (
              <View className="items-center mb-4">
                <Image source={{ uri: selectedUri }} className="w-40 h-40 rounded-xl" />
              </View>
            )}

            <Input
              placeholder="Sketch Title (e.g. Draped Evening Dress)"
              value={title}
              onChangeText={setTitle}
            />

            {error ? (
              <Text className="font-body text-red-500 text-xs mb-3">{error}</Text>
            ) : null}

            <View className="mt-4">
              <Button
                label={uploading ? "Uploading..." : "Add to Moodboard"}
                onPress={handleUploadSketch}
                loading={uploading}
                disabled={!title.trim() || uploading}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

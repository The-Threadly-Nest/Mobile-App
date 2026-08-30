import React, { useState, useEffect } from "react";
import { View, FlatList, Pressable, Text, Modal, Image, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Plus, PenTool, X, Trash2, CheckCircle, Paintbrush } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { Headline, Subtext } from "@/shared/components/Headline";
import { Input } from "@/shared/components/Input";
import { Button } from "@/shared/components/Button";
import DrawingCanvasModal from "@/shared/components/DrawingCanvasModal";
import { useAuthStore } from "@/stores/useAuthStore";
import { uploadFile } from "@/shared/utils/upload";
import { API_BASE_URL } from "@/api/config";

interface Sketch {
  id: string;
  title: string;
  imageUrl: string;
  promotedToCatalog?: boolean;
  createdAt: string;
}

export default function MoodBoardScreen() {
  const [sketches, setSketches] = useState<Sketch[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [canvasModalVisible, setCanvasModalVisible] = useState(false);
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");

  const token = useAuthStore((s) => s.token);

  const fetchSketches = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/moodboard`, {
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
      mediaTypes: ["images"],
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

  const handleSaveDrawing = async (svgDataUri: string, drawingTitle: string) => {
    try {
      const filename = `drawing-${Date.now()}.svg`;
      const contentType = "image/svg+xml";

      // 1. Upload SVG data URI to R2 storage
      const uploadResult = await uploadFile(svgDataUri, filename, contentType);

      // 2. Save sketch metadata to backend DB
      const res = await fetch(`${API_BASE_URL}/api/moodboard`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: drawingTitle,
          imageUrl: uploadResult.fileUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to save drawing to database.");
      }

      setSketches((prev) => [data, ...prev]);
    } catch (e: any) {
      alert(e.message ?? "Could not save drawing.");
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

      // 1. Upload to storage (Cloudflare R2 / S3)
      const uploadResult = await uploadFile(selectedUri, filename, contentType);

      // 2. Save sketch to backend DB
      const res = await fetch(`${API_BASE_URL}/api/moodboard`, {
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

  const handleDeleteSketch = (id: string, itemTitle: string) => {
    Alert.alert(
      "Delete Sketch",
      `Are you sure you want to delete "${itemTitle}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await fetch(`${API_BASE_URL}/api/moodboard/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              });
              if (res.ok) {
                setSketches((prev) => prev.filter((s) => s.id !== id));
              } else {
                const data = await res.json();
                alert(data.error ?? "Could not delete sketch.");
              }
            } catch (e) {
              console.error("Failed to delete sketch", e);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row justify-between items-center px-5 pt-4 pb-2">
        <Headline className="text-2xl">My Mood Board</Headline>
        
        {/* Action Buttons: Draw Canvas & Pick Photo */}
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => setCanvasModalVisible(true)}
            className="flex-row items-center bg-oxblood/10 border border-oxblood/30 px-3 py-2 rounded-full gap-1.5"
          >
            <Paintbrush size={14} color="#4A080C" />
            <Text className="font-body-semibold text-oxblood text-xs">Draw</Text>
          </Pressable>

          <Pressable
            onPress={handlePickImage}
            className="w-9 h-9 bg-oxblood rounded-full items-center justify-center"
          >
            <Plus size={18} color="#FBF7EF" />
          </Pressable>
        </View>
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
            <View className="flex-1 mb-4 border border-grey100 bg-white rounded-xl overflow-hidden aspect-square relative">
              <Image source={{ uri: item.imageUrl }} className="w-full h-3/4" style={{ resizeMode: "cover" }} />
              
              {/* Promoted Badge */}
              {item.promotedToCatalog && (
                <View className="absolute top-2 left-2 bg-oxblood/90 px-2 py-1 rounded-full flex-row items-center gap-1">
                  <CheckCircle size={10} color="#C4A763" />
                  <Text className="font-body text-[10px] text-cream">Promoted</Text>
                </View>
              )}

              {/* Delete Button */}
              <Pressable
                onPress={() => handleDeleteSketch(item.id, item.title)}
                className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full items-center justify-center"
              >
                <Trash2 size={14} color="#FFFFFF" />
              </Pressable>

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

      {/* Interactive Sketchpad Drawing Canvas Modal */}
      <DrawingCanvasModal
        visible={canvasModalVisible}
        onClose={() => setCanvasModalVisible(false)}
        onSave={handleSaveDrawing}
      />
    </SafeAreaView>
  );
}

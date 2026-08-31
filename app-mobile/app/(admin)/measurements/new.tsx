import React, { useState } from "react";
import { View, ScrollView, Pressable, Text, Image, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft, Mic, UploadCloud, Trash2, FileText } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { Headline } from "@/shared/components/Headline";
import { Input } from "@/shared/components/Input";
import { Button } from "@/shared/components/Button";
import { uploadFile } from "@/shared/utils/upload";

const FIELDS = ["Shoulder", "Chest", "Sleeve", "Waist", "Hip", "Inseam"];

export default function NewMeasurementScreen() {
  const [customerName, setCustomerName] = useState("");
  const [voiceMode, setVoiceMode] = useState(false);
  const [sheetUri, setSheetUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handlePickSheet = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      alert("Permission to access camera roll is required!");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setSheetUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!customerName.trim()) {
      alert("Customer name is required.");
      return;
    }

    setUploading(true);
    try {
      let finalUrl = null;
      if (sheetUri) {
        const filename = sheetUri.split("/").pop() || "measurement_sheet.jpg";
        let ext = filename.split(".").pop()?.toLowerCase() || "jpg";
        if (ext === "jpeg") ext = "jpg";
        const contentType = `image/${ext === "png" ? "png" : "jpeg"}`;
        
        const uploadResult = await uploadFile(sheetUri, filename, contentType);
        finalUrl = uploadResult.fileUrl;
      }
      
      alert(sheetUri ? "Measurement and physical sheet uploaded successfully!" : "Measurement saved!");
      router.back();
    } catch (e: any) {
      alert(e.message ?? "Failed to upload measurement sheet.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-4 pb-2">
        <Pressable onPress={() => router.back()} className="mr-3">
          <ChevronLeft size={24} color="#4A080C" />
        </Pressable>
        <Text style={{ fontFamily: "WorkSans_500Medium", fontSize: 20, color: "#3B0508" }}>New Measurement</Text>
      </View>

      <ScrollView className="flex-1 px-5">
        <Input 
          placeholder="Customer name" 
          value={customerName} 
          onChangeText={setCustomerName} 
        />

        <View className="bg-white border border-grey100 rounded-xl p-4 mb-4">
          <Text className="font-body-semibold text-oxblood text-sm mb-2">Physical Measurement Sheet</Text>
          <Text className="font-body text-grey700 text-xs mb-3">
            Optionally upload a photo or scan of the paper measurement sheet.
          </Text>

          {sheetUri ? (
            <View className="flex-row items-center justify-between border border-grey100 rounded-lg p-2 bg-cream/50">
              <View className="flex-row items-center flex-1 mr-2">
                <Image source={{ uri: sheetUri }} className="w-12 h-12 rounded mr-2" />
                <Text className="font-body text-ink text-xs flex-1" numberOfLines={1}>
                  {sheetUri.split("/").pop() || "sheet_image.jpg"}
                </Text>
              </View>
              <Pressable onPress={() => setSheetUri(null)} className="p-2">
                <Trash2 size={16} color="#4A080C" />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={handlePickSheet}
              className="flex-row items-center justify-center border border-dashed border-grey700 rounded-lg py-4 bg-cream/20"
            >
              <UploadCloud size={20} color="#8A7550" />
              <Text className="font-body-semibold text-grey700 text-xs ml-2">Choose Image / Take Photo</Text>
            </Pressable>
          )}
        </View>

        <View className="flex-row justify-between items-center mt-2 mb-3">
          <Text className="font-body-semibold text-ink text-sm">Individual Fields</Text>
          <Pressable
            onPress={() => setVoiceMode((v) => !v)}
            className={`flex-row items-center px-3 py-2 rounded-pill ${voiceMode ? "bg-oxblood" : "bg-white border border-oxblood"}`}
          >
            <Mic size={14} color={voiceMode ? "#FBF7EF" : "#4A080C"} />
            <Text className={`font-body-semibold ml-1.5 text-xs ${voiceMode ? "text-cream" : "text-oxblood"}`}>
              {voiceMode ? "Voice On" : "Use Voice"}
            </Text>
          </Pressable>
        </View>

        {voiceMode ? (
          <View className="border border-oxblood border-dashed rounded-xl p-6 items-center mb-4">
            <Mic size={26} color="#4A080C" />
            <Text className="font-body text-grey700 text-sm text-center mt-2">
              Tap to record — say measurements like "shoulder sixteen, chest thirty-eight"
            </Text>
          </View>
        ) : (
          FIELDS.map((f) => <Input key={f} placeholder={f} keyboardType="numeric" />)
        )}

        <View className="mt-4 mb-8">
          <Button 
            label={uploading ? "Saving..." : "Save Measurement"} 
            onPress={handleSave} 
            loading={uploading}
            disabled={uploading}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

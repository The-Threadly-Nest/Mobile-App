import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { Plus, Trash2, Check } from "lucide-react-native";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import { useAudioRecorder, AudioModule, RecordingPresets } from "expo-audio";
import { apiFetch } from "@/shared/utils/apiClient";
import { useAppAlert } from "@/shared/hooks/useAppAlert";

function RecordVoiceIcon({ color = "#4A080C" }: { color?: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 19C15.31 19 18 16.31 18 13V8C18 4.69 15.31 2 12 2C8.69 2 6 4.69 6 8V13C6 16.31 8.69 19 12 19Z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3 11V13C3 17.97 7.03 22 12 22C16.97 22 21 17.97 21 13V11"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9.10986 7.47993C10.8899 6.82993 12.8299 6.82993 14.6099 7.47993"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10.0298 10.4799C11.2298 10.1499 12.4998 10.1499 13.6998 10.4799"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

interface CustomField {
  id: string;
  label: string;
  value: string;
}

const DEFAULT_MEASUREMENTS = [
  { key: "bust", label: "Bust", placeholder: "" },
  { key: "waist", label: "Waist", placeholder: "" },
  { key: "hip", label: "Hip", placeholder: "" },
  { key: "shoulder", label: "Shoulder", placeholder: "" },
  { key: "sleeveLength", label: "Sleeve Length", placeholder: "" },
  { key: "inseam", label: "Inseam", placeholder: "" },
];

export default function NewMeasurementScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const params = useLocalSearchParams<{
    customerName?: string;
    bookingId?: string;
    serviceTitle?: string;
    appointmentTime?: string;
    returnToAssign?: string;
  }>();
  const [customerName, setCustomerName] = useState(params.customerName || "");

  useEffect(() => {
    if (params.customerName) {
      setCustomerName(params.customerName);
    }
  }, [params.customerName]);
  const [entryMethod, setEntryMethod] = useState<"manual" | "voice">("manual");
  const [values, setValues] = useState<Record<string, string>>({
    bust: "",
    waist: "",
    hip: "",
    shoulder: "",
    sleeveLength: "",
    inseam: "",
  });
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customLabelInput, setCustomLabelInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { showAlert } = useAppAlert();

  const handleValueChange = (key: string, val: string) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  };

  const handleCustomValueChange = (id: string, val: string) => {
    setCustomFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, value: val } : f))
    );
  };

  const handleAddCustomField = () => {
    if (!customLabelInput.trim()) return;
    const newField: CustomField = {
      id: Date.now().toString(),
      label: customLabelInput.trim(),
      value: "",
    };
    setCustomFields((prev) => [...prev, newField]);
    setCustomLabelInput("");
    setShowAddCustom(false);
  };

  const handleRemoveCustomField = (id: string) => {
    setCustomFields((prev) => prev.filter((f) => f.id !== id));
  };

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const handleToggleVoiceRecord = async () => {
    try {
      if (!isRecording) {
        const permission = await AudioModule.requestRecordingPermissionsAsync();
        if (!permission.granted) {
          showAlert("Permission Required", "Microphone access is needed to record voice measurements.");
          return;
        }

        // prepareToRecordAsync() initialises the file sink — MUST come before record()
        await audioRecorder.prepareToRecordAsync();
        audioRecorder.record();
        setIsRecording(true);
      } else {
        setIsRecording(false);
        await audioRecorder.stop();

        // Give expo-audio a tick to finalise the file and populate .uri
        await new Promise((resolve) => setTimeout(resolve, 300));

        const uri = audioRecorder.uri;
        console.log("[Voice] Recording stopped. URI:", uri);

        if (!uri) {
          showAlert("Recording Failed", "No audio file was produced. Please try again.");
          setEntryMethod("manual");
          return;
        }

        // Build multipart/form-data so the server receives the raw audio buffer
        const formData = new FormData();
        formData.append("audio", {
          uri,
          name: "recording.m4a",
          type: "audio/m4a",
        } as any);

        console.log("[Voice] Uploading audio to /api/measurements/parse-voice …");

        let res: { success: boolean; transcript: string; measurements: Record<string, string> } | null = null;
        let fetchError: unknown = null;

        try {
          res = await apiFetch<{ success: boolean; transcript: string; measurements: Record<string, string> }>(
            "/api/measurements/parse-voice",
            {
              method: "POST",
              body: formData,
              silent: true,
            }
          );
          console.log("[Voice] Server response:", JSON.stringify(res));
        } catch (err) {
          fetchError = err;
          console.log("[Voice] Upload error:", err);
        }

        if (fetchError) {
          showAlert("Upload Failed", (fetchError as any)?.message ?? "Network error — please check your connection.");
        } else if (res && res.measurements && Object.keys(res.measurements).length > 0) {
          setValues((prev) => ({ ...prev, ...res!.measurements }));
          const summary = Object.entries(res.measurements)
            .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`)
            .join(", ");
          setVoiceTranscript(summary);
        } else {
          setVoiceTranscript("Audio processed — no measurements detected. Fill values below.");
        }

        setEntryMethod("manual");
      }
    } catch (err) {
      console.log("[Voice] Unexpected error:", err);
      showAlert("Recording Error", (err as any)?.message ?? "An unexpected error occurred.");
      setIsRecording(false);
    }
  };

  const handleSave = async () => {
    if (!customerName.trim()) {
      showAlert("Missing Name", "Please enter the customer's name before saving.");
      return;
    }

    setSaving(true);
    try {
      // Build final measurements payload
      const payload = {
        customerName: customerName.trim(),
        entryMethod,
        standard: values,
        custom: customFields.map((f) => ({ label: f.label, value: f.value })),
      };

      await apiFetch("/api/measurements", {
        method: "POST",
        body: JSON.stringify(payload),
        silent: true,
      }).catch(() => {});

      if (params.returnToAssign === "true") {
        showAlert("Measurements Saved!", "Redirecting to staff assignment...");
        setTimeout(() => {
          router.replace({
            pathname: "/(admin)/escalations/assign",
            params: {
              bookingId: params.bookingId,
              customerName: customerName.trim(),
              serviceTitle: params.serviceTitle,
              appointmentTime: params.appointmentTime,
            },
          } as any);
        }, 1200);
      } else {
        showAlert("Saved!", "Measurement sheet saved to customer profile.");
        setTimeout(() => router.push("/(admin)/settings" as any), 1400);
      }
    } catch (err) {
      showAlert("Save Failed", "Could not save the measurement sheet. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={isLandscape ? undefined : Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[
            styles.scrollContent,
            isLandscape && { maxWidth: 680, alignSelf: "center", width: "100%" },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Top Header */}
          <View style={[styles.header, isLandscape && { marginBottom: 16 }]}>
            <Pressable
              onPress={() => router.push("/(admin)/settings" as any)}
              style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <BackArrowIcon size={18} color="#3B0508" />
            </Pressable>

            <Text style={[styles.headerTitle, isLandscape && { fontSize: 22 }]}>
              New Measurement
            </Text>
          </View>

          {/* Customer Input Section */}
          <View style={styles.sectionGroup}>
            <Text style={styles.sectionLabel}>Customer</Text>
            <View style={styles.inputContainer}>
              <TextInput
                disableFullscreenUI={true}
                style={styles.textInput}
                placeholder="e.g. Chiamaka O."
                placeholderTextColor="#8A7550"
                value={customerName}
                onChangeText={setCustomerName}
              />
            </View>
          </View>

          {/* Entry Method Segmented Pill */}
          <View style={styles.sectionGroup}>
            <Text style={styles.sectionLabel}>Entry Method</Text>
            <View style={styles.segmentContainer}>
              <Pressable
                onPress={() => setEntryMethod("manual")}
                style={({ pressed }) => [
                  styles.segmentBtn,
                  entryMethod === "manual" ? styles.segmentBtnActive : styles.segmentBtnInactive,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    entryMethod === "manual" ? styles.segmentTextActive : styles.segmentTextInactive,
                  ]}
                >
                  Manual
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setEntryMethod("voice")}
                style={({ pressed }) => [
                  styles.segmentBtn,
                  entryMethod === "voice" ? styles.segmentBtnActive : styles.segmentBtnInactive,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    entryMethod === "voice" ? styles.segmentTextActive : styles.segmentTextInactive,
                  ]}
                >
                  Voice
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Voice Mode Record Button Pill */}
          {entryMethod === "voice" ? (
            <Pressable
              onPress={handleToggleVoiceRecord}
              style={({ pressed }) => [
                styles.voiceRecordPill,
                isRecording && styles.voiceRecordPillActive,
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <View style={styles.voiceIconWrapper}>
                <RecordVoiceIcon color={isRecording ? "#FFFFFF" : "#4A080C"} />
              </View>
              <Text
                style={[
                  styles.voiceRecordText,
                  isRecording && styles.voiceRecordTextActive,
                ]}
              >
                {isRecording ? "Recording... (Tap to stop)" : "Record"}
              </Text>
            </Pressable>
          ) : (
            <>
              {/* Spoken Voice Output Banner */}
              {voiceTranscript ? (
                <View style={styles.transcriptBanner}>
                  <Text style={styles.transcriptLabel}>Spoken Voice Output</Text>
                  <Text style={styles.transcriptText}>"{voiceTranscript}"</Text>
                </View>
              ) : null}

              {/* WHAT HAPPENS NEXT Badge */}
              <Text style={styles.badgeText}>WHAT HAPPENS NEXT</Text>

              {/* 2-Column Measurement Grid */}
              <View style={styles.gridContainer}>
                {DEFAULT_MEASUREMENTS.map((item) => (
                  <View key={item.key} style={styles.gridItem}>
                    <Text style={styles.gridLabel}>{item.label}</Text>
                    <View style={styles.gridInputBox}>
                      <TextInput
                        disableFullscreenUI={true}
                        style={styles.gridInput}
                        keyboardType="numeric"
                        placeholder={item.placeholder}
                        placeholderTextColor="#8A7550"
                        value={values[item.key] || ""}
                        onChangeText={(v) => handleValueChange(item.key, v)}
                      />
                    </View>
                  </View>
                ))}

                {/* Render Added Custom Fields in 2-Column Grid */}
                {customFields.map((field) => (
                  <View key={field.id} style={styles.gridItem}>
                    <View style={styles.customLabelRow}>
                      <Text style={styles.gridLabel}>{field.label}</Text>
                      <Pressable onPress={() => handleRemoveCustomField(field.id)}>
                        <Trash2 size={14} color="#D32F2F" />
                      </Pressable>
                    </View>
                    <View style={styles.gridInputBox}>
                      <TextInput
                        disableFullscreenUI={true}
                        style={styles.gridInput}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor="#8A7550"
                        value={field.value}
                        onChangeText={(v) => handleCustomValueChange(field.id, v)}
                      />
                    </View>
                  </View>
                ))}
              </View>

              {/* Add Custom Field Inline Box */}
              {showAddCustom ? (
                <View style={styles.addCustomBox}>
                  <Text style={styles.addCustomTitle}>New Custom Field</Text>
                  <View style={styles.addCustomRow}>
                    <TextInput
                      disableFullscreenUI={true}
                      style={styles.addCustomInput}
                      placeholder="e.g. Neck, Ankle, Thigh"
                      placeholderTextColor="#8A7550"
                      value={customLabelInput}
                      onChangeText={setCustomLabelInput}
                      autoFocus
                    />
                    <Pressable
                      onPress={handleAddCustomField}
                      style={({ pressed }) => [styles.addCustomConfirmBtn, { opacity: pressed ? 0.8 : 1 }]}
                    >
                      <Check size={16} color="#FFFFFF" />
                    </Pressable>
                  </View>
                </View>
              ) : (
                /* Add Custom Field Button */
                <Pressable
                  onPress={() => setShowAddCustom(true)}
                  style={({ pressed }) => [styles.addCustomBtn, { opacity: pressed ? 0.75 : 1 }]}
                >
                  <Plus size={18} color="#4A080C" style={{ marginRight: 6 }} />
                  <Text style={styles.addCustomBtnText}>Add custom field</Text>
                </Pressable>
              )}
            </>
          )}
        </ScrollView>

        {/* Pinned Bottom Action Bar */}
        <View style={[styles.saveBtnWrapper, isLandscape && { paddingTop: 6, paddingBottom: 10 }]}>
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => [
              styles.saveBtn,
              isLandscape && { height: 44, borderRadius: 22 },
              { opacity: pressed || saving ? 0.85 : 1 },
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveBtnText}>Save to Customer Profile</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FBF7EF",
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(74, 8, 12, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  headerTitle: {
    fontFamily: "Fraunces-Bold",
    fontSize: 24,
    color: "#3B0508",
    flex: 1,
  },
  sectionGroup: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 14,
    color: "#3B0508",
    marginBottom: 8,
  },
  inputContainer: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(74, 8, 12, 0.3)",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  textInput: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 16,
    color: "#3B0508",
    height: "100%",
  },
  segmentContainer: {
    flexDirection: "row",
    height: 54,
    borderRadius: 27,
    backgroundColor: "#E4E1DB",
    padding: 4,
    alignItems: "center",
  },
  segmentBtn: {
    flex: 1,
    height: "100%",
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentBtnActive: {
    backgroundColor: "#4A080C",
  },
  segmentBtnInactive: {
    backgroundColor: "transparent",
  },
  segmentText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 15,
  },
  segmentTextActive: {
    color: "#FFFFFF",
  },
  segmentTextInactive: {
    color: "rgba(74, 8, 12, 0.7)",
  },
  badgeText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 12,
    letterSpacing: 1.2,
    color: "#4A080C",
    marginTop: 8,
    marginBottom: 16,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginBottom: 16,
  },
  gridItem: {
    width: "47.5%",
  },
  gridLabel: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 14,
    color: "#3B0508",
    marginBottom: 6,
  },
  customLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  gridInputBox: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(74, 8, 12, 0.3)",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  gridInput: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 16,
    color: "#3B0508",
    height: "100%",
  },
  addCustomBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    marginBottom: 28,
  },
  addCustomBtnText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 15,
    color: "#4A080C",
  },
  addCustomBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(74, 8, 12, 0.2)",
    marginBottom: 24,
  },
  addCustomTitle: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 13,
    color: "#3B0508",
    marginBottom: 6,
  },
  addCustomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addCustomInput: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(74, 8, 12, 0.25)",
    paddingHorizontal: 12,
    fontFamily: "WorkSans_400Regular",
    fontSize: 14,
    color: "#3B0508",
  },
  addCustomConfirmBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#4A080C",
    alignItems: "center",
    justifyContent: "center",
  },
  voiceRecordPill: {
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(74, 8, 12, 0.25)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 24,
  },
  voiceRecordPillActive: {
    backgroundColor: "#4A080C",
  },
  voiceIconWrapper: {
    marginRight: 12,
  },
  voiceRecordText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#4A080C",
  },
  voiceRecordTextActive: {
    color: "#FFFFFF",
  },
  transcriptBanner: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(74, 8, 12, 0.2)",
    marginBottom: 16,
  },
  transcriptLabel: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 12,
    color: "#8A7550",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  transcriptText: {
    fontFamily: "WorkSans_500Medium",
    fontSize: 14,
    color: "#3B0508",
  },
  saveBtnWrapper: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
    backgroundColor: "#FBF7EF",
  },
  saveBtn: {
    width: "100%",
    maxWidth: 380,
    alignSelf: "center",
    height: 58,
    borderRadius: 29,
    backgroundColor: "#4A080C",
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
});

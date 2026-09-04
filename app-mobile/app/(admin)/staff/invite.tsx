import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Eye, EyeOff } from "lucide-react-native";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import { useAuthStore } from "@/stores/useAuthStore";
import { API_BASE_URL } from "@/api/config";
import { useAppAlert } from "@/shared/hooks/useAppAlert";

export default function InviteStaffScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { showAlert } = useAppAlert();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const token = useAuthStore((s) => s.token);

  const handleSendInvite = async () => {
    setError("");
    if (!name.trim()) {
      setError("Please enter the staff member's full name.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/staff/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        const issueMsg = Array.isArray(body.issues) && body.issues.length > 0
          ? body.issues.map((i: any) => i.message).join(". ")
          : null;
        throw new Error(issueMsg || body.error || "Could not invite staff member.");
      }

      showAlert("Invite Sent", `An invite and account credentials have been created for ${name.trim()}.`);
      setTimeout(() => {
        router.push("/(admin)/staff" as any);
      }, 1200);
    } catch (e: any) {
      setError(e.message || "Failed to send staff invitation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            isLandscape && styles.landscapeContainer,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Row */}
          <View style={styles.header}>
            <Pressable
              onPress={() => router.push("/(admin)/staff" as any)}
              style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <BackArrowIcon size={18} color="#3B0508" />
            </Pressable>
            <Text style={styles.headerTitle}>Invite Staff</Text>
          </View>

          {/* Subtitle Message */}
          <Text style={styles.subtitle}>
            They'll get an email invite to set their own password and activate their account.
          </Text>

          {/* Form Fields */}
          <View style={styles.formContainer}>
            {/* Full Name Input Field */}
            <View style={styles.fieldWrapper}>
              <View style={styles.labelContainer}>
                <Text style={styles.floatingLabel}>Full Name</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="e.g. Ngozi Umeh"
                placeholderTextColor="#A89E90"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>

            {/* Email Input Field */}
            <View style={styles.fieldWrapper}>
              <View style={styles.labelContainer}>
                <Text style={styles.floatingLabel}>Email</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="ngozi@atelier.com"
                placeholderTextColor="#A89E90"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            {/* Password Input Field */}
            <View style={styles.fieldWrapper}>
              <View style={styles.labelContainer}>
                <Text style={styles.floatingLabel}>Password</Text>
              </View>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, { flex: 1, borderWidth: 0, paddingHorizontal: 0 }]}
                  placeholder="Min. 8 characters"
                  placeholderTextColor="#A89E90"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <Pressable
                  onPress={() => setShowPassword((prev) => !prev)}
                  style={{ padding: 6 }}
                >
                  {showPassword ? (
                    <EyeOff size={18} color="#7A7265" />
                  ) : (
                    <Eye size={18} color="#7A7265" />
                  )}
                </Pressable>
              </View>
            </View>

            {/* Error message */}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {/* Send Invite Button */}
            <Pressable
              onPress={handleSendInvite}
              disabled={loading}
              style={({ pressed }) => [
                styles.sendBtn,
                { opacity: pressed || loading ? 0.85 : 1 },
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.sendBtnText}>Send Invite</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
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
    paddingTop: 8,
    paddingBottom: 40,
  },
  landscapeContainer: {
    maxWidth: 680,
    alignSelf: "center",
    width: "100%",
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
    lineHeight: 28,
    color: "#1A1110",
    letterSpacing: -0.2,
  },
  subtitle: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 14,
    lineHeight: 21,
    color: "#4A4E51",
    marginBottom: 32,
    paddingHorizontal: 2,
  },
  formContainer: {
    gap: 20,
  },
  fieldWrapper: {
    position: "relative",
    height: 58,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(74, 8, 12, 0.45)",
    backgroundColor: "transparent",
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  labelContainer: {
    position: "absolute",
    top: -9,
    left: 14,
    backgroundColor: "#FBF7EF",
    paddingHorizontal: 6,
    zIndex: 1,
  },
  floatingLabel: {
    fontFamily: "WorkSans_500Medium",
    fontSize: 12,
    color: "#4A4E51",
  },
  input: {
    height: "100%",
    fontFamily: "WorkSans_400Regular",
    fontSize: 15,
    color: "#1A1110",
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    height: "100%",
  },
  errorText: {
    fontFamily: "WorkSans_500Medium",
    fontSize: 13,
    color: "#DC2626",
    marginTop: -4,
  },
  sendBtn: {
    height: 58,
    borderRadius: 29,
    backgroundColor: "#4A080C",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  sendBtnText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
});

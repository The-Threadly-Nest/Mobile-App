import { typeScale } from "@/shared/utils/typeScale";
import React, { useState } from "react";
import { View, Pressable, ScrollView, ActivityIndicator, StyleSheet, useWindowDimensions, KeyboardAvoidingView, Platform } from "react-native";
import { Text, TextInput } from "@/shared/components/Typography";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import { useAuthStore } from "@/stores/useAuthStore";
import { apiFetch } from "@/shared/utils/apiClient";
import { useAppAlert } from "@/shared/hooks/useAppAlert";

export default function InviteStaffScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { showAlert } = useAppAlert();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

    if (password && (password.length < 8 || password.length > 72 || !/[A-Z]/.test(password) || !/\d/.test(password))) {
      setError("Use 8–72 characters with an uppercase letter and a number, or leave the password blank.");
      return;
    }
    setLoading(true);
    try {
      const invitation = await apiFetch<{ emailSent?: boolean; message?: string }>("/api/staff/invite", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          ...(password ? { password } : {}),
        }),
      });

      showAlert(invitation.emailSent === false ? "Staff account created" : "Invite Sent", invitation.emailSent === false ? invitation.message || "Open Staff to resend the invitation." : `A temporary password has been sent to ${email.trim().toLowerCase()}.`);
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
        behavior={Platform.OS === "ios" ? "padding" : "height"}
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
              style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 , width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: 0, }]}
            >
              <BackArrowIcon size={24} color="#453332" />
            </Pressable>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.headerTitle}>Invite Staff</Text>
          </View>

          {/* Subtitle Message */}
          <Text style={styles.subtitle}>
            They’ll receive a temporary password by email and choose a new one when they log in. Leave the password blank to generate one.
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
                placeholderTextColor="#4A403B"
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
                placeholderTextColor="#4A403B"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            {/* Error message */}
            <View style={styles.fieldWrapper}>
              <View style={styles.labelContainer}><Text style={styles.floatingLabel}>Temporary password (optional)</Text></View>
              <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} placeholder="8+ characters, uppercase and number" placeholderTextColor="#4A403B" />
            </View>
            <Text style={styles.subtitle}>Emailed to staff. Expires in 24 hours; they must replace it before accessing their work.</Text>
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
                <ActivityIndicator color="#FFFDF9" />
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
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 36,
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
  gap: 8, },
  backBtn: {
    width: 44,
    height: 44,



    alignItems: "center",
    justifyContent: "center",
    marginRight: 0,
  },
  headerTitle: {
    ...typeScale.pageTitle,
    flex: 1,
    fontFamily: "InstrumentSans-Medium",
    fontSize: 22,
    color: "#4A403B",
    letterSpacing: -0.2,
  },
  subtitle: {
    ...typeScale.caption,
    color: "#4A403B",
    marginBottom: 24,
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
    borderColor: "rgba(69, 51, 50, 0.45)",
    backgroundColor: "transparent",
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  labelContainer: {
    position: "absolute",
    top: -9,
    left: 14,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 6,
    zIndex: 1,
  },
  floatingLabel: {
    fontFamily: "InstrumentSans-Medium",
    fontSize: 12,
    color: "#4A403B",
  },
  input: {
    height: "100%",
    fontFamily: "InstrumentSans-Regular",
    fontSize: 15,
    color: "#4A403B",
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    height: "100%",
  },
  errorText: {
    fontFamily: "InstrumentSans-Medium",
    fontSize: 13,
    color: "#F96951",
    marginTop: -4,
  },
  sendBtn: {
    height: 58,
    borderRadius: 29,
    backgroundColor: "#F96951",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  sendBtnText: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 16,
    color: "#FFFDF9",
    letterSpacing: 0.2,
  },
});

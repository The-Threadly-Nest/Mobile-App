import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Eye, EyeOff, User, Scissors } from "lucide-react-native";
import Svg, { Path } from "react-native-svg";
import { useAuthStore } from "@/stores/useAuthStore";
import { apiFetch } from "@/shared/utils/apiClient";
import { useGoogleAuth } from "@/shared/hooks/useGoogleAuth";
import { registerPushToken } from "@/shared/utils/pushNotifications";
import { KeyboardAwareScrollView } from "@/shared/components/KeyboardAwareScrollView";

export default function SignupScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const params = useLocalSearchParams<{ role?: "admin" | "customer" }>();
  const [role, setRole] = useState<"admin" | "customer">(
    params.role === "admin" ? "admin" : "customer"
  );
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const setToken = useAuthStore((s) => s.setToken);
  const setEmailStore = useAuthStore((s) => s.setEmail);
  const setNameStore = useAuthStore((s) => s.setName);
  const setRoleStore = useAuthStore((s) => s.setRole);
  const setShopName = useAuthStore((s) => s.setShopName);
  const setIsVerified = useAuthStore((s) => s.setIsVerified);
  const setResendAvailableAt = useAuthStore((s) => s.setResendAvailableAt);
  const setCreatedAt = useAuthStore((s) => s.setCreatedAt);
  const setSession = useAuthStore((s) => s.setSession);

  const isValidEmail = (e: string) => {
    const clean = e.trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean);
  };

  const handleSignup = async () => {
    setError("");

    if (!name.trim()) {
      setError("Full name is required.");
      return;
    }
    if (role === "admin" && !businessName.trim()) {
      setError("Business name is required.");
      return;
    }
    if (!email.trim()) {
      setError("Email address is required.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Password is required.");
      return;
    }
    if (password.length < 8 || !/[0-9]/.test(password) || !/[A-Z]/.test(password)) {
      setError("Password must be at least 8 characters long, contain at least 1 uppercase letter and 1 number.");
      return;
    }

    setLoading(true);
    try {
      const body = await apiFetch<any>("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          role,
          name: name.trim(),
          businessName: role === "admin" ? businessName.trim() : undefined,
        }),
      });

      setSession({
        userId: body.user.id,
        token: body.token,
        email: body.user.email,
        name: name.trim(),
        shopName: role === "admin" ? businessName.trim() : "",
        createdAt: new Date().toISOString(),
        role: body.user.role,
        isVerified: role !== "admin",
      });
      setResendAvailableAt(Date.now() + 60000);

      // Register push token asynchronously so notifications work immediately
      registerPushToken(body.token).catch((err) =>
        console.warn("[Signup] Push token registration failed:", err)
      );
      router.replace(
        role === "admin"
          ? { pathname: "/(auth)/verify", params: { email: email.trim().toLowerCase() } }
          : "/(auth)/personalize"
      );
    } catch (e: any) {
      if (e.message === "Network request failed" || e.name === "TypeError") {
        setError("Network request failed. Please check your connection and try again.");
      } else {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const { promptAsync: triggerGoogleAuth, error: googleError, loading: googleLoading } = useGoogleAuth(role);

  const handleGoogleAuth = () => {
    triggerGoogleAuth();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={isLandscape ? undefined : Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <KeyboardAwareScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[
            styles.scrollContent,
            isLandscape && {
              paddingTop: 12,
              paddingBottom: 16,
              maxWidth: 620,
              alignSelf: "center",
              width: "100%",
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Top Header */}
          <View style={[styles.header, isLandscape && { marginBottom: 16, marginTop: 0 }]}>
            <View style={styles.headerTopRow}>
              <Image
                source={require("../../assets/owuja-logo.png")}
                style={[styles.logo, isLandscape && { width: 90, height: 28.5 }]}
                resizeMode="contain"
                accessibilityLabel="Owuja Logo"
              />
            </View>
            <Text style={[styles.headerTitle, isLandscape && { fontSize: 22 }]}>Create Account</Text>
          </View>

          {/* Form Fields */}
          <View style={styles.formContainer}>
            {/* Segmented Role Tab */}
            <View style={styles.roleTabContainer}>
              <Pressable
                onPress={() => setRole("customer")}
                style={[styles.roleTab, role === "customer" && styles.roleTabActive]}
              >
                <User
                  size={16}
                  color={role === "customer" ? "#FFFFFF" : "#746765"}
                  strokeWidth={2}
                />
                <Text style={[styles.roleTabText, role === "customer" && styles.roleTabTextActive]}>
                  Customer
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setRole("admin")}
                style={[styles.roleTab, role === "admin" && styles.roleTabActive]}
              >
                <Scissors
                  size={16}
                  color={role === "admin" ? "#FFFFFF" : "#746765"}
                  strokeWidth={2}
                />
                <Text style={[styles.roleTabText, role === "admin" && styles.roleTabTextActive]}>
                  Fashion House
                </Text>
              </Pressable>
            </View>

            {/* Full Name Input */}
            <View style={[styles.inputContainer, isLandscape && { height: 46, marginBottom: 10 }]}>
              <View style={styles.labelWrapper}>
                <Text style={styles.labelText}>Full Name</Text>
              </View>
              <TextInput
                disableFullscreenUI={true}
                style={styles.textInput}
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  if (error) setError("");
                }}
                autoCapitalize="words"
              />
            </View>

            {/* Business Name Input (Admin / Fashion House Flow) */}
            {role === "admin" && (
              <View style={[styles.inputContainer, isLandscape && { height: 46, marginBottom: 10 }]}>
                <View style={styles.labelWrapper}>
                  <Text style={styles.labelText}>Business Name</Text>
                </View>
                <TextInput
                  disableFullscreenUI={true}
                  style={styles.textInput}
                  value={businessName}
                  onChangeText={(text) => {
                    setBusinessName(text);
                    if (error) setError("");
                  }}
                  autoCapitalize="words"
                />
              </View>
            )}

            {/* Email Input */}
            <View style={[styles.inputContainer, isLandscape && { height: 46, marginBottom: 10 }]}>
              <View style={styles.labelWrapper}>
                <Text style={styles.labelText}>Email</Text>
              </View>
              <TextInput
                disableFullscreenUI={true}
                style={styles.textInput}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (error) setError("");
                }}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Password Input */}
            <View style={[styles.inputContainer, { marginBottom: 12 }, isLandscape && { height: 46, marginBottom: 8 }]}>
              <View style={styles.labelWrapper}>
                <Text style={styles.labelText}>Password</Text>
              </View>
              <TextInput
                disableFullscreenUI={true}
                style={styles.textInput}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                style={[styles.eyeIconBtn, isLandscape && { top: 13 }]}
              >
                {showPassword ? (
                  <EyeOff size={18} color="#3C3C43" />
                ) : (
                  <Eye size={18} color="#3C3C43" />
                )}
              </Pressable>
            </View>

            {/* Password Helper Text */}
            <Text style={[styles.helperText, isLandscape && { marginBottom: 10 }]}>
              At least 8 characters, one number.
            </Text>

            {/* Error Message */}
            {error || googleError ? <Text style={styles.errorText}>{error || googleError}</Text> : null}

            {/* Create Account Button */}
            <Pressable
              onPress={handleSignup}
              disabled={loading}
              style={({ pressed }) => [
                styles.createAccountBtn,
                isLandscape && { height: 46, borderRadius: 23, marginBottom: 10 },
                {
                  opacity: pressed || loading ? 0.8 : 1,
                },
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.createAccountText}>Create Account</Text>
              )}
            </Pressable>

            {/* Or Divider */}
            <Pressable
              onPress={() => router.push("/(auth)/login")}
              hitSlop={8}
              style={({ pressed }) => [styles.headerLoginChip, { alignSelf: "center", marginBottom: 8, opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={styles.headerLoginPrompt}>Have an account? </Text>
              <Text style={styles.headerLoginLink}>Log In</Text>
            </Pressable>

            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Continue with Google Button (Bottom Placement) */}
            <Pressable
              onPress={handleGoogleAuth}
              disabled={googleLoading}
              style={({ pressed }) => [
                styles.googleBtn,
                { opacity: pressed || googleLoading ? 0.8 : 1 },
              ]}
            >
              {googleLoading ? (
                <ActivityIndicator color="#453332" />
              ) : (
                <>
                  <Svg width={18} height={18} viewBox="0 0 24 24">
                    <Path
                      fill="#F44336"
                      d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                    />
                    <Path
                      fill="#FFC107"
                      d="M1.9 7.3C1.3 8.7 1 10.3 1 12s.3 3.3.9 4.7l3.7-2.9C5.3 13.1 5 12.6 5 12s.3-1.1.6-1.8L1.9 7.3z"
                    />
                    <Path
                      fill="#448AFF"
                      d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
                    />
                    <Path
                      fill="#43A047"
                      d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 6.3 10.1 6.3z"
                    />
                  </Svg>
                  <Text style={styles.googleBtnText}>Continue with Google</Text>
                </>
              )}
            </Pressable>

            {/* Disclaimer */}
            <Text style={styles.disclaimerText}>
              By continuing you agree to our Terms of Service and Privacy
              Policy.
            </Text>
          </View>
        </KeyboardAwareScrollView>
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
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 36,
  },
  header: {
    marginBottom: 28,
    gap: 6,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  logo: {
    width: 96,
    height: 30,
  },
  headerLoginChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 4,
    minHeight: 44,
  },
  headerLoginPrompt: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 13,
    color: "#746765",
  },
  headerLoginLink: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 13,
    color: "#4A080C",
    textDecorationLine: "underline",
  },
  headerTitle: {
    fontFamily: "HedvigLettersSerif-Regular",
    fontSize: 24,
    color: "#000000",
  },
  formContainer: {
    width: "100%",
  },
  roleTabContainer: {
    flexDirection: "row",
    backgroundColor: "#F4EEE5",
    borderRadius: 999,
    padding: 3.5,
    marginBottom: 26,
  },
  roleTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    height: 44,
    borderRadius: 999,
  },
  roleTabActive: {
    backgroundColor: "#F96951",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  roleTabText: {
    fontFamily: "InstrumentSans-Medium",
    fontSize: 13.5,
    color: "#746765",
  },
  roleTabTextActive: {
    fontFamily: "InstrumentSans-SemiBold",
    color: "#FFFFFF",
  },
  inputContainer: {
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(74, 8, 12, 0.35)",
    borderRadius: 12,
    height: 56,
    justifyContent: "center",
    paddingHorizontal: 14,
    marginBottom: 24,
  },
  labelWrapper: {
    position: "absolute",
    top: -9,
    left: 14,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 5,
    zIndex: 1,
  },
  labelText: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 11.5,
    color: "#000000",
  },
  textInput: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 15,
    color: "#000000",
    paddingRight: 32,
    height: "100%",
  },
  eyeIconBtn: {
    position: "absolute",
    right: 14,
    top: 18,
  },
  helperText: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 11.5,
    color: "#746765",
    marginBottom: 24,
    marginTop: 0,
  },
  errorText: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 12.5,
    color: "#D32F2F",
    marginBottom: 12,
  },
  roleToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  roleToggleLabel: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 12,
    color: "#000000",
  },
  roleToggleValue: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 12,
    color: "#000000",
    textDecorationLine: "underline",
  },
  createAccountBtn: {
    width: "100%",
    height: 54,
    borderRadius: 27,
    backgroundColor: "#F96951",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  createAccountText: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 15.5,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(74, 8, 12, 0.15)",
  },
  dividerText: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 12,
    color: "#746765",
    paddingHorizontal: 12,
  },
  googleBtn: {
    width: "100%",
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: "#F96951",
    backgroundColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 20,
  },
  googleBtnText: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 15,
    color: "#1A1A1A",
    letterSpacing: 0.2,
  },
  disclaimerText: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 11,
    lineHeight: 15,
    color: "#746765",
    textAlign: "center",
    paddingHorizontal: 12,
  },
});

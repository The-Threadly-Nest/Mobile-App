import React, { useState } from "react";
import {
  View,
  Text,
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
import { Eye, EyeOff } from "lucide-react-native";
import Svg, { Path } from "react-native-svg";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import { useAuthStore } from "@/stores/useAuthStore";
import { API_BASE_URL } from "@/api/config";
import { useGoogleAuth } from "@/shared/hooks/useGoogleAuth";

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
      const targetUrl = `${API_BASE_URL}/api/auth/signup`;
      console.log(`[Signup] Attempting POST to ${targetUrl}`);
      const res = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          role,
          name: name.trim(),
          businessName: role === "admin" ? businessName.trim() : undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        const issueMsg = Array.isArray(body.issues) && body.issues.length > 0
          ? body.issues.map((i: any) => i.message).join(". ")
          : null;
        throw new Error(issueMsg || body.error || "Could not create account.");
      }

      setToken(body.token);
      setEmailStore(body.user.email);
      setNameStore(name.trim());
      if (role === "admin" && businessName) {
        setShopName(businessName.trim());
      }
      setCreatedAt(new Date().toISOString());
      setRoleStore(body.user.role);
      setIsVerified(role !== "admin");
      setResendAvailableAt(Date.now() + 60000);
      router.replace(
        role === "admin"
          ? { pathname: "/(auth)/verify", params: { email: email.trim().toLowerCase() } }
          : "/(auth)/personalize"
      );
    } catch (e: any) {
      if (e.message === "Network request failed" || e.name === "TypeError") {
        setError(`Network request failed. (Connecting to ${API_BASE_URL})`);
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
        <ScrollView
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
            <Pressable
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace(role === "admin" ? "/admin-onboarding" : "/onboarding");
              }}
              style={({ pressed }) => [
                styles.backBtn,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <BackArrowIcon size={20} color="#3B0508" />
            </Pressable>
            <Text style={[styles.headerTitle, isLandscape && { fontSize: 22 }]}>Create Account</Text>
          </View>

          {/* Form Fields */}
          <View style={styles.formContainer}>
            {/* Full Name Input */}
            <View style={[styles.inputContainer, isLandscape && { height: 48, marginBottom: 14 }]}>
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
              <View style={[styles.inputContainer, isLandscape && { height: 48, marginBottom: 14 }]}>
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
            <View style={[styles.inputContainer, isLandscape && { height: 48, marginBottom: 14 }]}>
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
            <View style={[styles.inputContainer, { marginBottom: 6 }, isLandscape && { height: 48, marginBottom: 4 }]}>
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
            <Text style={[styles.helperText, isLandscape && { marginBottom: 12 }]}>
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
                isLandscape && { height: 48, borderRadius: 24, marginBottom: 12 },
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

            {/* Already have an account? Log In */}
            <View style={styles.loginLinkRow}>
              <Text style={styles.loginLinkText}>
                Already have an account?{" "}
              </Text>
              <Pressable onPress={() => router.push("/(auth)/login")}>
                <Text style={styles.loginLinkBold}>Log In</Text>
              </Pressable>
            </View>

            {/* Or Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Continue with Google Button */}
            <Pressable
              onPress={handleGoogleAuth}
              style={({ pressed }) => [
                styles.googleBtn,
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24">
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
            </Pressable>

            {/* Disclaimer */}
            <Text style={styles.disclaimerText}>
              By continuing you agree to our Terms of Service and Privacy
              Policy.
            </Text>
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
    paddingTop: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 36,
    marginTop: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(74, 8, 12, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  headerTitle: {
    fontFamily: "Fraunces-Bold",
    fontSize: 26,
    color: "#3B0508",
  },
  formContainer: {
    width: "100%",
  },
  inputContainer: {
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(74, 8, 12, 0.35)",
    borderRadius: 14,
    height: 58,
    justifyContent: "center",
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  labelWrapper: {
    position: "absolute",
    top: -10,
    left: 16,
    backgroundColor: "#FBF7EF",
    paddingHorizontal: 6,
    zIndex: 1,
  },
  labelText: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 13,
    color: "rgba(74, 8, 12, 0.75)",
  },
  textInput: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 16,
    color: "#3B0508",
    paddingRight: 32,
    height: "100%",
  },
  eyeIconBtn: {
    position: "absolute",
    right: 16,
    top: 18,
  },
  helperText: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 12,
    color: "rgba(74, 8, 12, 0.60)",
    marginBottom: 24,
    marginTop: -2,
  },
  errorText: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 13,
    color: "#D32F2F",
    marginBottom: 16,
  },
  roleToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 20,
  },
  roleToggleLabel: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 12,
    color: "rgba(74, 8, 12, 0.6)",
  },
  roleToggleValue: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 12,
    color: "#4A080C",
    textDecorationLine: "underline",
  },
  createAccountBtn: {
    width: "100%",
    height: 63,
    borderRadius: 31.5,
    backgroundColor: "#4A080C",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  createAccountText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  loginLinkRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  loginLinkText: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 15,
    color: "#3B0508",
  },
  loginLinkBold: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 15,
    color: "#4A080C",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(74, 8, 12, 0.15)",
  },
  dividerText: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 13,
    color: "rgba(74, 8, 12, 0.60)",
    paddingHorizontal: 16,
  },
  googleBtn: {
    width: "100%",
    height: 63,
    borderRadius: 31.5,
    borderWidth: 1,
    borderColor: "#4A080C",
    backgroundColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginBottom: 24,
  },
  googleBtnText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#1A1A1A",
    letterSpacing: 0.2,
  },
  disclaimerText: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 12,
    lineHeight: 16,
    color: "rgba(74, 8, 12, 0.60)",
    textAlign: "center",
    paddingHorizontal: 16,
  },
});

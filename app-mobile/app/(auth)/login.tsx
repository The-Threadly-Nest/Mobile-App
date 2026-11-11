import { typeScale } from "@/shared/utils/typeScale";
import React, { useState } from "react";
import { View, Image, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, useWindowDimensions } from "react-native";
import { Text, TextInput } from "@/shared/components/Typography";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Eye, EyeOff } from "lucide-react-native";
import Svg, { Path } from "react-native-svg";
import { useAuthStore } from "@/stores/useAuthStore";
import { apiFetch } from "@/shared/utils/apiClient";
import { useGoogleAuth } from "@/shared/hooks/useGoogleAuth";
import { registerPushToken } from "@/shared/utils/pushNotifications";
import { KeyboardAwareScrollView } from "@/shared/components/KeyboardAwareScrollView";
import { StatusBar } from "expo-status-bar";
import { SCREEN_TOP_SPACING } from "@/shared/utils/screenSpacing";

export default function LoginScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

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
  const setCreatedAt = useAuthStore((s) => s.setCreatedAt);
  const setIsVerified = useAuthStore((s) => s.setIsVerified);
  const setOnboardingCompleted = useAuthStore((s) => s.setOnboardingCompleted);
  const setSession = useAuthStore((s) => s.setSession);

  const isValidEmail = (e: string) => {
    const clean = e.trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean);
  };

  const handleLogin = async () => {
    setError("");

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

    setLoading(true);
    try {
      const body = await apiFetch<any>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      const userVerified = body.user.isVerified ?? true;
      const userOnboardingCompleted = body.user.onboardingCompleted ?? false;

      setSession({
        userId: body.user.id,
        token: body.token,
        email: body.user.email,
        name: body.user.name ?? "",
        shopName: body.user.shopName ?? "",
        role: body.user.role,
        createdAt: body.user.createdAt ?? null,
        isVerified: userVerified,
        onboardingCompleted: userOnboardingCompleted,
      });

      // Register push token asynchronously so notifications work immediately without cold start
      registerPushToken(body.token).catch((err) =>
        console.warn("[Login] Push token registration failed:", err)
      );

      if (body.user.role === "admin") {
        if (!userVerified) {
          router.replace({ pathname: "/(auth)/verify", params: { email: body.user.email } });
        } else if (!userOnboardingCompleted) {
          router.replace("/(admin)/onboarding");
        } else {
          router.replace("/(auth)/loading" as any);
        }
      } else if (body.user.role === "staff") {
        router.replace("/(auth)/loading" as any);
      } else router.replace("/(auth)/loading" as any);
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

  const { promptAsync: triggerGoogleAuth, error: googleError, loading: googleLoading } = useGoogleAuth("customer");

  const handleGoogleAuth = () => {
    triggerGoogleAuth();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
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
          <View style={[styles.header, isLandscape && { marginBottom: 20, marginTop: 0 }]}>
            <Image
              source={require("../../assets/owuja-logo.png")}
              style={[styles.logo, isLandscape && { width: 90, height: 28.5 }]}
              resizeMode="contain"
              accessibilityLabel="Owuja Logo"
            />
            <Text style={[styles.headerTitle, isLandscape && { fontSize: 22 }]}>Log In</Text>
          </View>

          {/* Form Fields */}
          <View style={styles.formContainer}>
            {/* Email Input */}
            <View style={[styles.inputContainer, isLandscape && { height: 48, marginBottom: 14 }]}>
              <View pointerEvents="none" style={styles.labelWrapper}>
                <Text style={styles.labelText}>Email</Text>
              </View>
              <TextInput
                disableFullscreenUI={true}
                style={styles.textInput}
                accessibilityLabel="Email"
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
            <View style={[styles.inputContainer, { marginBottom: 8 }, isLandscape && { height: 48, marginBottom: 4 }]}>
              <View pointerEvents="none" style={styles.labelWrapper}>
                <Text style={styles.labelText}>Password</Text>
              </View>
              <TextInput
                disableFullscreenUI={true}
                style={styles.textInput}
                accessibilityLabel="Password"
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
                  <EyeOff size={18} color="#2B2B2B" />
                ) : (
                  <Eye size={18} color="#2B2B2B" />
                )}
              </Pressable>
            </View>

            {/* Forgot Password Link */}
            <Pressable
              onPress={() => router.push("/(auth)/forgot-password")}
              style={[styles.forgotPasswordWrapper, isLandscape && { marginBottom: 14 }]}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </Pressable>

            {/* Error Message */}
            {error || googleError ? <Text style={styles.errorText}>{error || googleError}</Text> : null}

            {/* Log In Button */}
            <Pressable
              onPress={handleLogin}
              disabled={loading}
              style={({ pressed }) => [
                styles.logInBtn,
                isLandscape && { height: 48, borderRadius: 24, marginBottom: 12 },
                {
                  opacity: pressed || loading ? 0.8 : 1,
                },
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#FFFDF9" />
              ) : (
                <Text style={styles.logInBtnText}>Log In</Text>
              )}
            </Pressable>

            {/* New here? Create an account */}
            <View style={[styles.signupLinkRow, isLandscape && { marginBottom: 12 }]}>
              <Text style={styles.signupLinkText}>New here? </Text>
              <Pressable onPress={() => router.push("/(auth)/signup")}>
                <Text style={styles.signupLinkBold}>Create an account</Text>
              </Pressable>
            </View>

            {/* Or Divider */}
            <View style={[styles.dividerContainer, isLandscape && { marginBottom: 12 }]}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Continue with Google Button */}
            <Pressable
              onPress={handleGoogleAuth}
              disabled={googleLoading}
              style={({ pressed }) => [
                styles.googleBtn,
                isLandscape && { height: 48, borderRadius: 24, marginBottom: 14 },
                { opacity: pressed || googleLoading ? 0.8 : 1 },
              ]}
            >
              {googleLoading ? (
                <ActivityIndicator color="#453332" />
              ) : (
                <>
                  <Svg width={20} height={20} viewBox="0 0 24 24">
                    <Path
                      fill="#F96951"
                      d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                    />
                    <Path
                      fill="#453332"
                      d="M1.9 7.3C1.3 8.7 1 10.3 1 12s.3 3.3.9 4.7l3.7-2.9C5.3 13.1 5 12.6 5 12s.3-1.1.6-1.8L1.9 7.3z"
                    />
                    <Path
                      fill="#453332"
                      d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
                    />
                    <Path
                      fill="#453332"
                      d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 6.3 10.1 6.3z"
                    />
                  </Svg>
                  <Text style={styles.googleBtnText}>Continue with Google</Text>
                </>
              )}
            </Pressable>

            {/* Disclaimer */}
            <Text style={styles.disclaimerText}>
              By continuing you agree to our Terms of Service and Privacy Policy.
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
    paddingHorizontal: 24,
    paddingTop: SCREEN_TOP_SPACING,
    paddingBottom: 32,
  },
  header: {
    flexDirection: "column",
    alignItems: "flex-start",
    marginBottom: 32,
    marginTop: 0,
    gap: 20,
  },
  logo: {
    width: 104,
    height: 33,
  },
  headerTitle: {
    ...typeScale.pageTitle,
    color: "#4A403B",
  },
  formContainer: {
    width: "100%",
  },
  inputContainer: {
    position: "relative",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(69, 51, 50, 0.35)",
    borderRadius: 14,
    height: 56,
    justifyContent: "center",
    paddingHorizontal: 14,
    marginBottom: 24,
  },
  labelWrapper: {
    position: "absolute",
    top: -10,
    left: 16,
    paddingHorizontal: 6,
    backgroundColor: "#FFFFFF",
    zIndex: 1,
  },
  labelText: {
    ...typeScale.label,
    lineHeight: 20,
    color: "#4A403B",
  },
  textInput: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 15,
    color: "#4A403B",
    paddingRight: 32,
    height: "100%",
  },
  eyeIconBtn: {
    position: "absolute",
    right: 14,
    top: 18,
  },
  forgotPasswordWrapper: {
    alignSelf: "flex-end",
    marginBottom: 36,
  },
  forgotPasswordText: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 13,
    color: "#4A403B",
  },
  errorText: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 13,
    color: "#F96951",
    marginBottom: 16,
  },
  logInBtn: {
    width: "100%",
    height: 63,
    borderRadius: 31.5,
    backgroundColor: "#F96951",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  logInBtnText: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 16,
    color: "#FFFDF9",
    letterSpacing: 0.2,
  },
  signupLinkRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  signupLinkText: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 15,
    color: "#4A403B",
  },
  signupLinkBold: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 15,
    color: "#4A403B",
  },
  dividerContainer: {
    display: "none",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  dividerLine: {
    display: "none",
    flex: 1,
    height: 1,
    backgroundColor: "rgba(69, 51, 50, 0.15)",
  },
  dividerText: {
    display: "none",
    fontFamily: "InstrumentSans-Regular",
    fontSize: 13,
    color: "#4A403B",
    paddingHorizontal: 16,
  },
  googleBtn: {
    width: "100%",
    height: 63,
    borderRadius: 31.5,
    borderWidth: 1,
    borderColor: "#F96951",
    backgroundColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginBottom: 24,
  },
  googleBtnText: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 16,
    color: "#4A403B",
    letterSpacing: 0.2,
  },
  disclaimerText: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 12,
    lineHeight: 16,
    color: "#4A403B",
    textAlign: "center",
    paddingHorizontal: 16,
  },
});

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import Svg, { Rect, Path } from "react-native-svg";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import { useAuthStore } from "@/stores/useAuthStore";
import { API_BASE_URL } from "@/api/config";

export default function VerifyEmailScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const params = useLocalSearchParams<{ email?: string }>();
  const storeEmail = useAuthStore((s) => s.email);
  const email = params.email || storeEmail || "janeteb@zmail.com";
  const userRole = useAuthStore((s) => s.role);
  const setIsVerifiedStore = useAuthStore((s) => s.setIsVerified);
  const resendAvailableAt = useAuthStore((s) => s.resendAvailableAt);
  const setResendAvailableAt = useAuthStore((s) => s.setResendAvailableAt);

  const getRemainingSeconds = () => {
    if (!resendAvailableAt) return 60;
    const diff = Math.ceil((resendAvailableAt - Date.now()) / 1000);
    return diff > 0 ? diff : 0;
  };

  const [code, setCode] = useState<string[]>(["", "", "", ""]);
  const [timer, setTimer] = useState<number>(getRemainingSeconds);
  const [canResend, setCanResend] = useState<boolean>(getRemainingSeconds() === 0);
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");

  const inputRefs = [
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
  ];

  // Countdown timer for resend code
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const handleCodeChange = (text: string, index: number) => {
    setError("");
    setSuccessMsg("");
    const newCode = [...code];
    const upperText = text.toUpperCase();

    // Handle pasted multi-character code
    if (upperText.length > 1) {
      const pasted = upperText.slice(0, 4).split("");
      pasted.forEach((char, i) => {
        if (i < 4) newCode[i] = char;
      });
      setCode(newCode);
      if (pasted.length === 4) {
        inputRefs[3].current?.blur();
        handleVerify(newCode.join(""));
      }
      return;
    }

    newCode[index] = upperText;
    setCode(newCode);

    // Auto-advance focus
    if (text && index < 3) {
      inputRefs[index + 1].current?.focus();
    }

    // Auto verify when 4th digit entered
    const fullCode = newCode.join("");
    if (fullCode.length === 4 && newCode.every((digit) => digit !== "")) {
      handleVerify(fullCode);
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !code[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setError("");
    setSuccessMsg("");
    try {
      const targetUrl = `${API_BASE_URL}/api/auth/resend-code`;
      console.log(`[Verify] POST to ${targetUrl}`);
      const res = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const rawText = await res.text();
      let data: any = {};
      try { data = JSON.parse(rawText); } catch { }
      if (!res.ok) throw new Error(data.error ?? "Could not send verification code. Please try again.");

      setSuccessMsg("A new 4-digit PIN has been sent to your email.");
      setCode(["", "", "", ""]);
      setResendAvailableAt(Date.now() + 60000);
      setTimer(60);
      setCanResend(false);
      inputRefs[0].current?.focus();
    } catch (e: any) {
      if (e.message?.includes("Network request failed") || e.name === "TypeError") {
        setError("Unable to connect to server. Please check your internet connection.");
      } else {
        setError(e.message ?? "Could not send verification code. Please try again.");
      }
    }
  };

  const handleVerify = async (enteredCode: string) => {
    setError("");
    try {
      const targetUrl = `${API_BASE_URL}/api/auth/verify-code`;
      console.log(`[Verify] POST to ${targetUrl}`);
      const res = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: enteredCode }),
      });
      const rawText = await res.text();
      let data: any = {};
      try { data = JSON.parse(rawText); } catch { }
      if (!res.ok) throw new Error(data.error ?? "Invalid or expired code. Please try again.");

      setIsVerifiedStore(true);
      setIsVerified(true);
    } catch (e: any) {
      if (e.message?.includes("Network request failed") || e.name === "TypeError") {
        setError("Unable to connect to server. Please check your internet connection.");
      } else {
        setError(e.message ?? "Invalid or expired code. Please try again.");
      }
    }
  };

  const onboardingCompleted = useAuthStore((s) => s.onboardingCompleted);

  const handleContinueExperience = () => {
    if (userRole === "admin") {
      if (!onboardingCompleted) {
        router.replace("/(admin)/onboarding");
      } else {
        router.replace("/(admin)/dashboard");
      }
    } else if (userRole === "staff") {
      router.replace("/(staff)/dashboard");
    } else {
      router.replace("/(auth)/personalize");
    }
  };

  const handleBackNav = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(auth)/signup");
    }
  };

  // If verified, show "You're verified!" screen
  if (isVerified) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.verifiedContent,
            isLandscape && { maxWidth: 620, alignSelf: "center", width: "100%", paddingVertical: 24 },
          ]}
        >
          {/* Centered Checkbox Icon */}
          <View style={[styles.verifiedIconContainer, isLandscape && { marginBottom: 16 }]}>
            <Svg width={isLandscape ? 64 : 100} height={isLandscape ? 64 : 100} viewBox="0 0 100 100" fill="none">
              <Path
                d="M50 8.33337C27.0417 8.33337 8.33337 27.0417 8.33337 50C8.33337 72.9584 27.0417 91.6667 50 91.6667C72.9584 91.6667 91.6667 72.9584 91.6667 50C91.6667 27.0417 72.9584 8.33337 50 8.33337ZM69.9167 40.4167L46.2917 64.0417C45.7084 64.625 44.9167 64.9584 44.0834 64.9584C43.25 64.9584 42.4584 64.625 41.875 64.0417L30.0834 52.25C28.875 51.0417 28.875 49.0417 30.0834 47.8334C31.2917 46.625 33.2917 46.625 34.5 47.8334L44.0834 57.4167L65.5 36C66.7084 34.7917 68.7084 34.7917 69.9167 36C71.125 37.2084 71.125 39.1667 69.9167 40.4167Z"
                fill="#4A080C"
              />
            </Svg>
          </View>

          {/* Title and Subtitle */}
          <Text style={[styles.verifiedTitle, isLandscape && { fontSize: 22, marginBottom: 6 }]}>You’re verified!</Text>
          <Text style={[styles.verifiedSubtitle, isLandscape && { fontSize: 13, marginBottom: 20 }]}>
            Your email is confirmed. Your account is ready to go.
          </Text>

          {/* Bottom Button */}
          <View style={[isLandscape ? { width: "100%", maxWidth: 360 } : styles.bottomContainer]}>
            <Pressable
              style={({ pressed }) => [styles.continueBtn, isLandscape && { paddingVertical: 14 }, { opacity: pressed ? 0.85 : 1 }]}
              onPress={handleContinueExperience}
            >
              <Text style={styles.continueBtnText}>Continue your experience</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={isLandscape ? undefined : Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            isLandscape && {
              maxWidth: 620,
              alignSelf: "center",
              width: "100%",
              paddingTop: 12,
              paddingBottom: 24,
            },
          ]}
        >
          {/* Back Button */}
          <Pressable style={[styles.backBtn, isLandscape && { marginBottom: 12 }]} onPress={handleBackNav}>
            <BackArrowIcon size={20} color="#3A2E1A" />
          </Pressable>

          {/* Top Phone Icon */}
          <View style={[styles.iconContainer, isLandscape && { marginBottom: 12 }]}>
            <Svg width={isLandscape ? 44 : 56} height={isLandscape ? 44 : 56} viewBox="0 0 56 56" fill="none">
              <Rect width={56} height={56} rx={28} fill="#DFDFDF" />
              <Path
                d="M42.955 37.495C42.955 38.035 42.835 38.59 42.58 39.13C42.325 39.67 41.995 40.18 41.56 40.66C40.825 41.47 40.015 42.055 39.1 42.43C38.2 42.805 37.225 43 36.175 43C34.645 43 33.01 42.64 31.285 41.905C29.56 41.17 27.835 40.18 26.125 38.935C24.4 37.675 22.765 36.28 21.205 34.735C19.66 33.175 18.265 31.54 17.02 29.83C15.79 28.12 14.8 26.41 14.08 24.715C13.36 23.005 13 21.37 13 19.81C13 18.79 13.18 17.815 13.54 16.915C13.9 16 14.47 15.16 15.265 14.41C16.225 13.465 17.275 13 18.385 13C18.805 13 19.225 13.09 19.6 13.27C19.99 13.45 20.335 13.72 20.605 14.11L24.085 19.015C24.355 19.39 24.55 19.735 24.685 20.065C24.82 20.38 24.895 20.695 24.895 20.98C24.895 21.34 24.79 21.7 24.58 22.045C24.385 22.39 24.1 22.75 23.74 23.11L22.6 24.295C22.435 24.46 22.36 24.655 22.36 24.895C22.36 25.015 22.375 25.12 22.405 25.24C22.45 25.36 22.495 25.45 22.525 25.54C22.795 26.035 23.26 26.68 23.92 27.46C24.595 28.24 25.315 29.035 26.095 29.83C26.905 30.625 27.685 31.36 28.48 32.035C29.26 32.695 29.905 33.145 30.415 33.415C30.49 33.445 30.58 33.49 30.685 33.535C30.805 33.58 30.925 33.595 31.06 33.595C31.315 33.595 31.51 33.505 31.675 33.34L32.815 32.215C33.19 31.84 33.55 31.555 33.895 31.375C34.24 31.165 34.585 31.06 34.96 31.06C35.245 31.06 35.545 31.12 35.875 31.255C36.205 31.39 36.55 31.585 36.925 31.84L41.89 35.365C42.28 35.635 42.55 35.95 42.715 36.325C42.865 36.7 42.955 37.075 42.955 37.495Z"
                stroke="#292D32"
                strokeWidth={1.5}
                strokeMiterlimit={10}
              />
            </Svg>
          </View>

          {/* Title and Subtitle */}
          <Text style={[styles.title, isLandscape && { fontSize: 22, marginBottom: 4 }]}>Verify your email</Text>
          <Text style={[styles.subtitle, isLandscape && { fontSize: 13, marginBottom: 16 }]}>
            We sent a 4-digit PIN to{" "}
            <Text style={styles.emailHighlight}>{email}</Text>
          </Text>

          {/* 4 OTP Input Boxes */}
          <View style={[styles.otpRow, isLandscape && { marginBottom: 16 }]}>
            {code.map((digit, idx) => {
              const isFilled = digit !== "";
              return (
                <TextInput
                  disableFullscreenUI={true}
                  key={idx}
                  ref={inputRefs[idx]}
                  style={[
                    styles.otpBox,
                    isLandscape && { width: 52, height: 52, fontSize: 22, borderRadius: 12 },
                    isFilled ? styles.otpBoxFilled : styles.otpBoxEmpty,
                  ]}
                  value={digit}
                  onChangeText={(text) => handleCodeChange(text, idx)}
                  onKeyPress={(e) => handleKeyPress(e, idx)}
                  keyboardType="default"
                  autoCapitalize="characters"
                  maxLength={1}
                  selectTextOnFocus
                />
              );
            })}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {successMsg ? <Text style={styles.successText}>{successMsg}</Text> : null}

          {/* Resend Code Row */}
          <View style={[styles.resendRow, isLandscape && { marginBottom: 12 }]}>
            <Text style={styles.resendLabel}>Didn't get it? </Text>
            <Pressable onPress={handleResend} disabled={!canResend}>
              <Text
                style={[
                  styles.resendAction,
                  !canResend && styles.resendDisabled,
                ]}
              >
                Resend code
              </Text>
            </Pressable>
            <Text style={styles.resendTimer}> · {formatTimer(timer)}</Text>
          </View>

          {/* Change Email Address */}
          <Pressable style={styles.changeEmailBtn} onPress={handleBackNav}>
            <Text style={styles.changeEmailText}>Change email address</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FBF7EF",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 24,
    borderWidth: 0.5,
    borderColor: "#EAE3D2",
  },
  iconContainer: {
    marginBottom: 20,
  },
  title: {
    fontFamily: "Fraunces-Bold",
    fontSize: 28,
    color: "#4A080C",
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 14,
    color: "#404040",
    lineHeight: 20,
    marginBottom: 32,
  },
  emailHighlight: {
    fontFamily: "WorkSans_600SemiBold",
    color: "#4A080C",
  },
  otpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  otpBox: {
    width: 64,
    height: 64,
    borderRadius: 14,
    textAlign: "center",
    fontFamily: "Fraunces-Bold",
    fontSize: 26,
    color: "#4A080C",
  },
  otpBoxEmpty: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAE3D2",
  },
  otpBoxFilled: {
    backgroundColor: "#EBE0D3",
    borderWidth: 1,
    borderColor: "#4A080C",
  },
  errorText: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 13,
    color: "#D32F2F",
    textAlign: "center",
    marginBottom: 16,
  },
  successText: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 13,
    color: "#2E7D32",
    textAlign: "center",
    marginBottom: 16,
  },
  resendRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  resendLabel: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 14,
    color: "#404040",
  },
  resendAction: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 14,
    color: "#4A080C",
  },
  resendDisabled: {
    color: "#8A7550",
  },
  resendTimer: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 14,
    color: "#404040",
  },
  changeEmailBtn: {
    alignItems: "center",
    paddingVertical: 8,
  },
  changeEmailText: {
    fontFamily: "WorkSans_500Medium",
    fontSize: 14,
    color: "#4A080C",
    textDecorationLine: "underline",
  },

  /* Verified Screen Styles */
  verifiedContent: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  verifiedIconContainer: {
    marginBottom: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  verifiedTitle: {
    fontFamily: "Fraunces-Bold",
    fontSize: 28,
    color: "#4A080C",
    textAlign: "center",
    marginBottom: 12,
  },
  verifiedSubtitle: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 14,
    color: "#404040",
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 20,
  },
  bottomContainer: {
    position: "absolute",
    bottom: 40,
    left: 24,
    right: 24,
  },
  continueBtn: {
    backgroundColor: "#4A080C",
    borderRadius: 50,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  continueBtnText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
  },
});

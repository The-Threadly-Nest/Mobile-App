import React, { useState } from "react";
import { View, Pressable, Text, ScrollView, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { Headline, Subtext } from "@/shared/components/Headline";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { API_BASE_URL } from "@/api/config";

export default function ForgotPasswordScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    try {
      await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      // Navigate to reset password screen where the user enters the PIN & new password
      router.push({
        pathname: "/(auth)/reset-password",
        params: { email: email.trim() },
      });
    } catch (e: any) {
      setError("Unable to connect to server. Please check your internet connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(auth)/login");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          { flexGrow: 1, paddingHorizontal: 24, justifyContent: "center", paddingTop: 32, paddingBottom: 32 },
          isLandscape && { maxWidth: 620, alignSelf: "center", width: "100%" },
        ]}
      >
        <Pressable onPress={handleBack} style={{ marginBottom: 24, width: 40, height: 40, justifyContent: "center" }}>
          <ChevronLeft size={24} color="#4A080C" />
        </Pressable>

        <Headline className="text-2xl mb-2">Reset your password</Headline>
        <Subtext className="text-sm mb-6">Enter your email and we'll send you a 4-digit reset PIN.</Subtext>

        <Input placeholder="Email address" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />

        {error ? <Text className="font-body text-red-500 text-xs mb-4">{error}</Text> : null}

        <View style={{ marginTop: 12 }}>
          <Button label="Send Reset PIN" onPress={handleSubmit} loading={loading} disabled={!email} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

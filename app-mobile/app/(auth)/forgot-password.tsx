import React, { useState } from "react";
import { View, Pressable, Text } from "react-native";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { Headline, Subtext } from "@/shared/components/Headline";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { API_BASE_URL } from "@/api/config";

export default function ForgotPasswordScreen() {
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
    <View className="flex-1 bg-cream px-6 justify-center">
      <Pressable onPress={handleBack} className="absolute top-14 left-6">
        <ChevronLeft size={24} color="#4A080C" />
      </Pressable>

      <Headline className="text-2xl mb-2">Reset your password</Headline>
      <Subtext className="text-sm mb-8">Enter your email and we'll send you a 4-digit reset PIN.</Subtext>

      <Input placeholder="Email address" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />

      {error ? <Text className="font-body text-red-500 text-xs mb-4">{error}</Text> : null}

      <Button label="Send Reset PIN" onPress={handleSubmit} loading={loading} disabled={!email} />
    </View>
  );
}

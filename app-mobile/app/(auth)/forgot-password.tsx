import React, { useState } from "react";
import { View, Pressable, Text } from "react-native";
import { router } from "expo-router";
import { MailCheck, ChevronLeft } from "lucide-react-native";
import { Headline, Subtext } from "@/shared/components/Headline";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      // Always show success — the backend never reveals whether the
      // email exists, so the UI shouldn't either.
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <View className="flex-1 bg-cream items-center justify-center px-8">
        <MailCheck size={44} color="#4A080C" />
        <Headline className="text-xl mt-4 mb-2 text-center">Check your email</Headline>
        <Subtext className="text-center mb-8">
          If an account exists for {email}, we've sent a link to reset your password. It expires in 30 minutes.
        </Subtext>
        <Button label="Back to Login" onPress={() => router.replace("/(auth)/login")} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-cream px-6 justify-center">
      <Pressable onPress={() => router.back()} className="absolute top-14 left-6">
        <ChevronLeft size={24} color="#4A080C" />
      </Pressable>

      <Headline className="text-2xl mb-2">Reset your password</Headline>
      <Subtext className="text-sm mb-8">Enter your email and we'll send you a reset link.</Subtext>

      <Input placeholder="Email" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />

      <Button label="Send Reset Link" onPress={handleSubmit} loading={loading} disabled={!email} />
    </View>
  );
}

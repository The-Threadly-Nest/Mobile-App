import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { Headline, Subtext } from "@/shared/components/Headline";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { API_BASE_URL } from "@/api/config";

export default function ResetPasswordScreen() {
  const { token, email } = useLocalSearchParams<{ token: string; email: string }>();
  const [inputEmail, setInputEmail] = useState(email || "");
  const [inputToken, setInputToken] = useState(token || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const passwordValid = newPassword.length >= 8 && /[A-Z]/.test(newPassword) && /[0-9]/.test(newPassword);
  const matches = newPassword === confirmPassword && confirmPassword.length > 0;
  const formComplete = inputEmail.trim().length > 0 && inputToken.trim().length === 4 && passwordValid && matches;

  const handleReset = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inputEmail.trim(), token: inputToken.trim(), newPassword }),
      });
      const rawText = await res.text();
      let body: any = {};
      try { body = JSON.parse(rawText); } catch {}
      if (!res.ok) throw new Error(body.error ?? "Could not reset password. Please check your PIN.");
      setSuccess(true);
    } catch (e: any) {
      if (e.message?.includes("Network request failed") || e.name === "TypeError") {
        setError("Unable to connect to server. Please check your internet connection.");
      } else {
        setError(e.message ?? "Could not reset password.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(auth)/forgot-password");
    }
  };

  if (success) {
    return (
      <View className="flex-1 bg-cream items-center justify-center px-8">
        <Headline className="text-xl mb-2 text-center">Password updated</Headline>
        <Subtext className="text-center mb-8">You can now log in with your new password.</Subtext>
        <Button label="Go to Login" onPress={() => router.replace("/(auth)/login")} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-cream px-6 justify-center">
      <Pressable onPress={handleBack} className="absolute top-14 left-6">
        <ChevronLeft size={24} color="#4A080C" />
      </Pressable>

      <Headline className="text-2xl mb-1">Set a new password</Headline>
      <Subtext className="text-sm mb-6">Enter your email, the 4-digit PIN sent to you, and your new password.</Subtext>

      <Input
        placeholder="Email address"
        keyboardType="email-address"
        autoCapitalize="none"
        value={inputEmail}
        onChangeText={setInputEmail}
        editable={!email}
      />
      <Input
        placeholder="4-digit PIN"
        autoCapitalize="characters"
        maxLength={4}
        value={inputToken}
        onChangeText={(val) => setInputToken(val.toUpperCase())}
      />
      <Input placeholder="New password" secureTextEntry value={newPassword} onChangeText={setNewPassword} />
      <Input placeholder="Confirm new password" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} />
      <Text className="font-body text-grey700 text-xs mb-4">At least 8 characters, one uppercase letter, one number</Text>

      {error ? <Text className="font-body text-red-500 text-xs mb-4">{error}</Text> : null}

      <Button label="Reset Password" onPress={handleReset} loading={loading} disabled={!formComplete} />
    </View>
  );
}

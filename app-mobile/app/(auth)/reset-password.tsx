import React, { useState } from "react";
import { View, Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Headline, Subtext } from "@/shared/components/Headline";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

/**
 * Opened via the deep link in the password reset email:
 *   thefashionhouse://reset-password?token=...&email=...
 */
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
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not reset password.");
      setSuccess(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
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
      <Headline className="text-2xl mb-1">Set a new password</Headline>
      <Subtext className="text-sm mb-6">Enter your email and the 4-character code sent to you</Subtext>

      <Input
        placeholder="Email address"
        keyboardType="email-address"
        autoCapitalize="none"
        value={inputEmail}
        onChangeText={setInputEmail}
        editable={!email} // Lock if prefilled from deep link
      />
      <Input
        placeholder="4-character verification code"
        autoCapitalize="characters"
        maxLength={4}
        value={inputToken}
        onChangeText={(val) => setInputToken(val.toUpperCase())}
        editable={!token} // Lock if prefilled from deep link
      />
      <Input placeholder="New password" secureTextEntry value={newPassword} onChangeText={setNewPassword} />
      <Input placeholder="Confirm new password" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} />
      <Text className="font-body text-grey700 text-xs mb-4">At least 8 characters, one uppercase letter, one number</Text>

      {error ? <Text className="font-body text-red-500 text-xs mb-4">{error}</Text> : null}

      <Button label="Reset Password" onPress={handleReset} loading={loading} disabled={!formComplete} />
    </View>
  );
}

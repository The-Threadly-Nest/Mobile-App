import React, { useState } from "react";
import { View, Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Headline, Subtext } from "@/shared/components/Headline";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { useAuthStore } from "@/stores/useAuthStore";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

/**
 * Opened via the deep link in the staff invitation email:
 *   thefashionhouse://activate?token=...&email=...
 * On success, logs the person straight into their Staff dashboard.
 */
export default function ActivateAccountScreen() {
  const { token, email } = useLocalSearchParams<{ token: string; email: string }>();
  const [inputEmail, setInputEmail] = useState(email || "");
  const [inputToken, setInputToken] = useState(token || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const setToken = useAuthStore((s) => s.setToken);
  const setEmailStore = useAuthStore((s) => s.setEmail);
  const setRoleStore = useAuthStore((s) => s.setRole);

  const passwordValid = password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password);
  const matches = password === confirmPassword && confirmPassword.length > 0;
  const formComplete = inputEmail.trim().length > 0 && inputToken.trim().length === 4 && passwordValid && matches;

  const handleActivate = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/activate-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inputEmail.trim(), token: inputToken.trim(), password }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not activate account.");

      setToken(body.token);
      setEmailStore(body.user.email);
      setRoleStore(body.user.role);
      router.replace("/(staff)/dashboard");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-cream px-6 justify-center">
      <Headline className="text-2xl mb-1">Welcome to the team</Headline>
      <Subtext className="text-sm mb-6">Enter your email and the 4-character code to activate your account</Subtext>

      <Input
        placeholder="Email address"
        keyboardType="email-address"
        autoCapitalize="none"
        value={inputEmail}
        onChangeText={setInputEmail}
        editable={!email} // Lock if prefilled from deep link
      />
      <Input
        placeholder="4-character activation code"
        autoCapitalize="characters"
        maxLength={4}
        value={inputToken}
        onChangeText={(val) => setInputToken(val.toUpperCase())}
        editable={!token} // Lock if prefilled from deep link
      />
      <Input placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
      <Input placeholder="Confirm password" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} />
      <Text className="font-body text-grey700 text-xs mb-4">At least 8 characters, one uppercase letter, one number</Text>

      {error ? <Text className="font-body text-red-500 text-xs mb-4">{error}</Text> : null}

      <Button label="Activate Account" onPress={handleActivate} loading={loading} disabled={!formComplete} />
    </View>
  );
}

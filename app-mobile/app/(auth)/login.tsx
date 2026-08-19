import React, { useState } from "react";
import { View, Pressable, Text, KeyboardAvoidingView, Platform } from "react-native";
import { router } from "expo-router";
import { Headline, Subtext } from "@/shared/components/Headline";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { useAuthStore } from "@/stores/useAuthStore";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const setToken = useAuthStore((s) => s.setToken);
  const setEmailStore = useAuthStore((s) => s.setEmail);
  const setRoleStore = useAuthStore((s) => s.setRole);

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Login failed.");

      setToken(body.token);
      setEmailStore(body.user.email);
      setRoleStore(body.user.role);

      if (body.user.role === "admin") router.replace("/(admin)/dashboard");
      else if (body.user.role === "staff") router.replace("/(staff)/dashboard");
      else router.replace("/(customer)/browse");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-cream">
      <View className="flex-1 px-6 justify-center">
        <Headline className="text-3xl mb-2">Welcome back</Headline>
        <Subtext className="text-sm mb-8">Log in to continue</Subtext>

        <Input placeholder="Email" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
        <Input placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />

        <Pressable onPress={() => router.push("/(auth)/forgot-password")} className="self-end mb-4">
          <Text className="font-body text-oxblood text-sm underline">Forgot password?</Text>
        </Pressable>

        {error ? <Text className="font-body text-red-500 text-xs mb-4">{error}</Text> : null}

        <Button label="Sign In" onPress={handleLogin} loading={loading} disabled={!email || !password} />

        <Pressable onPress={() => router.push("/(auth)/signup")} className="mt-6">
          <Text className="font-body text-center text-grey700 text-sm">
            Don't have an account? <Text className="font-body-semibold text-oxblood">Sign up</Text>
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

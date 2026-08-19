import React, { useState } from "react";
import { View, TextInput, Pressable, Text, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { router } from "expo-router";
import { Headline, Subtext } from "@/shared/components/Headline";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { useAuthStore } from "@/stores/useAuthStore";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export default function SignupScreen() {
  const [role, setRole] = useState<"admin" | "customer">("customer");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const setToken = useAuthStore((s) => s.setToken);
  const setEmailStore = useAuthStore((s) => s.setEmail);
  const setRoleStore = useAuthStore((s) => s.setRole);

  const passwordValid = password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password);

  const handleSignup = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, role, name: name.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not create account.");

      setToken(body.token);
      setEmailStore(body.user.email);
      setRoleStore(body.user.role);
      router.replace(role === "admin" ? "/(admin)/dashboard" : "/(customer)/browse");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-cream">
      <ScrollView className="flex-1 px-6 pt-16" showsVerticalScrollIndicator={false}>
        <Headline className="text-3xl mb-2">Create your account</Headline>
        <Subtext className="text-sm mb-6">Join as a fashion house or start browsing today</Subtext>

        <View className="flex-row gap-2 mb-5">
          <Pressable
            onPress={() => setRole("admin")}
            className={`flex-1 py-3 rounded-pill items-center ${role === "admin" ? "bg-oxblood" : "bg-white border border-oxblood"}`}
          >
            <Text className={`font-body-semibold text-sm ${role === "admin" ? "text-cream" : "text-oxblood"}`}>Fashion House</Text>
          </Pressable>
          <Pressable
            onPress={() => setRole("customer")}
            className={`flex-1 py-3 rounded-pill items-center ${role === "customer" ? "bg-oxblood" : "bg-white border border-oxblood"}`}
          >
            <Text className={`font-body-semibold text-sm ${role === "customer" ? "text-cream" : "text-oxblood"}`}>Customer</Text>
          </Pressable>
        </View>

        <Input placeholder={role === "admin" ? "Fashion house name" : "Full name"} value={name} onChangeText={setName} />
        <Input placeholder="Email" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
        <Input placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
        <Text className="font-body text-grey700 text-xs mb-4">At least 8 characters, one uppercase letter, one number</Text>

        {error ? <Text className="font-body text-red-500 text-xs mb-4">{error}</Text> : null}

        <Button label="Create Account" onPress={handleSignup} loading={loading} disabled={!name || !email || !passwordValid} />

        <Pressable onPress={() => router.push("/(auth)/login")} className="mt-6 mb-10">
          <Text className="font-body text-center text-grey700 text-sm">
            Already have an account? <Text className="font-body-semibold text-oxblood">Log in</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

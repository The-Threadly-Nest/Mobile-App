import React, { useState } from "react";
import { View, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { ChevronLeft, Send } from "lucide-react-native";
import { Headline } from "@/shared/components/Headline";
import { useAuthStore } from "@/stores/useAuthStore";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

interface Turn { role: "user" | "model"; text: string }

export default function BookingChatScreen() {
  const { fashionHouseId } = useLocalSearchParams<{ fashionHouseId: string }>();
  const [history, setHistory] = useState<Turn[]>([
    { role: "model", text: "Hi! I can help you book a fitting. What are you thinking?" },
  ]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const token = useAuthStore((s) => s.token);

  const send = async () => {
    if (!draft.trim()) return;
    const userTurn: Turn = { role: "user", text: draft.trim() };
    const nextHistory = [...history, userTurn];
    setHistory(nextHistory);
    setDraft("");
    setSending(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fashionHouseId, message: userTurn.text, history }),
      });
      const body = await res.json();

      if (body.type === "booking_created") {
        setBookingConfirmed(true);
        setHistory([...nextHistory, { role: "model", text: "Your appointment request has been sent! The fashion house will confirm shortly." }]);
      } else {
        setHistory([...nextHistory, { role: "model", text: body.reply }]);
      }
    } catch {
      setHistory([...nextHistory, { role: "model", text: "Something went wrong — please try again." }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-4 pb-2 bg-oxblood">
        <Pressable onPress={() => router.back()} className="mr-3">
          <ChevronLeft size={24} color="#FBF7EF" />
        </Pressable>
        <Text className="font-body-semibold text-cream text-base">Booking Assistant</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView className="flex-1 px-5 pt-3">
          {history.map((turn, i) => (
            <View key={i} className={`mb-3 max-w-[85%] ${turn.role === "user" ? "self-end items-end" : "self-start items-start"}`}>
              <View className={`px-4 py-2.5 rounded-2xl ${turn.role === "user" ? "bg-oxblood" : "bg-white border border-grey100"}`}>
                <Text className={`font-body ${turn.role === "user" ? "text-cream" : "text-ink"}`}>{turn.text}</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        {!bookingConfirmed && (
          <View className="flex-row items-center px-5 py-3 border-t border-grey100">
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Type a message"
              placeholderTextColor="#A6926B"
              className="flex-1 border border-grey100 rounded-pill px-4 py-3 mr-2 bg-white font-body text-ink"
            />
            <Pressable onPress={send} disabled={sending} className="w-11 h-11 bg-oxblood rounded-full items-center justify-center">
              <Send size={18} color="#FBF7EF" />
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

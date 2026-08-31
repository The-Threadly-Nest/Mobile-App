import React, { useState, useEffect, useRef } from "react";
import {
  View,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Text,
  ActivityIndicator,
  Modal,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { ArrowUp, Check } from "lucide-react-native";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import { useAuthStore } from "@/stores/useAuthStore";
import { API_BASE_URL } from "@/api/config";

interface Slot {
  id: string;
  label: string;
}

interface Turn {
  role: "user" | "model";
  text: string;
  options?: string[];
  slots?: Slot[];
}

function sanitizeText(text: string): string {
  if (!text) return "";
  return text
    .replace(/—/g, ", ")
    .replace(/--/g, ", ")
    .replace(/_/g, "");
}

const DEFAULT_INITIAL_TURNS: Turn[] = [
  {
    role: "model",
    text: "Welcome to Adaeze Couture! We are delighted to assist you with your fitting. What occasion are we styling for today?",
    options: ["Wedding", "Owambe", "Just for me"],
  },
];

export default function BookingChatScreen() {
  const { fashionHouseId } = useLocalSearchParams<{ fashionHouseId: string }>();
  const [history, setHistory] = useState<Turn[]>(DEFAULT_INITIAL_TURNS);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [selectedSlotLabel, setSelectedSlotLabel] = useState<string | null>(null);
  const [fashionHouseName] = useState("Adaeze Couture");
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [isFavourite, setIsFavourite] = useState(false);
  const token = useAuthStore((s) => s.token);
  const scrollRef = useRef<ScrollView>(null);

  // Load session history on mount
  useEffect(() => {
    (async () => {
      try {
        if (token && fashionHouseId) {
          const res = await fetch(`${API_BASE_URL}/api/chat/session/${fashionHouseId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const body = await res.json();
            const serverHistory: Turn[] = body.history ?? [];
            if (serverHistory.length > 0) {
              setHistory(serverHistory.map((t) => ({ ...t, text: sanitizeText(t.text) })));
            }
          }
        }
      } catch {
        // Fallback to default
      } finally {
        setLoadingSession(false);
      }
    })();
  }, [fashionHouseId, token]);

  const handleSend = async (messageText?: string) => {
    const textToSend = (messageText ?? draft).trim();
    if (!textToSend || sending) return;

    const userTurn: Turn = { role: "user", text: textToSend };
    setHistory((prev) => [...prev, userTurn]);
    setDraft("");
    setSending(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    const lower = textToSend.toLowerCase();

    try {
      let replyText = "";
      let responseType = "";

      if (token && fashionHouseId) {
        const res = await fetch(`${API_BASE_URL}/api/chat/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ fashionHouseId, message: textToSend }),
        });
        if (res.ok) {
          const body = await res.json();
          replyText = sanitizeText(body.reply);
          responseType = body.type;
        }
      }

      if (responseType === "booking_created" || lower.includes("slot") || lower.includes("sep")) {
        setBookingConfirmed(true);
        const confirmTurn: Turn = {
          role: "model",
          text: replyText || `Your fitting request with ${fashionHouseName} has been received! Our team will confirm shortly.`,
        };
        setHistory((prev) => [...prev, confirmTurn]);

        const targetSlot = textToSend.replace(/^Book slot:\s*/i, "") || selectedSlotLabel || "Sat, 6 Sep · 10:00 AM";

        setTimeout(() => {
          router.push({
            pathname: "/(customer)/confirmation",
            params: {
              fashionHouseName,
              garment: "Aso-Ebi",
              fittingDate: targetSlot,
              estimate: "₦850,000 – ₦1,000,000",
            },
          });
        }, 1200);
        return;
      }

      // Interactive turn generation based on conversation stage
      let responseTurn: Turn = {
        role: "model",
        text: replyText || `Wonderful! We would be honored to craft something exquisite for you. What garment style do you have in mind?`,
      };

      if (lower.includes("wedding") || lower.includes("owambe") || lower.includes("just for me")) {
        responseTurn.text = replyText || `Wonderful! We would be honored to craft something exquisite for you. What garment style do you have in mind?`;
        responseTurn.options = ["Bridal Gown", "Aso-Ebi", "Both"];
      } else if (lower.includes("gown") || lower.includes("aso-ebi") || lower.includes("both")) {
        responseTurn.text = replyText || `Excellent choice. Here are the upcoming fitting slots available at ${fashionHouseName}:`;
        responseTurn.slots = [
          { id: "1", label: "Sat, 6 Sep · 10:00 AM" },
          { id: "2", label: "Sat, 6 Sep · 2:00 PM" },
          { id: "3", label: "Mon, 8 Sep · 11:00 AM" },
        ];
      }

      setHistory((prev) => [...prev, responseTurn]);
    } catch {
      // Fallback interactive response
      let responseTurn: Turn = {
        role: "model",
        text: `Wonderful! We would be honored to craft something exquisite for you. What garment style do you have in mind?`,
        options: ["Bridal Gown", "Aso-Ebi", "Both"],
      };

      if (lower.includes("gown") || lower.includes("aso-ebi") || lower.includes("both")) {
        responseTurn.text = `Excellent choice. Here are the upcoming fitting slots available at ${fashionHouseName}:`;
        responseTurn.options = undefined;
        responseTurn.slots = [
          { id: "1", label: "Sat, 6 Sep · 10:00 AM" },
          { id: "2", label: "Sat, 6 Sep · 2:00 PM" },
          { id: "3", label: "Mon, 8 Sep · 11:00 AM" },
        ];
      } else if (lower.includes("slot") || lower.includes("sep")) {
        setBookingConfirmed(true);
        responseTurn.text = `Your fitting request with ${fashionHouseName} has been received! Our team will confirm shortly.`;
        responseTurn.options = undefined;

        const targetSlot = textToSend.replace(/^Book slot:\s*/i, "") || selectedSlotLabel || "Sat, 6 Sep · 10:00 AM";

        setTimeout(() => {
          router.push({
            pathname: "/(customer)/confirmation",
            params: {
              fashionHouseName,
              garment: "Aso-Ebi",
              fittingDate: targetSlot,
              estimate: "₦850,000 – ₦1,000,000",
            },
          });
        }, 1200);
      }

      setHistory((prev) => [...prev, responseTurn]);
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      {/* Top Header */}
      <View className="flex-row items-center px-6 py-4 bg-cream">
        <Pressable
          onPress={() => router.back()}
          className="w-9 h-9 rounded-full border border-[rgba(0,0,0,0.2)] bg-white items-center justify-center mr-4"
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
        >
          <BackArrowIcon size={18} color="#000000" />
        </Pressable>

        <View className="w-10 h-10 rounded-full bg-oxblood items-center justify-center mr-3">
          <Text className="font-display font-bold text-white text-[16px]">A</Text>
        </View>

        <View className="flex-1">
          <Text className="font-body-semibold text-[17px] text-oxblood">
            {fashionHouseName}
          </Text>
          <Text className="font-body text-[13px] text-grey700">
            Booking Assistant
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          ref={scrollRef}
          className="flex-1 px-6 pt-2"
          contentContainerStyle={{ paddingBottom: 24, gap: 16 }}
          showsVerticalScrollIndicator={false}
        >
          {loadingSession ? (
            <View className="py-8 items-center">
              <ActivityIndicator size="small" color="#4A080C" />
            </View>
          ) : (
            history.map((turn, index) => {
              const isUser = turn.role === "user";
              return (
                <View key={index} className="w-full">
                  {!isUser && (
                    <Text className="font-body-medium text-[13px] text-[#C4A763] mb-1">
                      Booking Assistant
                    </Text>
                  )}

                  <View
                    className={`max-w-[85%] p-4 ${
                      isUser
                        ? "bg-[#C4A763] self-end rounded-[16px] rounded-br-[4px]"
                        : "bg-oxblood self-start rounded-[16px] rounded-bl-[4px]"
                    }`}
                  >
                    <Text
                      className={`font-body text-[15px] leading-[22px] ${
                        isUser ? "text-white" : "text-white"
                      }`}
                    >
                      {sanitizeText(turn.text)}
                    </Text>
                  </View>

                  {/* Options Chips Component matching Figma design */}
                  {turn.options && turn.options.length > 0 && (
                    <View className="-mx-6 mt-3">
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 24, gap: 10 }}
                      >
                        {turn.options.map((opt, oIdx) => (
                          <Pressable
                            key={oIdx}
                            onPress={() => handleSend(opt)}
                            className="bg-[#FBF7EF] border border-[#4A080C] px-5 py-2.5 rounded-full items-center justify-center"
                            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                          >
                            <Text className="font-body text-[13px] text-oxblood font-medium">
                              {opt}
                            </Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* Slot Selection Card matching Figma SVG */}
                  {turn.slots && turn.slots.length > 0 && (
                    <View className="w-full bg-white rounded-[24px] p-6 mt-3 shadow-sm">
                      {turn.slots.map((slot, idx) => {
                        const isSelected = selectedSlotLabel === slot.label;
                        return (
                          <View key={slot.id}>
                            <View className="flex-row items-center justify-between py-2.5">
                              <Text className="font-body text-[15px] text-oxblood font-medium flex-1 mr-3">
                                {slot.label}
                              </Text>
                              <Pressable
                                disabled={!!selectedSlotLabel || sending}
                                onPress={() => {
                                  if (!selectedSlotLabel && !sending) {
                                    setSelectedSlotLabel(slot.label);
                                    handleSend(`Book slot: ${slot.label}`);
                                  }
                                }}
                                className={`px-4 py-1.5 rounded-full items-center justify-center ${
                                  isSelected ? "bg-oxblood" : "bg-[#D5C4C6]"
                                }`}
                                style={({ pressed }) => ({
                                  backgroundColor: (pressed || isSelected) ? "#4A080C" : "#D5C4C6",
                                  opacity: (selectedSlotLabel && !isSelected) ? 0.4 : 1,
                                })}
                              >
                                <Text
                                  className={`font-body-medium text-[13.5px] ${
                                    isSelected ? "text-white" : "text-oxblood"
                                  }`}
                                >
                                  {isSelected ? "Selected" : "Select"}
                                </Text>
                              </Pressable>
                            </View>
                            {idx < turn.slots!.length - 1 && (
                              <View className="border-b border-dashed border-[#D1D1D1] my-2.5" />
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })
          )}

          {sending && (
            <View className="items-start max-w-[85%]">
              <Text className="font-body-medium text-[12px] text-gold mb-1">
                {fashionHouseName} Assistant
              </Text>
              <View className="bg-oxblood rounded-t-[16px] rounded-r-[16px] rounded-bl-[4px] px-6 py-4">
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input Area */}
        {!bookingConfirmed && !loadingSession && (
          <View className="px-8 pt-3 pb-8 bg-cream">
            <View className="flex-row items-center gap-4">
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Type a message..."
                placeholderTextColor="rgba(74, 8, 12, 0.7)"
                className="flex-1 bg-white border border-oxblood rounded-full px-6 py-3.5 font-body text-[14px] text-oxblood"
                onSubmitEditing={() => handleSend()}
                returnKeyType="send"
              />
              <Pressable
                onPress={() => handleSend()}
                disabled={sending || !draft.trim()}
                className={`w-11 h-11 bg-oxblood rounded-full items-center justify-center ${
                  !draft.trim() || sending ? "opacity-50" : "opacity-100"
                }`}
                style={({ pressed }) => [{ opacity: pressed ? 0.8 : draft.trim() ? 1 : 0.5 }]}
              >
                <ArrowUp size={20} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

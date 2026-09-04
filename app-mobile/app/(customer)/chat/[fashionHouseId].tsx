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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
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
    .replace(/_/g, "")
    .replace(/atelier/gi, "Fashion House");
}

function cleanRawSlotText(text: string): string {
  if (!text) return "";
  let cleaned = sanitizeText(text);
  // Remove trailing or embedded raw date lines like "Sat, 6 Sep · 10:00 AM" so interactive cards handle it
  cleaned = cleaned
    .replace(/(?:\r?\n|\r)?(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s*\d+\s+[A-Za-z]+(?:\s*[·•-]\s*\d+:\d+\s*[AP]M)?/gi, "")
    .trim();
  return cleaned;
}

const DEFAULT_INITIAL_TURNS: Turn[] = [
  {
    role: "model",
    text: "Welcome! We are delighted to assist you with your fitting. What occasion are we styling for today?",
    options: ["Wedding", "Owambe / Gala", "Casual & Daily", "Custom Bespoke"],
  },
];

export default function BookingChatScreen() {
  const insets = useSafeAreaInsets();
  const { fashionHouseId, fashionHouseName: paramFhName, garmentName, garmentPrice } = useLocalSearchParams<{
    fashionHouseId: string;
    fashionHouseName?: string;
    garmentName?: string;
    garmentPrice?: string;
  }>();
  const [history, setHistory] = useState<Turn[]>(DEFAULT_INITIAL_TURNS);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [selectedSlotLabel, setSelectedSlotLabel] = useState<string | null>(null);
  const [fashionHouseName, setFashionHouseName] = useState(paramFhName || "Fashion House");
  const [selectedGarment, setSelectedGarment] = useState(garmentName || "Bespoke Fitting Session");
  const [selectedEstimate, setSelectedEstimate] = useState(garmentPrice || "Finalized at fitting");
  const [houseCategories, setHouseCategories] = useState<string[]>([]);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [isFavourite, setIsFavourite] = useState(false);
  const token = useAuthStore((s) => s.token);
  const scrollRef = useRef<ScrollView>(null);

  // Load session history and real fashion house name on mount
  useEffect(() => {
    (async () => {
      try {
        if (fashionHouseId) {
          const fhRes = await fetch(`${API_BASE_URL}/api/fashion-houses/${fashionHouseId}`);
          if (fhRes.ok) {
            const fhBody = await fhRes.json();
            if (fhBody.shopName) {
              setFashionHouseName(fhBody.shopName);
            }
            if (Array.isArray(fhBody.categories) && fhBody.categories.length > 0) {
              setHouseCategories(fhBody.categories);
            }
          } else if (!paramFhName) {
            const listRes = await fetch(`${API_BASE_URL}/api/fashion-houses`);
            if (listRes.ok) {
              const listBody = await listRes.json();
              if (Array.isArray(listBody) && listBody.length > 0) {
                setFashionHouseName(listBody[0].shopName);
                if (Array.isArray(listBody[0].categories)) {
                  setHouseCategories(listBody[0].categories);
                }
              }
            }
          }
        }
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

    // Dynamically update selected garment if customer chose/typed a style
    let activeGarment = selectedGarment;
    if (
      !lower.startsWith("book slot") &&
      !lower.includes("fabric") &&
      !lower.includes("bring my own") &&
      !lower.includes("discuss at fitting") &&
      !lower.includes("wedding") &&
      !lower.includes("owambe") &&
      !lower.includes("just for me")
    ) {
      if (
        lower.includes("gown") ||
        lower.includes("aso-ebi") ||
        lower.includes("agbada") ||
        lower.includes("kaftan") ||
        lower.includes("senator") ||
        lower.includes("suit") ||
        lower.includes("dress") ||
        lower.includes("corset") ||
        lower.includes("boubou") ||
        lower.includes("buba") ||
        lower.includes("skirt") ||
        lower.includes("blouse") ||
        houseCategories.some((c) => lower.includes(c.toLowerCase()))
      ) {
        activeGarment = textToSend;
        setSelectedGarment(textToSend);
      }
    }

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
          if (body.booking?.styleNotes) {
            activeGarment = body.booking.styleNotes;
            setSelectedGarment(body.booking.styleNotes);
          }
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

        // Persist real booking to backend only if AI did not already create it and not already confirmed
        if (responseType !== "booking_created" && !bookingConfirmed && token && fashionHouseId) {
          fetch(`${API_BASE_URL}/api/orders/my-orders`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              fashionHouseId,
              fashionHouseName,
              garment: activeGarment,
              fittingDate: targetSlot,
            }),
          }).catch(() => {});
        }

        setTimeout(() => {
          setHistory(DEFAULT_INITIAL_TURNS);
          setBookingConfirmed(false);
          router.push({
            pathname: "/(customer)/confirmation",
            params: {
              fashionHouseName,
              garment: activeGarment,
              fittingDate: targetSlot,
              estimate: selectedEstimate,
            },
          });
        }, 1200);
        return;
      }

      // Dynamic style options from the fashion house's real specializations
      const styleOptions =
        houseCategories.length > 0
          ? houseCategories.slice(0, 4)
          : ["Bridal Gown", "Aso-Ebi", "Agbada", "Senator Kaftan"];

      const cleanedReply = cleanRawSlotText(replyText);
      const lowerReply = replyText.toLowerCase();

      // Check if slot booking was suggested in the reply or requested by user
      const mentionsSlots =
        lowerReply.includes("slot") ||
        lowerReply.includes("reserve your session") ||
        lowerReply.includes("fitting slot") ||
        lowerReply.includes("select an available") ||
        lowerReply.includes("convenient time below") ||
        lowerReply.includes("sep ·") ||
        lowerReply.includes("10:00 am") ||
        lowerReply.includes("2:00 pm");

      const isFabricChoice =
        lower.includes("fabric") ||
        lower.includes("bring my own") ||
        lower.includes("discuss at fitting");

      const isOccasionChoice =
        !mentionsSlots && (
          lower.includes("wedding") ||
          lower.includes("owambe") ||
          lower.includes("gala") ||
          lower.includes("casual") ||
          lower.includes("just for me") ||
          lower.includes("custom bespoke")
        );

      const isStyleChoice =
        !mentionsSlots && (
          lower.includes("gown") ||
          lower.includes("aso-ebi") ||
          lower.includes("both") ||
          lower.includes("agbada") ||
          lower.includes("kaftan") ||
          lower.includes("senator") ||
          lower.includes("suit") ||
          lower.includes("corset") ||
          houseCategories.some((c) => lower.includes(c.toLowerCase()))
        );

      const isRequestingSlots =
        mentionsSlots ||
        isFabricChoice ||
        lower.includes("date") ||
        lower.includes("slot") ||
        lower.includes("time") ||
        lower.includes("when") ||
        lower.includes("schedule") ||
        lower.includes("appointment") ||
        lower.includes("book") ||
        lower.includes("fitting");

      let responseTurn: Turn = {
        role: "model",
        text: cleanedReply || `We would love to craft this for you! Would you like to explore our in-house fabric collection, or bring your own?`,
      };

      if (isRequestingSlots) {
        responseTurn.text = cleanedReply || `Here are the upcoming fitting slots available at ${fashionHouseName}. Please select a convenient time below:`;
        responseTurn.options = undefined; // Strictly clear options so pills and slots never clash
        responseTurn.slots = [
          { id: "1", label: "Sat, 6 Sep · 10:00 AM" },
          { id: "2", label: "Sat, 6 Sep · 2:00 PM" },
          { id: "3", label: "Mon, 8 Sep · 11:00 AM" },
          { id: "4", label: "Tue, 9 Sep · 3:00 PM" },
        ];
      } else if (isOccasionChoice) {
        responseTurn.text = cleanedReply || `Wonderful! We would be honored to craft something exquisite for you. What garment style do you have in mind?`;
        responseTurn.options = styleOptions;
        responseTurn.slots = undefined;
      } else if (isStyleChoice) {
        responseTurn.text = cleanedReply || `We would love to create this bespoke piece for you! Would you like to select a fabric from our in-house collection, or bring your own?`;
        responseTurn.options = ["Fashion House fabric", "Bring my own fabric", "Discuss at fitting"];
        responseTurn.slots = undefined;
      } else {
        responseTurn.options = ["Fashion House fabric", "Bring my own fabric", "Discuss at fitting"];
        responseTurn.slots = undefined;
      }

      setHistory((prev) => [...prev, responseTurn]);
    } catch {
      // Fallback interactive response
      const styleOptions =
        houseCategories.length > 0
          ? houseCategories.slice(0, 4)
          : ["Bridal Gown", "Aso-Ebi", "Agbada", "Senator Kaftan"];

      const isOccasionChoice =
        lower.includes("wedding") ||
        lower.includes("owambe") ||
        lower.includes("gala") ||
        lower.includes("casual") ||
        lower.includes("just for me") ||
        lower.includes("custom bespoke");

      const isStyleChoice =
        lower.includes("gown") ||
        lower.includes("aso-ebi") ||
        lower.includes("both") ||
        lower.includes("agbada") ||
        lower.includes("kaftan");

      const isFabricChoice =
        lower.includes("fabric") ||
        lower.includes("bring my own") ||
        lower.includes("discuss at fitting");

      const isRequestingSlots =
        isFabricChoice ||
        lower.includes("date") ||
        lower.includes("slot") ||
        lower.includes("time") ||
        lower.includes("when") ||
        lower.includes("schedule") ||
        lower.includes("appointment") ||
        lower.includes("book") ||
        lower.includes("fitting");

      let responseTurn: Turn = {
        role: "model",
        text: `Wonderful! We would be honored to craft something exquisite for you. What garment style do you have in mind?`,
      };

      if (isRequestingSlots) {
        responseTurn.text = `Here are the upcoming fitting slots available at ${fashionHouseName}. Please select a convenient time below:`;
        responseTurn.options = undefined;
        responseTurn.slots = [
          { id: "1", label: "Sat, 6 Sep · 10:00 AM" },
          { id: "2", label: "Sat, 6 Sep · 2:00 PM" },
          { id: "3", label: "Mon, 8 Sep · 11:00 AM" },
          { id: "4", label: "Tue, 9 Sep · 3:00 PM" },
        ];
      } else if (isOccasionChoice) {
        responseTurn.text = `Wonderful! We would be honored to craft something exquisite for you. What garment style do you have in mind?`;
        responseTurn.options = styleOptions;
        responseTurn.slots = undefined;
      } else if (isStyleChoice) {
        responseTurn.text = `We would love to create this piece for you! Would you like to select a fabric from our in-house collection, or bring your own?`;
        responseTurn.options = ["Fashion House fabric", "Bring my own fabric", "Discuss at fitting"];
        responseTurn.slots = undefined;
      } else {
        responseTurn.options = ["Fashion House fabric", "Bring my own fabric", "Discuss at fitting"];
        responseTurn.slots = undefined;
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
          className="w-10 h-10 rounded-full border border-[rgba(0,0,0,0.2)] bg-white items-center justify-center mr-4"
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
        >
          <BackArrowIcon size={18} color="#000000" />
        </Pressable>

        <View className="w-10 h-10 rounded-full bg-oxblood items-center justify-center mr-3">
          <Text className="font-display font-bold text-white text-[16px]">
            {fashionHouseName.charAt(0).toUpperCase()}
          </Text>
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
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
        style={{ flex: 1 }}
      >
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          className="flex-1 px-6 pt-2"
          contentContainerStyle={{ paddingBottom: 20, gap: 16 }}
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

                  {/* Options Chips Component in 2-by-2 Grid Layout */}
                  {turn.options && turn.options.length > 0 && (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                      {turn.options.map((opt, oIdx) => (
                        <Pressable
                          key={oIdx}
                          onPress={() => handleSend(opt)}
                          style={({ pressed }) => [
                            {
                              width: turn.options!.length > 1 ? "48.5%" : "100%",
                              backgroundColor: "#FBF7EF",
                              borderWidth: 1,
                              borderColor: "#4A080C",
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                              borderRadius: 20,
                              alignItems: "center",
                              justifyContent: "center",
                              opacity: pressed ? 0.7 : 1,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              fontFamily: "WorkSans_500Medium",
                              fontSize: 13,
                              color: "#4A080C",
                              textAlign: "center",
                            }}
                          >
                            {opt}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}

                  {/* Slot Selection Card matching Figma SVG */}
                  {turn.slots && turn.slots.length > 0 && (
                    <View className="w-full bg-white rounded-[24px] p-6 mt-3 shadow-sm">
                      {turn.slots.map((slot, idx) => {
                        const isSelected = selectedSlotLabel === slot.label;
                        return (
                          <View key={slot.id}>
                            <View className="flex-row items-center justify-between py-2">
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
                                className={`px-4 py-2 rounded-full items-center justify-center ${
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
                              <View className="border-b border-dashed border-[#D1D1D1] my-2" />
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
          <View
            style={{
              paddingHorizontal: 24,
              paddingTop: 8,
              paddingBottom: Math.max(insets.bottom, 16),
              backgroundColor: "#FBF7EF",
            }}
          >
            <View className="flex-row items-center gap-3">
              <TextInput
                value={draft}
                onChangeText={setDraft}
                onFocus={() => {
                  setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
                }}
                placeholder="Type a message..."
                placeholderTextColor="rgba(74, 8, 12, 0.7)"
                className="flex-1 bg-white border border-oxblood rounded-full px-5 py-3 font-body text-[14px] text-oxblood"
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

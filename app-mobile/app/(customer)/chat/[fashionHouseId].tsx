import React, { useState, useEffect, useRef } from "react";
import { View, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator, Modal, Switch } from "react-native";
import { TextInput, Text } from "@/shared/components/Typography";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { ArrowUp, Check } from "lucide-react-native";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import BottomAnchoredChatScrollView from "@/shared/components/BottomAnchoredChatScrollView";
import { useAuthStore } from "@/stores/useAuthStore";
import { ApiError, apiFetch } from "@/shared/utils/apiClient";
import {
  createChatCacheOwner,
  readChatCache,
  writeChatCache,
} from "@/shared/services/chatCache";
import { createIdempotencyKey } from "@/shared/utils/idempotency";
import BookingSlotPicker from "@/shared/components/BookingSlotPicker";
import BookingSpecializationPicker from "@/shared/components/BookingSpecializationPicker";

interface Slot {
  id: string;
  label: string;
  date?: string;
  time?: string;
}

interface Turn {
  role: "user" | "model";
  text: string;
  options?: string[];
  slots?: Slot[];
  slotStage?: "dates" | "times";
  slotPickerComplete?: boolean;
  garmentPicker?: boolean;
  garmentPickerComplete?: boolean;
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
  // Remove raw date lines so the interactive cards remain the single source of slot details.
  cleaned = cleaned
    .replace(/(?:\r?\n|\r)?(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s*\d+\s+[A-Za-z]+(?:\s*[·•-]\s*\d+:\d+\s*[AP]M)?/gi, "")
    .trim();
  return cleaned;
}

const DEFAULT_INITIAL_TURNS: Turn[] = [
  {
    role: "model",
    text: "Welcome! Here's what this fashion house specializes in. What would you like us to make?",
    garmentPicker: true,
  },
];

export default function BookingChatScreen() {
  const insets = useSafeAreaInsets();
  const { fashionHouseId, fashionHouseName: paramFhName, garmentName, garmentPrice, catalogItemId, startNew } = useLocalSearchParams<{
    fashionHouseId: string;
    fashionHouseName?: string;
    garmentName?: string;
    garmentPrice?: string;
    catalogItemId?: string;
    startNew?: string;
  }>();

  const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);

  const initialTurns: Turn[] = garmentName
    ? [
        {
          role: "model",
          text: `Welcome! Let's arrange your fitting for ${garmentName}${garmentPrice ? ` (${garmentPrice})` : ""}. Choose an available date, then a time below.`,
          slots: availableSlots,
        },
      ]
    : DEFAULT_INITIAL_TURNS;

  const [history, setHistory] = useState<Turn[]>(initialTurns);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [selectedSlotLabel, setSelectedSlotLabel] = useState<string | null>(null);
  const [fashionHouseName, setFashionHouseName] = useState(paramFhName || "Fashion House");
  const [selectedGarment, setSelectedGarment] = useState(garmentName || "Bespoke Fitting Session");
  const [selectedCatalogIds, setSelectedCatalogIds] = useState<string[]>(catalogItemId ? [catalogItemId] : []);
  const [selectedSpecialization, setSelectedSpecialization] = useState<string | null>(null);
  const [selectedEstimate, setSelectedEstimate] = useState(garmentPrice || "Finalized at fitting");
  const [houseCategories, setHouseCategories] = useState<string[]>([]);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [isFavourite, setIsFavourite] = useState(false);
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const email = useAuthStore((s) => s.email);
  const cacheOwner = createChatCacheOwner(role, email);
  const hydratedConversationIdRef = useRef<string | null>(null);
  const slotRequestKeysRef = useRef<Record<string, string>>({});
  const sendLockRef = useRef(false);

  // Load session history and real fashion house name on mount
  useEffect(() => {
    let cancelled = false;

    (async () => {
      hydratedConversationIdRef.current = null;
      setLoadingSession(true);
      setHistory(initialTurns);
      setBookingConfirmed(false);
      setSelectedSlotLabel(null);
      setSelectedGarment(garmentName || "Bespoke Fitting Session");
      setSelectedCatalogIds(catalogItemId ? [catalogItemId] : []);
      setSelectedSpecialization(null);
      setHouseCategories([]);
      setSelectedEstimate(garmentPrice || "Finalized at fitting");
      slotRequestKeysRef.current = {};
      try {
        const cached = await readChatCache<Turn[]>(
          cacheOwner,
          "customer-booking",
          fashionHouseId
        );
        if (cancelled) return;
        if (cached && !startNew) {
          setHistory(Array.isArray(cached) ? cached : initialTurns);
          hydratedConversationIdRef.current = fashionHouseId;
          setLoadingSession(false);
        }

        if (fashionHouseId) {
          const fhBody = await apiFetch<any>(`/api/fashion-houses/${fashionHouseId}`, { silent: true });
          if (cancelled) return;
          if (fhBody) {
            if (cancelled) return;
            if (fhBody.shopName) {
              setFashionHouseName(fhBody.shopName);
            }
            if (Array.isArray(fhBody.categories) && fhBody.categories.length > 0) {
              setHouseCategories(fhBody.categories);
            }
          } else if (!paramFhName) {
            const listBody = await apiFetch<any[]>("/api/fashion-houses", { silent: true });
            if (cancelled) return;
            if (Array.isArray(listBody)) {
              if (cancelled) return;
              if (Array.isArray(listBody) && listBody.length > 0) {
                setFashionHouseName(listBody[0].name || listBody[0].shopName || "Fashion House");
                if (Array.isArray(listBody[0].categories)) {
                  setHouseCategories(listBody[0].categories);
                }
              }
            }
          }
        }
        if (token && fashionHouseId) {
          if (startNew) {
            await apiFetch(`/api/chat/session/${fashionHouseId}/restart`, {
              method: "POST",
              silent: true,
            });
            if (cancelled) return;
            setEscalatedToHuman(false);
          }
          const body = await apiFetch<any>(`/api/chat/session/${fashionHouseId}`, { silent: true });
          if (cancelled) return;
          if (body) {
            if (cancelled) return;
            const serverHistory: Turn[] = body.history ?? [];
            const serverSlots: Slot[] = Array.isArray(body.availableSlots) ? body.availableSlots : [];
            const humanHandoffActive = body.conversationState && body.conversationState !== "automated";
            setEscalatedToHuman(Boolean(humanHandoffActive));
            setAvailableSlots(serverSlots);
            if (!garmentName && startNew && !humanHandoffActive) {
              const welcome: Turn[] = [{ role: "model", text: `Welcome to ${paramFhName || "this fashion house"}! Here's what we specialize in. What would you like us to make?`, garmentPicker: true }];
              setHistory(welcome);
              hydratedConversationIdRef.current = fashionHouseId;
              void writeChatCache(cacheOwner, "customer-booking", fashionHouseId, welcome);
            } else if (garmentName && startNew && !humanHandoffActive) {
              const welcome: Turn[] = [{
                role: "model",
                text: serverSlots.length
                  ? `Welcome! Let's book your measurement for ${garmentName}${garmentPrice ? ` (${garmentPrice})` : ""}. Choose a date, then a time below.`
                  : `Welcome! There are no available appointments for ${garmentName} right now. Use Talk to Admin for help.`,
                slots: serverSlots,
              }];
              setHistory(welcome);
              hydratedConversationIdRef.current = fashionHouseId;
              void writeChatCache(cacheOwner, "customer-booking", fashionHouseId, welcome);
            } else if (serverHistory.length > 0) {
              const formatted = serverHistory.map((t) => ({ ...t, text: sanitizeText(t.text) }));
              const lastTurn = formatted[formatted.length - 1];
              if (
                !humanHandoffActive && (
                  lastTurn.text.includes("--- Chat Session Ended ---") ||
                  lastTurn.text.toLowerCase().includes("session ended")
                )
              ) {
                if (garmentName) {
                  formatted.push({
                    role: "model",
                    text: `Welcome back! We are delighted to assist you with your fitting for ${garmentName}${garmentPrice ? ` (${garmentPrice})` : ""}. Please select an available fitting slot below:`,
                    slots: serverSlots,
                  });
                } else {
                  formatted.push({
                    role: "model",
                    text: "Welcome back! What garment would you like us to make?",
                  });
                }
              }
              setHistory(formatted);
              hydratedConversationIdRef.current = fashionHouseId;
              void writeChatCache(cacheOwner, "customer-booking", fashionHouseId, formatted);
            } else {
              const freshInitialTurns = garmentName
                ? initialTurns.map((turn) => ({ ...turn, slots: serverSlots }))
                : initialTurns;
              setHistory(freshInitialTurns);
              hydratedConversationIdRef.current = fashionHouseId;
              void writeChatCache(cacheOwner, "customer-booking", fashionHouseId, freshInitialTurns);
            }
          }
        }
      } catch {
        // Fallback to default
      } finally {
        if (!cancelled) {
          hydratedConversationIdRef.current = fashionHouseId;
          setLoadingSession(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cacheOwner, fashionHouseId, startNew, token, garmentName, garmentPrice, catalogItemId]);

  useEffect(() => {
    if (
      loadingSession ||
      !fashionHouseId ||
      hydratedConversationIdRef.current !== fashionHouseId
    ) return;
    void writeChatCache(cacheOwner, "customer-booking", fashionHouseId, history);
  }, [cacheOwner, fashionHouseId, history, loadingSession]);

  const handleSend = async (messageText?: string, availableSlotId?: string, specialization?: string) => {
    const textToSend = (messageText ?? draft).trim();
    if (!textToSend || sending || sendLockRef.current || bookingConfirmed) return;
    if (escalatedToHuman) {
      router.push({
        pathname: `/(customer)/direct-chat/${fashionHouseId}`,
        params: { fashionHouseName },
      });
      return;
    }
    const chatRequestKey = availableSlotId
      ? (slotRequestKeysRef.current[availableSlotId] ??= createIdempotencyKey("booking"))
      : createIdempotencyKey("chat");
    sendLockRef.current = true;

    if (bookingConfirmed) setBookingConfirmed(false);

    const userTurn: Turn = { role: "user", text: textToSend };
    setHistory((prev) => [...prev, userTurn]);
    setDraft("");
    setSending(true);

    const lower = textToSend.toLowerCase();

    // Dynamically update selected garment if customer chose/typed a style
    let activeGarment = specialization || selectedGarment;
    if (
      !specialization &&
      !lower.startsWith("book slot") &&
      !lower.includes("fabric") &&
      !lower.includes("bring my own") &&
      !lower.includes("discuss at fitting") &&
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
        lower.includes("shirt") ||
        lower.includes("trouser") ||
        lower.includes("uniform") ||
        lower.includes("jacket") ||
        lower.includes("outfit") ||
        lower.includes("native") ||
        lower.includes("two piece") ||
        lower.includes("two-piece") ||
        houseCategories.some((c) => lower.includes(c.toLowerCase()))
      ) {
        activeGarment = textToSend;
        setSelectedGarment(textToSend);
      }
    }

    try {
      let replyText = "";
      let responseType = "";
      let responseSlots = availableSlots;
      let createdBooking: {
        id: string;
        styleNotes?: string | null;
        preferredTime?: string | null;
        availableSlot?: {
          date: string;
          time: string;
          label?: string;
        } | null;
      } | null = null;

      if (token && fashionHouseId) {
        let body: any;
        try {
          body = await apiFetch<any>("/api/chat/message", {
            method: "POST",
            headers: { "Idempotency-Key": chatRequestKey },
            body: JSON.stringify({
              fashionHouseId,
              message: textToSend,
              garmentName: activeGarment === "Bespoke Fitting Session" ? undefined : activeGarment,
              catalogItemIds: selectedCatalogIds.length ? selectedCatalogIds : undefined,
              specialization: specialization || selectedSpecialization || undefined,
              availableSlotId,
              idempotencyKey: chatRequestKey,
            }),
          });
        } catch (error) {
          const failedBody = error instanceof ApiError ? error.details.responseBody ?? {} : {};
          body = failedBody;
          if (body.code === "SLOT_REQUIRED" || body.code === "SLOT_UNAVAILABLE") {
            const freshSlots: Slot[] = Array.isArray(body.availableSlots) ? body.availableSlots : [];
            setSelectedSlotLabel(null);
            setAvailableSlots(freshSlots);
            setHistory((prev) => [
              ...prev,
              {
                role: "model",
                text: typeof body.error === "string"
                  ? body.error
                  : "That fitting slot is no longer available. Please choose another time.",
                slots: freshSlots.length > 0 ? freshSlots : undefined,
              },
            ]);
            return;
          }
          throw error;
        }
          replyText = sanitizeText(body.reply);
          responseType = body.type;
          if (Array.isArray(body.availableSlots)) {
            responseSlots = body.availableSlots;
            setAvailableSlots(body.availableSlots);
          }
          if (body.booking && typeof body.booking.id === "string") {
            createdBooking = body.booking;
            if (body.booking.styleNotes) {
              activeGarment = body.booking.styleNotes;
              setSelectedGarment(body.booking.styleNotes);
            }
          }
      }

      const lowerReply = replyText.toLowerCase();
      const isEscalation =
        responseType === "escalated" ||
        responseType === "human_active" ||
        lowerReply.includes("flagged") ||
        lowerReply.includes("follow up with you directly") ||
        lowerReply.includes("team member will join");

      if (isEscalation) {
        setEscalatedToHuman(true);
        const escalationTurn: Turn = {
          role: "model",
          text: replyText || `I've flagged your session for ${fashionHouseName} administrators. A team member will join this chat shortly.`,
          options: undefined,
          slots: undefined,
        };
        const endTurn: Turn = {
          role: "model",
          text: "--- Chat Session Ended ---",
        };
        setHistory((prev) => [...prev, escalationTurn, endTurn]);
        return;
      }

      if (responseType === "booking_created") {
        if (!createdBooking) {
          throw new Error("The server did not return the saved booking request.");
        }
        const confirmedBooking = createdBooking;
        if (availableSlotId) delete slotRequestKeysRef.current[availableSlotId];
        setBookingConfirmed(true);
        const confirmTurn: Turn = {
          role: "model",
          text: replyText || `Your fitting request with ${fashionHouseName} has been received! Our team will confirm shortly.`,
        };
        const endTurn: Turn = {
          role: "model",
          text: "--- Chat Session Ended ---",
        };
        setHistory((prev) => [...prev, confirmTurn, endTurn]);

        const requestedSlot =
          (confirmedBooking.availableSlot
            ? confirmedBooking.availableSlot.label || `${confirmedBooking.availableSlot.date} · ${confirmedBooking.availableSlot.time}`
            : null) ||
          confirmedBooking.preferredTime ||
          textToSend.replace(/^Book slot:\s*/i, "") ||
          selectedSlotLabel ||
          "Fitting time to be confirmed";

        setSelectedSlotLabel(requestedSlot);
        return;
      }

      const hasGarment = Boolean(activeGarment && activeGarment !== "Bespoke Fitting Session");
      if (availableSlotId) setSelectedSlotLabel(null);
      const responseTurn: Turn = hasGarment
        ? {
            role: "model",
            text: responseSlots.length
              ? "Let's book your measurement appointment. Choose an available date, then a time below."
              : "There are no available appointments right now. Use Talk to Admin for help.",
            slots: responseSlots.length ? responseSlots : undefined,
          }
        : {
            role: "model",
            text: cleanRawSlotText(replyText) || "What garment would you like us to make?",
          };

      setHistory((prev) => [...prev, responseTurn]);
    } catch {
      if (availableSlotId) setSelectedSlotLabel(null);
      if (specialization) setHistory(previous => previous.map(turn => turn.garmentPicker ? { ...turn, garmentPickerComplete: false } : turn));
      const responseTurn: Turn = {
        role: "model",
        text: "We couldn't reach the booking assistant. Please try again, or use Talk to Admin.",
      };

      setHistory((prev) => [...prev, responseTurn]);
    } finally {
      sendLockRef.current = false;
      setSending(false);
    }
  };

  const [isFirstTimeCustomer, setIsFirstTimeCustomer] = useState(true);
  const [escalatedToHuman, setEscalatedToHuman] = useState(false);
  const [requestingHuman, setRequestingHuman] = useState(false);

  const handleManualEscalation = async () => {
    if (requestingHuman || escalatedToHuman) return;
    setRequestingHuman(true);
    try {
      if (token && fashionHouseId) {
        await apiFetch("/api/chat/escalate", {
          method: "POST",
          body: JSON.stringify({ fashionHouseId, reason: "Customer initiated manual escalation" }),
        });
      }
      setEscalatedToHuman(true);
      const escalationTurn: Turn = {
        role: "model",
        text: `I've passed your request to ${fashionHouseName}. Continue in Human Chat for direct assistance.`,
        options: undefined,
        slots: undefined,
      };
      const endTurn: Turn = {
        role: "model",
        text: "--- Chat Session Ended ---",
      };
      setHistory((prev) => [...prev, escalationTurn, endTurn]);
    } catch (err) {
      console.warn("Escalation error:", err);
      setHistory((prev) => [
        ...prev,
        { role: "model", text: "Human assistance could not be requested right now. Please try again." },
      ]);
    } finally {
      setRequestingHuman(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      {/* Top Header */}
      <View className="flex-row items-center px-6 py-4 bg-white border-oxblood">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full border border-[rgba(43, 43, 43,0.2)] bg-cream items-center justify-center mr-3"
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
        >
          <BackArrowIcon size={24} color="#2B2B2B" />
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
          <Text className="font-body text-[13px] text-charcoal">
            {escalatedToHuman ? "Human Support Mode" : "Booking Assistant"}
          </Text>
        </View>

        {!escalatedToHuman && (
          <Pressable
            onPress={handleManualEscalation}
            disabled={requestingHuman}
            className="px-3 py-1.5 rounded-full bg-white border border-tomato"
            style={{ opacity: requestingHuman ? 0.5 : 1 }}
          >
            <Text className="font-body-medium text-[11px] text-oxblood">
              {requestingHuman ? "Requesting..." : "Talk to Admin"}
            </Text>
          </Pressable>
        )}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
        style={{ flex: 1 }}
      >
        <BottomAnchoredChatScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 6, gap: 16 }}
          showsVerticalScrollIndicator={false}
        >
          {loadingSession ? (
            <View className="py-8 items-center">
              <ActivityIndicator size="small" color="#453332" />
            </View>
          ) : (
            history.map((turn, index) => {
              const isSessionEnded =
                turn.role === ("system" as any) ||
                (turn.text && (turn.text.includes("--- Chat Session Ended ---") || turn.text.toLowerCase().includes("session ended")));

              if (isSessionEnded) {
                return (
                  <View key={index} style={{ flexDirection: "row", alignItems: "center", marginVertical: 24, paddingHorizontal: 12 }}>
                    <View style={{ display: "none", flex: 1, height: 1, backgroundColor: "#453332" }} />
                    <Text style={{ marginHorizontal: 16, fontFamily: "InstrumentSans-Regular", fontSize: 12, color: "#453332", letterSpacing: 2, textTransform: "uppercase" }}>
                      ENDED
                    </Text>
                    <View style={{ display: "none", flex: 1, height: 1, backgroundColor: "#453332" }} />
                  </View>
                );
              }

              const isUser = turn.role === "user";
              return (
                <View key={index} className="w-full">
                  {!isUser && (
                    <Text className="font-body-medium text-[13px] text-[#453332] mb-1">
                      Booking Assistant
                    </Text>
                  )}

                  <View
                    style={[
                      {
                        maxWidth: "85%",
                        padding: 16,
                        borderRadius: 16,
                      },
                      isUser
                        ? {
                            backgroundColor: "rgba(69, 51, 50, 0.25)",
                            alignSelf: "flex-end",
                            borderBottomRightRadius: 4,
                          }
                        : {
                            backgroundColor: "#453332",
                            alignSelf: "flex-start",
                            borderBottomLeftRadius: 4,
                          },
                    ]}
                  >
                    <Text
                      style={{
                        fontFamily: "InstrumentSans-Regular",
                        fontSize: 15,
                        lineHeight: 22,
                        color: isUser ? "#453332" : "#FFFFFF",
                      }}
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
                              backgroundColor: "#FFFFFF",
                              borderWidth: 1,
                              borderColor: "#F96951",
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
                              fontFamily: "InstrumentSans-Medium",
                              fontSize: 13,
                              color: "#453332",
                              textAlign: "center",
                            }}
                          >
                            {opt}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}

                  {turn.garmentPicker && !turn.garmentPickerComplete && !escalatedToHuman ? <BookingSpecializationPicker categories={houseCategories} disabled={sending || bookingConfirmed}
                    onConfirm={category => {
                      if (sending || bookingConfirmed || sendLockRef.current) return;
                      setSelectedGarment(category); setSelectedCatalogIds([]); setSelectedSpecialization(category);
                      setHistory(previous => previous.map((entry, i) => i === index ? { ...entry, garmentPickerComplete: true } : entry));
                      void handleSend(`I'd like a measurement appointment for ${category}.`, undefined, category);
                    }} /> : null}

                  {turn.slots && turn.slots.length > 0 && (
                    <BookingSlotPicker slots={turn.slots} selectedLabel={selectedSlotLabel} disabled={sending || bookingConfirmed || !!turn.slotPickerComplete}
                      mode={turn.slotStage || "dates"}
                      onDateSelect={day => {
                        if (sending || bookingConfirmed || turn.slotPickerComplete) return;
                        setHistory(previous => [
                          ...previous.map((entry, i) => i === index ? { ...entry, slotPickerComplete: true } : entry),
                          { role: "user", text: day.label },
                          { role: "model", text: `What time works for you on ${day.label}?`, slots: day.slots, slotStage: "times" },
                        ]);
                      }}
                      onSelect={slot => {
                        if (!selectedSlotLabel && !sending) {
                          setSelectedSlotLabel(slot.label);
                          void handleSend(`Book slot: ${slot.label}`, slot.id);
                        }
                      }} />
                  )}
                </View>
              );
            })
          )}

          {sending && (
            <View className="items-start max-w-[85%]">
              <Text className="font-body-medium text-[12px] text-charcoal mb-1">
                {fashionHouseName} Assistant
              </Text>
              <View className="bg-oxblood rounded-t-[16px] rounded-r-[16px] rounded-bl-[4px] px-6 py-4">
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            </View>
          )}
        </BottomAnchoredChatScrollView>

        {loadingSession && (
          <View
            pointerEvents="none"
            style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" }}
          >
            <ActivityIndicator size="small" color="#453332" />
          </View>
        )}

        {/* Input Area */}
        {!bookingConfirmed && !loadingSession && (
          <View
            style={{
              paddingHorizontal: 24,
              paddingTop: 6,
              paddingBottom: Math.max(insets.bottom, 16),
              backgroundColor: "#FFFFFF",
            }}
          >
            {escalatedToHuman ? (
              <View style={{ gap: 8 }}>
                <Pressable
                  onPress={() => router.setParams({ startNew: String(Date.now()) })}
                  className="bg-tomato rounded-full items-center justify-center py-4 px-6"
                >
                  <Text className="font-body-semibold text-[14px] text-white">Start a new booking</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push({
                    pathname: `/(customer)/direct-chat/${fashionHouseId}`,
                    params: { fashionHouseName },
                  })}
                  className="rounded-full items-center justify-center py-3 px-6 border border-tomato"
                >
                  <Text className="font-body-semibold text-[14px] text-oxblood">Continue human chat</Text>
                </Pressable>
              </View>
            ) : (
            <View className="flex-row items-center gap-3">
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Type a message..."
                placeholderTextColor="rgba(69, 51, 50, 0.7)"
                className="flex-1 bg-white border border-oxblood rounded-full px-5 py-3 font-body text-[14px] text-oxblood"
                onSubmitEditing={() => handleSend()}
                returnKeyType="send"
              />
              <Pressable
                onPress={() => handleSend()}
                disabled={sending || !draft.trim()}
                className={`w-11 h-11 bg-tomato rounded-full items-center justify-center ${
                  !draft.trim() || sending ? "opacity-50" : "opacity-100"
                }`}
                style={({ pressed }) => [{ opacity: pressed ? 0.8 : draft.trim() ? 1 : 0.5 }]}
              >
                <ArrowUp size={20} color="#FFFFFF" />
              </Pressable>
            </View>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

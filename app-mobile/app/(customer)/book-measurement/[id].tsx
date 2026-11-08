import React, { useCallback, useRef, useState } from "react";
import { View, Text, Pressable, TextInput, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import { KeyboardAwareScrollView } from "@/shared/components/KeyboardAwareScrollView";
import { apiFetch } from "@/shared/utils/apiClient";
import { createIdempotencyKey } from "@/shared/utils/idempotency";
import { useAppAlert } from "@/shared/hooks/useAppAlert";
import { SCREEN_TOP_SPACING } from "@/shared/utils/screenSpacing";

type Slot = { id: string; date: string; label: string; durationMinutes: number };
type Availability = { item: { id: string; name: string; fashionHouse: { shopName: string; timezone: string } }; slots: Slot[] };

export default function MeasurementBookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { showAlert } = useAppAlert();
  const [data, setData] = useState<Availability | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const request = useRef(0);
  const attempt = useRef<{ signature: string; key: string } | null>(null);
  const load = useCallback(async () => {
    const version = ++request.current;
    setLoading(true); setError("");
    try {
      const response = await apiFetch<Availability>("/api/catalog/item/" + encodeURIComponent(id) + "/measurement-slots", { silent: true });
      if (version !== request.current) return;
      setData(response);
      setSelectedDate(previous => response.slots.some(slot => slot.date === previous) ? previous : response.slots[0]?.date || "");
      setSelectedSlot(previous => response.slots.some(slot => slot.id === previous) ? previous : "");
    } catch (error) { if (version === request.current) setError(error instanceof Error ? error.message : "We couldn't load appointments."); }
    finally { if (version === request.current) setLoading(false); }
  }, [id]);
  useFocusEffect(useCallback(() => { void load(); return () => { request.current++; }; }, [load]));

  async function book() {
    if (!data || !selectedSlot || lock.current) return;
    lock.current = true; setSaving(true); setError("");
    const payload = { catalogItemId: data.item.id, availableSlotId: selectedSlot, notes: notes.trim() || undefined };
    const signature = JSON.stringify(payload);
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: createIdempotencyKey("measurement") };
    try {
      await apiFetch("/api/orders/measurement-bookings", { method: "POST", headers: { "Idempotency-Key": attempt.current.key }, body: signature, silent: true });
      showAlert("Measurement requested", "Your appointment time is reserved. The designer will review your request. You can follow it in My Orders.");
      router.replace("/(customer)/(tabs)/orders");
    } catch (error) { setError(error instanceof Error ? error.message : "We couldn't book that appointment. Please try again."); }
    finally { lock.current = false; setSaving(false); }
  }
  const dates = [...new Set(data?.slots.map(slot => slot.date) || [])];
  return <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
    <View style={styles.header}><Pressable accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}><BackArrowIcon color="#453332" /></Pressable><Text style={styles.title}>Book measurement</Text></View>
    <KeyboardAwareScrollView contentContainerStyle={styles.content}>
      {loading ? <ActivityIndicator color="#453332" /> : null}
      {data ? <><Text style={styles.item}>{data.item.name}</Text><Text style={styles.hint}>{data.item.fashionHouse.shopName} · {data.item.fashionHouse.timezone}</Text>
        {!loading && !dates.length ? <Text style={styles.hint}>No measurement appointments are available yet. Check back later.</Text> : null}
        <View style={styles.wrap}>{dates.map(date => <Pressable key={date} accessibilityRole="button" accessibilityState={{ selected: selectedDate === date }} disabled={saving} onPress={() => { setSelectedDate(date); setSelectedSlot(""); }} style={[styles.option, selectedDate === date && styles.selected]}><Text style={[styles.optionText, selectedDate === date && styles.white]}>{date}</Text></Pressable>)}</View>
        {data.slots.filter(slot => slot.date === selectedDate).map(slot => <Pressable key={slot.id} accessibilityRole="radio" accessibilityState={{ selected: selectedSlot === slot.id }} disabled={saving} onPress={() => setSelectedSlot(slot.id)} style={[styles.option, selectedSlot === slot.id && styles.selected]}><Text style={[styles.optionText, selectedSlot === slot.id && styles.white]}>{slot.label} · {slot.durationMinutes / 60} hr{slot.durationMinutes === 60 ? "" : "s"}</Text></Pressable>)}
        <Text style={styles.hint}>Anything the designer should know? (optional)</Text><TextInput accessibilityLabel="Measurement notes" editable={!saving} value={notes} onChangeText={setNotes} multiline maxLength={1000} style={styles.input} />
      </> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Pressable disabled={saving || loading} onPress={() => { void load(); }} style={styles.back}><Text style={styles.optionText}>Refresh available times</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={!selectedSlot || saving || loading} onPress={() => { void book(); }} style={[styles.primary, (!selectedSlot || saving || loading) && { opacity: 0.5 }]}><Text style={styles.white}>{saving ? "Booking..." : "Book measurement"}</Text></Pressable>
      <Text style={styles.hint}>This reserves a measurement appointment, not a garment purchase. Pricing and production are confirmed with the designer.</Text>
    </KeyboardAwareScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: "white" }, header: { paddingTop: SCREEN_TOP_SPACING, paddingHorizontal: 24, flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 16 }, back: { minHeight: 44, minWidth: 44, justifyContent: "center" }, title: { fontFamily: "HedvigLettersSerif-Regular", fontSize: 23, color: "#000000" }, content: { padding: 24, gap: 14, paddingBottom: 48 }, item: { fontFamily: "InstrumentSans-SemiBold", fontSize: 18, color: "#000000" }, hint: { fontFamily: "InstrumentSans-Regular", fontSize: 13, lineHeight: 20, color: "#746765" }, wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, option: { minHeight: 48, justifyContent: "center", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#D7CFCD" }, optionText: { fontFamily: "InstrumentSans-Regular", color: "#000000", fontSize: 14 }, selected: { backgroundColor: "#F96951", borderColor: "#F96951" }, white: { color: "white", fontFamily: "InstrumentSans-Medium", fontSize: 15 }, input: { minHeight: 90, borderWidth: 1, borderColor: "#D7CFCD", padding: 12, borderRadius: 12, fontSize: 16, color: "#000000", textAlignVertical: "top" }, error: { color: "#9F1239", fontSize: 13, lineHeight: 20 }, primary: { minHeight: 52, alignItems: "center", justifyContent: "center", backgroundColor: "#F96951", borderRadius: 26 } });

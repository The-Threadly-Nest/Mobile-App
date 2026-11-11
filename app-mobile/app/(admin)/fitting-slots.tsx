import { typeScale } from "@/shared/utils/typeScale";
import React, { useState, useCallback, useMemo } from "react";
import { View, Pressable, ScrollView, ActivityIndicator, StyleSheet, useWindowDimensions } from "react-native";
import { Text } from "@/shared/components/Typography";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Trash2 } from "lucide-react-native";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import { useAuthStore } from "@/stores/useAuthStore";
import { adminApi, slotsApi } from "@/shared/utils/apiClient";
import { useAppAlert } from "@/shared/hooks/useAppAlert";
import { KeyboardAwareScrollView } from "@/shared/components/KeyboardAwareScrollView";
import {
  BookingScheduleForm,
  bookingScheduleError,
} from "@/shared/components/BookingScheduleForm";
import type { WeeklyBookingSchedule } from "@/shared/utils/apiClient";
import { SCREEN_TOP_SPACING } from "@/shared/utils/screenSpacing";

export default function AdminFittingSlotsScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isLandscape = width > 600;
  const { showAlert } = useAppAlert();
  const token = useAuthStore((s) => s.token);

  const [bookingSchedule, setBookingSchedule] = useState<WeeklyBookingSchedule | null>(null);
  const [scheduleTimezone, setScheduleTimezone] = useState("Africa/Lagos");
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [slotsList, setSlotsList] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [houseName, setHouseName] = useState("");
  const storedShopName = useAuthStore((s) => s.shopName);
  const fashionHouseName = houseName || storedShopName || "Fashion House";

  // Today's date string YYYY-MM-DD
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const fetchSlots = useCallback(async () => {
    setLoadingSlots(true);
    try {
      const data = await slotsApi.getSlots();
      if (Array.isArray(data)) {
        setSlotsList(data);
        if (data.length > 0 && !data.some((s) => s.date === todayStr)) {
          setSelectedDate(data[0].date);
        }
      }
    } catch (err) {
      console.warn("Could not fetch fitting slots:", err);
    } finally {
      setLoadingSlots(false);
    }
  }, [todayStr]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function loadProfile() {
        if (!token) return;
        try {
          const profileRes = await adminApi.getProfile();
          if (active && profileRes?.fashionHouse) {
            const house = profileRes.fashionHouse;
            if (house.shopName || house.name) {
              setHouseName(house.shopName || house.name);
            }
            setBookingSchedule(house.bookingSchedule || null);
            setScheduleTimezone(house.timezone || "Africa/Lagos");
          }
        } catch {}
      }
      void loadProfile();
      void fetchSlots();
      return () => {
        active = false;
      };
    }, [token, fetchSlots])
  );

  // Group slots by date for 30 days
  const { availableDates, slotsByDate } = useMemo(() => {
    const map: Record<string, any[]> = {};
    slotsList.forEach((s) => {
      if (!s.date) return;
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    });

    const dates: string[] = [];
    const base = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const str = d.toISOString().slice(0, 10);
      dates.push(str);
    }

    return { availableDates: dates, slotsByDate: map };
  }, [slotsList]);

  // Current day's slots sorted chronologically
  const dailySlots = useMemo(() => {
    return (slotsByDate[selectedDate] || [])
      .slice()
      .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  }, [slotsByDate, selectedDate]);

  const handleDeleteSlot = async (slotId: string) => {
    try {
      await slotsApi.deleteSlot(slotId);
      setSlotsList((prev) => prev.filter((s) => s.id !== slotId));
      showAlert("Slot Removed", "The fitting slot has been removed.");
    } catch (err: any) {
      showAlert("Error", err?.message || "Could not delete slot.");
    }
  };

  const handleSaveSchedule = async () => {
    const error = bookingScheduleError(bookingSchedule);
    if (error || !bookingSchedule) {
      showAlert("Fitting Availability", error || "Please select your working days.");
      return;
    }
    setSavingSchedule(true);
    try {
      const response = await slotsApi.saveSchedule(bookingSchedule, scheduleTimezone.trim());
      setBookingSchedule(response.schedule);
      await fetchSlots();
      setIsEditingSchedule(false);
      showAlert(
        "Availability Saved",
        "Your 30-day fitting slots have been generated and updated successfully."
      );
    } catch (error: any) {
      showAlert("Save Failed", error?.message || "Could not update schedule. Please try again.");
    } finally {
      setSavingSchedule(false);
    }
  };

  const formatHeaderDate = (dStr: string) => {
    try {
      const parsed = new Date(dStr + "T12:00:00Z");
      return parsed.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dStr;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={[styles.container, isLandscape && styles.containerLandscape]}>
        {/* Top Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.push("/(admin)/settings" as any)}
            style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <BackArrowIcon size={24} color="#453332" />
          </Pressable>
          <Text style={styles.headerTitle}>Fitting Slots</Text>
        </View>

        <KeyboardAwareScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 110 + Math.max(insets.bottom, 16) },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── 1. DAILY FITTING AVAILABILITY FIRST ── */}
          <Text style={styles.sectionTitle}>Daily Fitting Availability</Text>

          {/* Horizontal Date Picker Strip */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dateStrip}
          >
            {availableDates.map((dStr) => {
              const isSelected = selectedDate === dStr;
              const isToday = dStr === todayStr;
              const dObj = new Date(dStr + "T12:00:00Z");
              const dayName = isToday ? "TODAY" : dObj.toLocaleDateString("en-US", { weekday: "short" });
              const dayNum = dObj.toLocaleDateString("en-US", { day: "numeric" });
              const count = slotsByDate[dStr]?.length || 0;

              return (
                <Pressable
                  key={dStr}
                  onPress={() => setSelectedDate(dStr)}
                  style={[styles.dateChip, isSelected && styles.dateChipActive]}
                >
                  <Text style={[styles.dateDayName, isSelected && styles.dateDayNameActive]}>
                    {dayName}
                  </Text>
                  <Text style={[styles.dateDayNum, isSelected && styles.dateDayNumActive]}>
                    {dayNum}
                  </Text>
                  <View style={[styles.countBadge, isSelected && styles.countBadgeActive]}>
                    <Text style={[styles.countText, isSelected && styles.countTextActive]}>
                      {count > 0 ? `${count} slots` : "Off"}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Slots List for Selected Date */}
          <View style={styles.dailyViewContainer}>
            <View style={styles.dailyHeaderRow}>
              <Text style={styles.dailyDateTitle}>{formatHeaderDate(selectedDate)}</Text>
              <Text style={styles.dailyTotalCount}>
                {dailySlots.length} {dailySlots.length === 1 ? "slot" : "slots"}
              </Text>
            </View>

            {loadingSlots ? (
              <ActivityIndicator color="#453332" style={{ marginVertical: 24 }} />
            ) : dailySlots.length === 0 ? (
              <View style={styles.emptyDayBox}>
                <Text style={styles.emptyDayText}>
                  No fitting slots scheduled for this day.
                </Text>
              </View>
            ) : (
              <View style={styles.slotsList}>
                {dailySlots.map((slot) => {
                  // Cannot delete for today or past days; can only delete upcoming future slots
                  const canDelete = !slot.booked && slot.date > todayStr;

                  return (
                    <View key={slot.id} style={styles.slotRow}>
                      <View style={styles.slotTimeCol}>
                        <Text style={styles.slotTimeText}>{slot.time}</Text>
                        <Text style={styles.slotDurationText}>
                          {bookingSchedule?.durationMinutes
                            ? `${bookingSchedule.durationMinutes / 60} hr session`
                            : "1 hr session"}
                        </Text>
                      </View>

                      <View style={slot.booked ? styles.bookedBadge : styles.availableBadge}>
                        <Text
                          style={slot.booked ? styles.bookedBadgeText : styles.availableBadgeText}
                        >
                          {slot.booked ? "Booked" : "Available"}
                        </Text>
                      </View>

                      {canDelete && (
                        <Pressable
                          onPress={() => void handleDeleteSlot(slot.id)}
                          hitSlop={8}
                          style={styles.deleteBtn}
                        >
                          <Trash2 size={16} color="#F96951" />
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* ── 2. EDIT SCHEDULE FORM (COLLAPSIBLE / TOGGLEABLE) ── */}
          {isEditingSchedule && (
            <View style={styles.editSectionWrapper}>
              <View style={styles.divider} />
              <View style={styles.scheduleHeaderRow}>
                <Text style={styles.sectionTitle}>{fashionHouseName} Operating Hours</Text>
                <Pressable onPress={() => setIsEditingSchedule(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
              </View>

              <BookingScheduleForm
                value={bookingSchedule}
                onChange={setBookingSchedule}
                timezone={scheduleTimezone}
                onTimezoneChange={setScheduleTimezone}
                disabled={savingSchedule}
              />
            </View>
          )}
        </KeyboardAwareScrollView>

        {/* ── 3. DYNAMIC BOTTOM BAR (Edit & Generate vs Save & Generate) ── */}
        <View style={styles.bottomBar}>
          {isEditingSchedule ? (
            <Pressable
              onPress={handleSaveSchedule}
              disabled={savingSchedule}
              style={({ pressed }) => [
                styles.primaryBtn,
                { opacity: pressed || savingSchedule ? 0.85 : 1 },
              ]}
            >
              {savingSchedule ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText}>Save & Generate Slots</Text>
              )}
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setIsEditingSchedule(true)}
              style={({ pressed }) => [styles.primaryBtn, { opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={styles.primaryBtnText}>Edit & Generate</Text>
            </Pressable>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F9E8D3",
  },
  container: {
    flex: 1,
  },
  containerLandscape: {
    maxWidth: 720,
    alignSelf: "center",
    width: "100%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: SCREEN_TOP_SPACING,
    marginBottom: 16,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(69, 51, 50, 0.25)",
    backgroundColor: "#F9E8D3",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  headerTitle: { ...typeScale.pageTitle,
    color: "#4A403B",
    letterSpacing: -0.2,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sectionTitle: { ...typeScale.sectionTitle,
    color: "#4A403B",
    marginBottom: 12,
  },
  dateStrip: {
    gap: 8,
    paddingBottom: 16,
  },
  dateChip: {
    width: 64,
    height: 76,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(69, 51, 50, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  dateChipActive: {
    backgroundColor: "#F96951",
    borderColor: "#F96951",
  },
  dateDayName: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 10,
    color: "#4A403B",
    textTransform: "uppercase",
  },
  dateDayNameActive: {
    color: "rgba(255, 255, 255, 0.75)",
  },
  dateDayNum: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 18,
    color: "#4A403B",
  },
  dateDayNumActive: {
    color: "#FFFFFF",
  },
  countBadge: {
    marginTop: 2,
  },
  countBadgeActive: {},
  countText: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 10,
    color: "#4A403B",
  },
  countTextActive: {
    color: "rgba(255, 255, 255, 0.9)",
  },
  dailyViewContainer: {
    marginTop: 4,
  },
  dailyHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    borderBottomWidth: 0,
    borderBottomColor: "rgba(69, 51, 50, 0.08)",
    marginBottom: 8,
  },
  dailyDateTitle: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 15,
    color: "#4A403B",
  },
  dailyTotalCount: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 13,
    color: "#4A403B",
  },
  emptyDayBox: {
    paddingVertical: 32,
    alignItems: "center",
  },
  emptyDayText: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 13,
    color: "#4A403B",
    textAlign: "center",
  },
  slotsList: {
    gap: 2,
  },
  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 0,
    borderBottomColor: "#453332",
  },
  slotTimeCol: {
    flex: 1,
  },
  slotTimeText: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 16,
    color: "#4A403B",
  },
  slotDurationText: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 12,
    color: "#4A403B",
    marginTop: 2,
  },
  availableBadge: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 12,
  },
  availableBadgeText: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 11,
    color: "#453332",
  },
  bookedBadge: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 12,
  },
  bookedBadgeText: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 11,
    color: "#4A403B",
  },
  deleteBtn: {
    padding: 6,
  },
  editSectionWrapper: {
    marginTop: 20,
  },
  scheduleHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cancelText: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 13,
    color: "#4A403B",
  },
  divider: { display: "none",
    height: 1,
    backgroundColor: "rgba(69, 51, 50, 0.08)",
    marginBottom: 20,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#F9E8D3",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
  },
  primaryBtn: {
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F96951",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { ...typeScale.button,
    color: "#FFFFFF",
  },
});

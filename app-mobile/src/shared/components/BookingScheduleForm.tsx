import { typeScale } from "@/shared/utils/typeScale";
import React, { useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Text, TextInput } from "@/shared/components/Typography";
import type { WeeklyBookingSchedule } from "../utils/apiClient";

export const DEFAULT_BOOKING_SCHEDULE: WeeklyBookingSchedule = { days: [1, 2, 3, 4, 5], startTime: "09:00", endTime: "17:00", durationMinutes: 60, blockedDates: [] };
const DAYS = [[1, "Mon", "Monday"], [2, "Tue", "Tuesday"], [3, "Wed", "Wednesday"], [4, "Thu", "Thursday"], [5, "Fri", "Friday"], [6, "Sat", "Saturday"], [0, "Sun", "Sunday"]] as const;

export function bookingScheduleError(value: WeeklyBookingSchedule | null): string | null {
  if (!value || !value.days.length) return "Select at least one working day.";
  if (![value.startTime, value.endTime].every(time => /^([01]\d|2[0-3]):[0-5]\d$/.test(time))) return "Use 24-hour times, for example 09:00 and 17:00.";
  if (!Number.isInteger(value.durationMinutes) || value.durationMinutes < 60 || value.durationMinutes > 300 || value.durationMinutes % 60 !== 0) return "Choose a fitting duration from 1 to 5 hours.";
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  return minutes(value.endTime) - minutes(value.startTime) < value.durationMinutes ? "Allow at least one full fitting between opening and closing time." : null;
}

export function BookingScheduleForm({ value, onChange, timezone, onTimezoneChange, disabled = false }: {
  value: WeeklyBookingSchedule | null; onChange: (value: WeeklyBookingSchedule) => void;
  timezone: string; onTimezoneChange: (timezone: string) => void; disabled?: boolean;
}) {
  const [date, setDate] = useState("");
  const [dateError, setDateError] = useState("");
  if (!value) return <View style={styles.group}>
    <Text style={styles.label}>Weekly availability</Text>
    <Text style={styles.hint}>Your existing slots stay unchanged until you save a weekly schedule.</Text>
    <Pressable accessibilityRole="button" disabled={disabled} onPress={() => onChange({ ...DEFAULT_BOOKING_SCHEDULE, days: [...DEFAULT_BOOKING_SCHEDULE.days], blockedDates: [] })} style={styles.primary}><Text style={styles.primaryText}>Choose working days</Text></Pressable>
  </View>;
  const update = (patch: Partial<WeeklyBookingSchedule>) => onChange({ ...value, ...patch });
  function blockDate() {
    const parsed = new Date(`${date}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) { setDateError("Use a real date, like 2026-12-25."); return; }
    if (value!.blockedDates.length >= 60) { setDateError("You can block up to 60 dates."); return; }
    update({ blockedDates: [...new Set([...value!.blockedDates, date])].sort() }); setDate(""); setDateError("");
  }
  return <View style={[styles.group, disabled && { opacity: 0.6 }]}>
    <Text style={styles.label}>Working days</Text>
    <View style={styles.wrap}>{DAYS.map(([day, label, full]) => <Pressable key={day} accessibilityRole="checkbox" accessibilityLabel={full} accessibilityState={{ checked: value.days.includes(day) }} disabled={disabled}
      onPress={() => update({ days: value.days.includes(day) ? value.days.filter(item => item !== day) : [...value.days, day].sort() })}
      style={[styles.day, value.days.includes(day) && styles.selected]}><Text style={[styles.dayText, value.days.includes(day) && styles.selectedText]}>{label}</Text></Pressable>)}</View>
    <View style={styles.row}>
      <View style={styles.field}><Text style={styles.label}>Opens</Text><TextInput accessibilityLabel="Opening time" editable={!disabled} value={value.startTime} onChangeText={startTime => update({ startTime })} placeholder="09:00" maxLength={5} autoCorrect={false} style={styles.input} /></View>
      <View style={styles.field}><Text style={styles.label}>Closes</Text><TextInput accessibilityLabel="Closing time" editable={!disabled} value={value.endTime} onChangeText={endTime => update({ endTime })} placeholder="17:00" maxLength={5} autoCorrect={false} style={styles.input} /></View>
    </View>
    <Text style={styles.hint}>Use 24-hour time. Slots will not run past closing time.</Text>
    <Text style={styles.label}>Hours per fitting</Text>
    <View style={styles.wrap}>{[1, 2, 3, 4, 5].map(hours => <Pressable key={hours} accessibilityRole="button" accessibilityLabel={`${hours} ${hours === 1 ? "hour" : "hours"} per fitting`} accessibilityState={{ selected: value.durationMinutes === hours * 60 }} disabled={disabled} onPress={() => update({ durationMinutes: hours * 60 })} style={[styles.day, value.durationMinutes === hours * 60 && styles.selected]}><Text style={[styles.dayText, value.durationMinutes === hours * 60 && styles.selectedText]}>{hours}{hours === 1 ? "hr" : "hrs"}</Text></Pressable>)}</View>
    <Text style={styles.label}>Timezone</Text><TextInput accessibilityLabel="Booking timezone" editable={!disabled} value={timezone} onChangeText={onTimezoneChange} autoCapitalize="none" autoCorrect={false} placeholder="Africa/Lagos" style={styles.input} />
    <Text style={styles.label}>Days off (optional)</Text>
    <View style={styles.row}><TextInput accessibilityLabel="Date to block" editable={!disabled} value={date} onChangeText={text => { setDate(text); setDateError(""); }} placeholder="YYYY-MM-DD" maxLength={10} style={[styles.input, { flex: 1 }]} /><Pressable disabled={disabled} accessibilityRole="button" onPress={blockDate} style={styles.add}><Text style={styles.dayText}>Block date</Text></Pressable></View>
    {dateError ? <Text accessibilityRole="alert" style={styles.error}>{dateError}</Text> : null}
    <View style={styles.wrap}>{value.blockedDates.map(blocked => <Pressable key={blocked} accessibilityRole="button" accessibilityLabel={`Unblock ${blocked}`} disabled={disabled} onPress={() => update({ blockedDates: value.blockedDates.filter(item => item !== blocked) })} style={styles.block}><Text style={styles.dayText}>{blocked} ×</Text></Pressable>)}</View>
    <Text style={styles.hint}>Saving creates slots for the next 30 days and replaces unbooked future slots. Existing bookings stay unchanged.</Text>
    {value.generatedThrough ? <Text style={styles.hint}>Current booking window ends {value.generatedThrough}. Save again to extend it.</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  group: { gap: 12, marginBottom: 20 }, label: { fontFamily: "InstrumentSans-SemiBold", fontSize: 14, color: "#4A403B" },
  hint: { ...typeScale.caption, color: "#4A403B" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, row: { flexDirection: "row", alignItems: "center", gap: 10 },
  field: { flex: 1, gap: 8 }, input: { minHeight: 48, borderWidth: 1, borderColor: "#453332", borderRadius: 12, paddingHorizontal: 12, fontFamily: "InstrumentSans-Regular", fontSize: 16, color: "#4A403B", backgroundColor: "#FFFDF9" },
  day: { minHeight: 44, minWidth: 44, paddingHorizontal: 12, borderWidth: 1, borderColor: "#453332", borderRadius: 12, justifyContent: "center", alignItems: "center" },
  dayText: { fontFamily: "InstrumentSans-Medium", fontSize: 13, color: "#4A403B" }, selected: { backgroundColor: "#F96951", borderColor: "#F96951" }, selectedText: { color: "white" },
  block: { borderRadius: 10, padding: 10, backgroundColor: "#FFFDF9" }, add: { minHeight: 48, paddingHorizontal: 12, justifyContent: "center", borderRadius: 12, backgroundColor: "#FFFDF9" },
  primary: { minHeight: 48, alignItems: "center", justifyContent: "center", backgroundColor: "#F96951", borderRadius: 12, padding: 12 }, primaryText: { fontFamily: "InstrumentSans-SemiBold", color: "white", fontSize: 14 },
  error: { fontFamily: "InstrumentSans-Regular", fontSize: 12, color: "#F96951" },
});

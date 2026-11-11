import { typeScale } from "@/shared/utils/typeScale";
import React, { useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Text } from "@/shared/components/Typography";
import { groupBookingSlots, bookingTimeLabel, type BookingSlot } from "../utils/bookingDates";
export default function BookingSlotPicker({ slots, selectedLabel, disabled, onSelect, mode = "inline", onDateSelect }: {
  slots: BookingSlot[]; selectedLabel: string | null; disabled: boolean;
  onSelect: (slot: BookingSlot) => void; mode?: "inline" | "dates" | "times";
  onDateSelect?: (day: { date: string; label: string; slots: BookingSlot[] }) => void;
}) {
  const [date, setDate] = useState<string | null>(null);
  const [datePage, setDatePage] = useState(0);
  const days = groupBookingSlots(slots);
  const selected = mode === "times" ? days[0] : days.find(day => day.date === date);
  const visibleDays = mode === "dates" ? days.slice(datePage * 3, datePage * 3 + 3) : days;
  return <View style={styles.card}>
    {mode !== "times" ? <>
      {mode === "inline" ? <Text style={styles.heading}>1. Choose a date</Text> : null}
      <View style={styles.wrap}>{visibleDays.map(day => <Pressable key={day.date} accessibilityRole="radio" accessibilityState={{ selected: selected?.date === day.date }} disabled={disabled || !!selectedLabel} onPress={() => { setDate(day.date); onDateSelect?.(day); }} style={[styles.option, selected?.date === day.date && styles.active]}><Text style={[styles.text, selected?.date === day.date && { color: "#FFFDF9" }]}>{day.label}</Text></Pressable>)}</View>
      {mode === "dates" && days.length > 3 ? <View style={styles.wrap}>
        {datePage > 0 ? <Pressable disabled={disabled} onPress={() => setDatePage(page => page - 1)} style={styles.option}><Text style={styles.text}>Earlier dates</Text></Pressable> : null}
        {(datePage + 1) * 3 < days.length ? <Pressable disabled={disabled} onPress={() => setDatePage(page => page + 1)} style={styles.option}><Text style={styles.text}>More dates</Text></Pressable> : null}
      </View> : null}
    </> : null}
    {mode !== "dates" && (selected ? <>{mode === "inline" ? <Text style={styles.heading}>2. Choose a time</Text> : null}<View style={styles.wrap}>{selected.slots.map(slot => <Pressable key={slot.id} accessibilityRole="button" accessibilityState={{ selected: selectedLabel === slot.label }} disabled={disabled || !!selectedLabel} onPress={() => onSelect(slot)} style={[styles.option, selectedLabel === slot.label && styles.active]}><Text style={[styles.text, selectedLabel === slot.label && { color: "#FFFDF9" }]}>{bookingTimeLabel(slot)}{selectedLabel === slot.label ? ' · Selected' : ''}</Text></Pressable>)}</View></> : <Text style={styles.hint}>Select a date to see its available times.</Text>)}
  </View>;
}
const styles = StyleSheet.create({ card: { backgroundColor: "#FFFDF9", borderRadius: 20, padding: 16, marginTop: 12, gap: 12 }, heading: { fontFamily: 'InstrumentSans-SemiBold', fontSize: 14, color: "#4A403B" }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, option: { minHeight: 44, padding: 12, borderWidth: 1, borderColor: '#F96951', borderRadius: 12, justifyContent: 'center' }, active: { backgroundColor: '#F96951' }, text: { fontFamily: 'InstrumentSans-Medium', fontSize: 13, color: "#4A403B" }, hint: { ...typeScale.caption, color: "#4A403B" } });

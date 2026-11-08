import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { groupBookingSlots, bookingTimeLabel, type BookingSlot } from "../utils/bookingDates";
export default function BookingSlotPicker({ slots, selectedLabel, disabled, onSelect }: { slots: BookingSlot[]; selectedLabel: string | null; disabled: boolean; onSelect: (slot: BookingSlot) => void }) {
  const [date, setDate] = useState<string | null>(null);
  const days = groupBookingSlots(slots);
  const selected = days.find(day => day.date === date);
  return <View style={styles.card}>
    <Text style={styles.heading}>1. Choose a date</Text>
    <View style={styles.wrap}>{days.map(day => <Pressable key={day.date} accessibilityRole="radio" accessibilityState={{ selected: selected?.date === day.date }} disabled={disabled || !!selectedLabel} onPress={() => setDate(day.date)} style={[styles.option, selected?.date === day.date && styles.active]}><Text style={styles.text}>{day.label}</Text></Pressable>)}</View>
    {selected ? <><Text style={styles.heading}>2. Choose a time</Text><View style={styles.wrap}>{selected.slots.map(slot => <Pressable key={slot.id} accessibilityRole="button" accessibilityState={{ selected: selectedLabel === slot.label }} disabled={disabled || !!selectedLabel} onPress={() => onSelect(slot)} style={[styles.option, selectedLabel === slot.label && styles.active]}><Text style={styles.text}>{bookingTimeLabel(slot)}{selectedLabel === slot.label ? ' · Selected' : ''}</Text></Pressable>)}</View></> : <Text style={styles.hint}>Select a date to see its available times.</Text>}
  </View>;
}
const styles = StyleSheet.create({ card: { backgroundColor: 'white', borderRadius: 20, padding: 16, marginTop: 12, gap: 12 }, heading: { fontFamily: 'InstrumentSans-SemiBold', fontSize: 14, color: '#000000' }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, option: { minHeight: 44, padding: 12, borderWidth: 1, borderColor: '#F96951', borderRadius: 12, justifyContent: 'center' }, active: { backgroundColor: '#F96951' }, text: { fontFamily: 'InstrumentSans-Medium', fontSize: 13, color: '#000000' }, hint: { fontFamily: 'InstrumentSans-Regular', fontSize: 12, color: '#000000' } });

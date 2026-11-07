import React from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import type { FulfillmentType } from "../utils/catalogCommerce";

export function CatalogOfferingFields({ type, onTypeChange, sizes, onSizesChange, colors, onColorsChange, category, onCategoryChange, disabled = false }: {
  type: FulfillmentType; onTypeChange: (value: FulfillmentType) => void;
  sizes: string; onSizesChange: (value: string) => void; colors: string; onColorsChange: (value: string) => void;
  category: string; onCategoryChange: (value: string) => void; disabled?: boolean;
}) {
  return <View style={styles.group}>
    <Text style={styles.label}>ORDER TYPE</Text>
    <View style={styles.row}>{([['ready_to_wear', 'Ready for pickup'], ['custom_fit', 'Custom fit']] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ selected: type === value }} disabled={disabled} onPress={() => onTypeChange(value)} style={[styles.option, type === value && styles.selected]}><Text style={[styles.text, type === value && { color: "white" }]}>{label}</Text></Pressable>)}</View>
    <Text style={styles.hint}>{type === 'ready_to_wear' ? 'Customers choose a size and order through the cart.' : 'Customers book a measurement appointment. This item cannot be added to the cart.'}</Text>
    <Text style={styles.label}>CATEGORY</Text><TextInput accessibilityLabel="Garment category" value={category} onChangeText={onCategoryChange} maxLength={100} editable={!disabled} placeholder="e.g. Dress" style={styles.input} />
    {type === 'ready_to_wear' && <><Text style={styles.label}>AVAILABLE SIZES</Text><TextInput accessibilityLabel="Available sizes, separated by commas" value={sizes} onChangeText={onSizesChange} maxLength={1000} editable={!disabled} placeholder="e.g. S, M, L, XL" style={styles.input} />
      <Text style={styles.label}>AVAILABLE COLOURS (OPTIONAL)</Text><TextInput accessibilityLabel="Available colours, separated by commas" value={colors} onChangeText={onColorsChange} maxLength={1000} editable={!disabled} placeholder="e.g. Black, Cream" style={styles.input} /></>}
  </View>;
}
const styles = StyleSheet.create({ group: { gap: 12, marginBottom: 24 }, row: { flexDirection: "row", gap: 10 }, label: { fontFamily: "InstrumentSans-SemiBold", fontSize: 12, color: "#453332" }, hint: { fontFamily: "InstrumentSans-Regular", fontSize: 12, lineHeight: 18, color: "#746765" }, option: { flex: 1, minHeight: 48, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#D7CFCD", justifyContent: "center", alignItems: "center" }, selected: { backgroundColor: "#453332", borderColor: "#453332" }, text: { fontFamily: "InstrumentSans-Medium", fontSize: 13, color: "#453332" }, input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: "#D7CFCD", paddingHorizontal: 12, fontSize: 16, fontFamily: "InstrumentSans-Regular", color: "#453332", backgroundColor: "white" } });

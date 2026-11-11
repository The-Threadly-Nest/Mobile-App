import { typeScale } from "@/shared/utils/typeScale";
import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Text } from "@/shared/components/Typography";
import { CatalogChoicePicker } from "./CatalogChoicePicker";
import { GARMENT_CATEGORIES, GARMENT_SIZES, GARMENT_COLORS } from "../utils/catalogChoices";
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
    <Text style={styles.label}>CATEGORY</Text><CatalogChoicePicker label="Category" value={category} onChange={onCategoryChange} choices={GARMENT_CATEGORIES} disabled={disabled} />
    {type === 'ready_to_wear' && <><Text style={styles.label}>AVAILABLE SIZES</Text><CatalogChoicePicker label="Available sizes" value={sizes} onChange={onSizesChange} choices={GARMENT_SIZES} multiple disabled={disabled} />
      <Text style={styles.hint}>Letter, clothing or shoe sizes. Use your published size system.</Text>
      <Text style={styles.label}>AVAILABLE COLOURS (OPTIONAL)</Text><CatalogChoicePicker label="Available colours" value={colors} onChange={onColorsChange} choices={GARMENT_COLORS} multiple disabled={disabled} /></>}
  </View>;
}
const styles = StyleSheet.create({ group: { gap: 12, marginBottom: 24 }, row: { flexDirection: "row", gap: 10 }, label: { fontFamily: "InstrumentSans-SemiBold", fontSize: 12, color: "#4A403B" }, hint: { ...typeScale.caption, color: "#4A403B" }, option: { flex: 1, minHeight: 48, borderRadius: 24, padding: 12, borderWidth: 1, borderColor: "#453332", justifyContent: "center", alignItems: "center" }, selected: { backgroundColor: "#F96951", borderColor: "#F96951" }, text: { fontFamily: "InstrumentSans-Medium", fontSize: 13, color: "#4A403B" }, input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: "#453332", paddingHorizontal: 12, fontSize: 16, fontFamily: "InstrumentSans-Regular", color: "#4A403B", backgroundColor: "#FFFDF9" } });

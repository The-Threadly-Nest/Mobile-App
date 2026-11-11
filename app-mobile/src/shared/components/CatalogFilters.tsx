import React, { useEffect, useState } from "react";
import { Modal, View, Pressable, StyleSheet } from "react-native";
import { X } from "lucide-react-native";
import { Text } from "./Typography";

export default function CatalogFilters({ visible, onClose, type, onTypeChange, sort, onSortChange }: {
  visible: boolean; onClose: () => void; type: string; onTypeChange: (value: string) => void;
  sort: string; onSortChange: (value: string) => void;
}) {
  const [draftType, setDraftType] = useState(type);
  const [draftSort, setDraftSort] = useState(sort);
  useEffect(() => {
    if (visible) { setDraftType(type); setDraftSort(sort); }
  }, [visible, type, sort]);
  const apply = () => { onTypeChange(draftType); onSortChange(draftSort); onClose(); };
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.overlay}><View style={styles.sheet}>
      <View style={styles.header}><Text style={styles.title}>Filters</Text><Pressable onPress={onClose} style={styles.close} accessibilityLabel="Close filters"><X color="#453332" /></Pressable></View>
      <Text style={styles.label}>Offering</Text><View style={styles.wrap}>{[["", "All"], ["ready_to_wear", "Ready to wear"], ["custom_fit", "Custom fit"]].map(([value, label]) => <Pressable accessibilityRole="button" accessibilityState={{ selected: draftType === value }} key={value} onPress={() => setDraftType(value)} style={[styles.chip, draftType === value && styles.selected]}><Text style={[styles.text, draftType === value && styles.white]}>{label}</Text></Pressable>)}</View>
      <Text style={styles.label}>Sort</Text><View style={styles.wrap}>{[["newest", "Newest"], ["price_asc", "Price: low to high"], ["price_desc", "Price: high to low"]].map(([value, label]) => <Pressable accessibilityRole="button" accessibilityState={{ selected: draftSort === value }} key={value} onPress={() => setDraftSort(value)} style={[styles.chip, draftSort === value && styles.selected]}><Text style={[styles.text, draftSort === value && styles.white]}>{label}</Text></Pressable>)}</View>
      <Pressable accessibilityRole="button" onPress={apply} style={styles.done}><Text style={styles.white}>Show results</Text></Pressable>
    </View></View>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(43, 43, 43,0.35)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#FFFFFF", padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 18, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { flex: 1, fontFamily: "InstrumentSans-SemiBold", fontSize: 24, color: "#4A403B" },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  label: { fontFamily: "InstrumentSans-SemiBold", fontSize: 16, color: "#4A403B" },
  text: { fontFamily: "InstrumentSans-Regular", fontSize: 14, lineHeight: 20, includeFontPadding: false, textAlign: "center", color: "#4A403B" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 999, minWidth: 72, paddingHorizontal: 18, paddingVertical: 10, minHeight: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#453332", backgroundColor: "#FFFFFF" },
  selected: { backgroundColor: "#F96951", borderColor: "#F96951" }, white: { fontFamily: "InstrumentSans-SemiBold", color: "#FFFFFF" },
  done: { minHeight: 50, borderRadius: 25, backgroundColor: "#F96951", alignItems: "center", justifyContent: "center" },
});

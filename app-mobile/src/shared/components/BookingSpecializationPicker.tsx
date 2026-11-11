import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Check } from "lucide-react-native";
import { Text } from "./Typography";

export default function BookingSpecializationPicker({ categories, disabled, onConfirm }: {
  categories: string[]; disabled: boolean; onConfirm: (category: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const options = [...new Set(categories.map(category => category.trim()).filter(Boolean))];
  useEffect(() => { if (selected && !options.includes(selected)) setSelected(null); }, [categories, selected]);
  return <View style={styles.picker}>
    {options.map(category => <Pressable key={category} accessibilityRole="radio" accessibilityState={{ selected: selected === category, disabled }}
      onPress={() => setSelected(category)} disabled={disabled} style={[styles.option, selected === category && styles.selected]}>
      <Text style={styles.label}>{category}</Text>
      {selected === category ? <Check size={18} color="#453332" /> : null}
    </Pressable>)}
    {!options.length ? <Text style={styles.hint}>This fashion house hasn't added its specializations yet. Talk to the admin for help.</Text> : null}
    <Pressable accessibilityRole="button" disabled={disabled || !selected || !options.includes(selected)}
      onPress={() => { if (selected && options.includes(selected)) onConfirm(selected); }} style={[styles.continue, (disabled || !selected) && { opacity: 0.4 }]}>
      <Text style={styles.white}>Choose a date</Text>
    </Pressable>
  </View>;
}
const styles = StyleSheet.create({
  picker: { gap: 10, marginTop: 12 }, option: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 14, borderRadius: 16, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "transparent" },
  selected: { borderColor: "#453332" }, label: { flex: 1, fontFamily: "InstrumentSans-Medium", fontSize: 14, lineHeight: 20, color: "#4A403B" },
  hint: { fontFamily: "InstrumentSans-Regular", fontSize: 13, lineHeight: 18, color: "#4A403B" },
  continue: { minHeight: 46, borderRadius: 23, backgroundColor: "#453332", alignItems: "center", justifyContent: "center" }, white: { fontFamily: "InstrumentSans-SemiBold", fontSize: 14, color: "#FFFFFF" },
});

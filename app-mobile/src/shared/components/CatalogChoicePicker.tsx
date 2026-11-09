import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "@/shared/components/Typography";
import { Check, ChevronDown, X } from "lucide-react-native";
import { selectedCatalogChoices, toggleCatalogChoice } from "../utils/catalogChoices";

export function CatalogChoicePicker({ label, value, choices, onChange, multiple = false, disabled = false }: {
  label: string; value: string; choices: string[]; onChange: (value: string) => void; multiple?: boolean; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = multiple ? selectedCatalogChoices(value) : value ? [value] : [];
  // Preserve older published options when editing; never silently discard them.
  const options = [...new Set([...choices, ...selected])];
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: open, disabled }} disabled={disabled} onPress={() => setOpen(true)} style={[styles.input, disabled && { opacity: 0.5 }]}>
      <Text style={[styles.value, !value && { color: "#746765" }]}>{value || "Select " + label.toLowerCase()}</Text><ChevronDown size={18} color="#746765" />
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={styles.overlay}>
        <Pressable accessibilityLabel="Close selection" style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
        <View style={styles.modal} accessibilityViewIsModal>
          <View style={styles.heading}><Text accessibilityRole="header" style={styles.title}>{label}</Text><Pressable accessibilityLabel="Close selection" onPress={() => setOpen(false)} style={styles.close}><X size={22} color="#453332" /></Pressable></View>
          {multiple ? <Text style={styles.hint}>Select up to 30 available options.</Text> : null}
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={styles.choices}>
            {options.map(option => {
              const active = selected.includes(option);
              const blocked = disabled || (multiple && !active && selected.length >= 30);
              return <Pressable key={option} accessibilityRole={multiple ? "checkbox" : "radio"} accessibilityState={{ checked: active, selected: active, disabled: blocked }} disabled={blocked} onPress={() => { onChange(multiple ? toggleCatalogChoice(value, option) : option); if (!multiple) setOpen(false); }} style={[styles.choice, active && styles.selected, blocked && { opacity: 0.5 }]}><Text style={[styles.text, active && styles.white]}>{option}</Text>{active ? <Check size={16} color="white" /> : null}</Pressable>;
            })}
          </ScrollView>
          <View style={styles.heading}>
            <Pressable disabled={disabled} accessibilityLabel="Clear selection" style={styles.close} onPress={() => onChange("")}><Text style={styles.text}>Clear</Text></Pressable>
            <Pressable style={[styles.done, styles.selected]} onPress={() => setOpen(false)}><Text style={[styles.text, styles.white]}>Done{multiple && selected.length ? ` (${selected.length})` : ""}</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: "#D7CFCD", padding: 12, backgroundColor: "white", flexDirection: "row", alignItems: "center", gap: 10 },
  value: { flex: 1, fontSize: 15, fontFamily: "InstrumentSans-Regular", color: "#2B2B2B" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", paddingHorizontal: 20, paddingVertical: 36 },
  modal: { width: "100%", maxWidth: 480, maxHeight: "100%", flexShrink: 1, backgroundColor: "white", borderRadius: 24, padding: 20, gap: 12 },
  heading: { flexDirection: "row", alignItems: "center", gap: 12 }, title: { flex: 1, fontFamily: "InstrumentSans-SemiBold", fontSize: 18, color: "#2B2B2B" },
  close: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingBottom: 8 },
  choice: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: "#D7CFCD", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  selected: { backgroundColor: "#F96951", borderColor: "#F96951" }, white: { color: "white" },
  text: { fontFamily: "InstrumentSans-Medium", fontSize: 13, color: "#2B2B2B" }, hint: { fontFamily: "InstrumentSans-Regular", fontSize: 12, color: "#746765" },
  done: { flex: 1, minHeight: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
});

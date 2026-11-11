import { typeScale } from "@/shared/utils/typeScale";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text, TextInput } from "@/shared/components/Typography";
import { ChevronDown, X } from "lucide-react-native";
import { selectedCatalogChoices, toggleCatalogChoice } from "../utils/catalogChoices";

export function CatalogChoicePicker({ label, value, choices, onChange, multiple = false, disabled = false, allowCustom = false }: {
  label: string; value: string; choices: string[]; onChange: (value: string) => void; multiple?: boolean; disabled?: boolean; allowCustom?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const [customError, setCustomError] = useState("");
  const selected = multiple ? selectedCatalogChoices(value) : value ? [value] : [];
  // Preserve older published options when editing; never silently discard them.
  const options = [...new Set([...choices, ...selected])];
  const addCustom = () => {
    const entry = custom.trim();
    if (!entry || entry.length > 50 || entry.includes(",")) {
      setCustomError("Enter one colour name, up to 50 characters, without commas.");
      return;
    }
    const existing = options.find(option => option.toLowerCase() === entry.toLowerCase());
    const name = existing || entry;
    if (selected.includes(name)) { setCustom(""); setCustomError(""); return; }
    if (multiple && selected.length >= 30) { setCustomError("Choose up to 30 colours."); return; }
    onChange(multiple ? [...selected, name].join(", ") : name);
    setCustom(""); setCustomError("");
  };
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: open, disabled }} disabled={disabled} onPress={() => setOpen(true)} style={[styles.input, disabled && { opacity: 0.5 }]}>
      <Text style={[styles.value, !value && { color: "#4A403B" }]}>{value || "Select " + label.toLowerCase()}</Text><ChevronDown size={18} color="#2B2B2B" />
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.overlay}>
        <Pressable accessibilityLabel="Close selection" style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
        <View style={styles.modal} accessibilityViewIsModal>
          <View style={styles.heading}><Text accessibilityRole="header" style={styles.title}>{label}</Text><Pressable accessibilityLabel="Close selection" onPress={() => setOpen(false)} style={styles.close}><X size={22} color="#453332" /></Pressable></View>
          {multiple ? <Text style={styles.hint}>Select up to 30 available options.</Text> : null}
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={styles.choices}>
            {options.map(option => {
              const active = selected.includes(option);
              const blocked = disabled || (multiple && !active && selected.length >= 30);
              return <Pressable key={option} accessibilityRole={multiple ? "checkbox" : "radio"} accessibilityState={{ checked: active, selected: active, disabled: blocked }} disabled={blocked} onPress={() => { onChange(multiple ? toggleCatalogChoice(value, option) : option); if (!multiple) setOpen(false); }} style={[styles.choice, active && styles.selected, blocked && { opacity: 0.5 }]}><Text style={[styles.text, active && styles.white]}>{option}</Text></Pressable>;
            })}
          </ScrollView>
          {allowCustom ? <View style={{ gap: 8 }}>
            <TextInput accessibilityLabel="Custom colour" placeholder="Add another colour" value={custom} onChangeText={text => { setCustom(text); setCustomError(""); }} maxLength={50} editable={!disabled} returnKeyType="done" onSubmitEditing={() => { if (!disabled) addCustom(); }} style={styles.input} />
            {customError ? <Text accessibilityRole="alert" style={styles.text}>{customError}</Text> : null}
            <Pressable accessibilityRole="button" disabled={disabled || !custom.trim()} onPress={addCustom} style={[styles.done, styles.selected, { flex: 0, opacity: disabled || !custom.trim() ? 0.5 : 1 }]}><Text style={[styles.text, styles.white]}>Add colour</Text></Pressable>
          </View> : null}
          <View style={styles.heading}>
            <Pressable disabled={disabled} accessibilityLabel="Clear selection" style={styles.close} onPress={() => onChange("")}><Text style={styles.text}>Clear</Text></Pressable>
            <Pressable style={[styles.done, styles.selected]} onPress={() => setOpen(false)}><Text style={[styles.text, styles.white]}>Done{multiple && selected.length ? ` (${selected.length})` : ""}</Text></Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: "#453332", padding: 12, backgroundColor: "#FFFDF9", flexDirection: "row", alignItems: "center", gap: 10 },
  value: { flex: 1, fontSize: 15, fontFamily: "InstrumentSans-Regular", color: "#4A403B" },
  overlay: { flex: 1, backgroundColor: "rgba(43, 43, 43,0.4)", justifyContent: "center", alignItems: "center", paddingHorizontal: 20, paddingVertical: 36 },
  modal: { width: "100%", maxWidth: 480, maxHeight: "100%", flexShrink: 1, backgroundColor: "#FFFDF9", borderRadius: 24, padding: 20, gap: 12 },
  heading: { flexDirection: "row", alignItems: "center", gap: 12 }, title: { flex: 1, fontFamily: "InstrumentSans-SemiBold", fontSize: 18, color: "#4A403B" },
  close: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingBottom: 8 },
  choice: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: "#453332", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  selected: { backgroundColor: "#F96951", borderColor: "#F96951" }, white: { color: "white" },
  text: { fontFamily: "InstrumentSans-Medium", fontSize: 13, color: "#4A403B" }, hint: { ...typeScale.caption, color: "#4A403B" },
  done: { flex: 1, minHeight: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
});

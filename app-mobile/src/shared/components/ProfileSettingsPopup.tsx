import React from "react";
import { Modal, View, Pressable, KeyboardAvoidingView, Platform, useWindowDimensions, StyleSheet } from "react-native";
import { Text } from "@/shared/components/Typography";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { ProfileDesignIcon } from "./ProfileDesign";

export function ProfileSettingsPopup({ visible, onClose, children }: {
  visible: boolean; onClose: () => void; children: React.ReactNode;
}) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <SafeAreaView style={styles.overlay}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close settings" onPress={onClose} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={[styles.card, { height: Math.max(180, Math.min(520, height - insets.top - insets.bottom - 32)) }]}>
          <View style={styles.header}>
            <View style={styles.heading}><ProfileDesignIcon name="settings" /><Text accessibilityRole="header" style={styles.title}>Settings</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close settings" hitSlop={6} onPress={onClose} style={styles.close}><X size={18} color="#2B2B2B" /></Pressable>
          </View>
          <View style={styles.body}>{visible ? children : null}</View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(43, 43, 43,0.6)" },
  container: { flex: 1, padding: 16, alignItems: "center", justifyContent: "center" },
  card: { width: "100%", maxWidth: 440, maxHeight: "100%", flexShrink: 1, backgroundColor: "#FFFDF9", borderRadius: 24, padding: 20, borderWidth: 1, borderColor: "#453332" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingBottom: 12, borderBottomWidth: 0, borderBottomColor: "#453332" },
  heading: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontFamily: "InstrumentSans-Regular", fontSize: 20, color: "#4A403B" },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F9E8D3", alignItems: "center", justifyContent: "center" },
  body: { flex: 1, minHeight: 0, paddingTop: 16 },
});

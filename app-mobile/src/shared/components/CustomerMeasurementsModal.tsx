import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, ActivityIndicator, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, Ruler } from "lucide-react-native";
import { measurementGroups, measurementLabel, type CustomerMeasurement } from "../utils/customerMeasurements";

export default function CustomerMeasurementsModal({ visible, onClose, rows, loading, error, onRetry }: {
  visible: boolean; onClose: () => void; rows: CustomerMeasurement[];
  loading: boolean; error: string; onRetry: () => void;
}) {
  const groups = measurementGroups(rows);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const maxHeight = Math.min(600, Math.max(200, height - insets.top - insets.bottom - 40));
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Close measurements" onPress={onClose} />
      <View style={[styles.card, { maxHeight }]} accessibilityViewIsModal>
        <View style={styles.header}>
          <View style={styles.headingIcon}><Ruler size={21} color="#F96951" /></View>
          <Text accessibilityRole="header" style={styles.title}>My measurements</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close measurements" onPress={onClose} style={styles.iconButton}><X size={20} color="#000000" /></Pressable>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {loading ? <View style={styles.loading}><ActivityIndicator color="#F96951" /></View> : null}
          {error ? <View style={styles.empty}>
            <Text accessibilityRole="alert" style={styles.text}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={onRetry} disabled={loading} style={styles.retry}><Text style={styles.buttonText}>Try again</Text></Pressable>
          </View> : null}
          {groups.map(group => <View key={group.id} style={styles.group}>
            <Text style={styles.groupTitle}>{group.name}</Text>
            <View style={styles.grid}>
              {group.rows.map(row => <View key={row.id} style={styles.metric}>
                <Text style={styles.label}>{measurementLabel(row.field)}</Text>
                <View style={styles.reading}>
                  <Text style={styles.value}>{Number(row.value.toFixed(2))}</Text>
                  <Text style={styles.unit}>{row.unit}</Text>
                </View>
              </View>)}
            </View>
          </View>)}
          {!loading && !error && !groups.length ? <View style={styles.empty}>
            <View style={styles.emptyIcon}><Ruler size={30} color="#F96951" /></View>
            <Text style={styles.emptyTitle}>No measurements yet</Text>
            <Text style={styles.hint}>Your designer will add them at your appointment.</Text>
          </View> : null}
        </ScrollView>
        <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.done, pressed && { opacity: 0.8 }]}><Text style={styles.buttonText}>Done</Text></Pressable>
      </View>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", paddingHorizontal: 20, paddingVertical: 20 },
  card: { width: "100%", maxWidth: 440, flexShrink: 1, backgroundColor: "#FFFFFF", borderRadius: 28, padding: 20, gap: 18 },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  headingIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#FFF1ED", alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontFamily: "InstrumentSans-SemiBold", fontSize: 19, color: "#000000" },
  iconButton: { minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: "#F5F5F5" },
  scroll: { flexShrink: 1 }, content: { gap: 20, paddingBottom: 2 }, group: { gap: 10 },
  groupTitle: { fontFamily: "InstrumentSans-Medium", fontSize: 13, color: "#000000" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: { flexBasis: "45%", flexGrow: 1, backgroundColor: "#F7F7F7", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 16, minHeight: 94, gap: 10 },
  label: { fontFamily: "InstrumentSans-Regular", fontSize: 13, lineHeight: 18, color: "#000000" },
  reading: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: 6 },
  value: { fontFamily: "InstrumentSans-SemiBold", fontSize: 27, lineHeight: 34, color: "#000000" },
  unit: { fontFamily: "InstrumentSans-Regular", fontSize: 13, color: "#000000" },
  loading: { paddingVertical: 16 },
  text: { fontFamily: "InstrumentSans-Regular", fontSize: 14, lineHeight: 21, color: "#000000", textAlign: "center" },
  hint: { fontFamily: "InstrumentSans-Regular", fontSize: 13, lineHeight: 20, color: "#000000", textAlign: "center", maxWidth: 260 },
  empty: { paddingVertical: 18, gap: 12, alignItems: "center" },
  emptyIcon: { height: 64, width: 64, borderRadius: 20, backgroundColor: "#FFF1ED", justifyContent: "center", alignItems: "center", marginBottom: 4 },
  emptyTitle: { fontFamily: "InstrumentSans-SemiBold", fontSize: 17, color: "#000000" },
  retry: { minHeight: 44, paddingHorizontal: 20, backgroundColor: "#F96951", borderRadius: 22, justifyContent: "center" },
  done: { minHeight: 50, borderRadius: 25, backgroundColor: "#F96951", alignItems: "center", justifyContent: "center" },
  buttonText: { fontFamily: "InstrumentSans-SemiBold", fontSize: 15, color: "#000000" },
});

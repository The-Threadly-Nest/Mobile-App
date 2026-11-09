import React, { useEffect, useMemo, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, View, ActivityIndicator, useWindowDimensions } from "react-native";
import { Text } from "@/shared/components/Typography";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, Ruler, ChevronRight, ChevronLeft } from "lucide-react-native";
import { measurementGroups, measurementLabel, type CustomerMeasurement } from "../utils/customerMeasurements";

export default function CustomerMeasurementsModal({ visible, onClose, rows, loading, error, onRetry }: {
  visible: boolean; onClose: () => void; rows: CustomerMeasurement[];
  loading: boolean; error: string; onRetry: () => void;
}) {
  const groups = useMemo(() => measurementGroups(rows), [rows]);
  const [selectedHouseId, setSelectedHouseId] = useState<string | null>(null);
  useEffect(() => {
    if (visible) setSelectedHouseId(null);
  }, [visible]);
  const selectedGroup = groups.find(g => g.id === selectedHouseId) ?? null;
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const maxHeight = Math.min(620, Math.max(200, height - insets.top - insets.bottom - 40));
  const showList = !selectedGroup;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Close measurements" onPress={onClose} />
        <View style={[styles.card, { maxHeight }]} accessibilityViewIsModal>

          {/* Header */}
          <View style={styles.header}>
            {!showList ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to fashion houses"
                onPress={() => setSelectedHouseId(null)}
                style={styles.iconButton}
              >
                <ChevronLeft size={20} color="#000000" />
              </Pressable>
            ) : (
              <View style={styles.headingIcon}><Ruler size={21} color="#F96951" /></View>
            )}
            <Text accessibilityRole="header" style={styles.title}>
              {selectedGroup ? selectedGroup.name : "My measurements"}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close measurements" onPress={onClose} style={styles.iconButton}>
              <X size={20} color="#000000" />
            </Pressable>
          </View>

          {/* Loading / Error */}
          {loading ? <View style={styles.loading}><ActivityIndicator color="#F96951" /></View> : null}
          {error ? (
            <View style={styles.empty}>
              <Text accessibilityRole="alert" style={styles.text}>{error}</Text>
              <Pressable accessibilityRole="button" onPress={onRetry} disabled={loading} style={styles.retry}>
                <Text style={styles.buttonText}>Try again</Text>
              </Pressable>
            </View>
          ) : null}

          {/* Fashion House List */}
          {!error && showList && !loading ? (
            groups.length === 0 ? (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}><Ruler size={30} color="#F96951" /></View>
                <Text style={styles.emptyTitle}>No measurements yet</Text>
                <Text style={styles.hint}>Your designer will add them at your appointment.</Text>
              </View>
            ) : (
              <ScrollView style={styles.scroll} contentContainerStyle={styles.houseList} showsVerticalScrollIndicator={false}>
                {groups.map(house => (
                  <Pressable
                    key={house.id}
                    accessibilityRole="button"
                    onPress={() => setSelectedHouseId(house.id)}
                    style={({ pressed }) => [styles.houseRow, pressed && { opacity: 0.75 }]}
                  >
                    <View style={styles.houseAvatar}>
                      {house.logoUrl ? (
                        <Image source={{ uri: house.logoUrl }} style={styles.houseAvatarImg} resizeMode="cover" />
                      ) : (
                        <Text style={styles.houseAvatarLetter}>{house.name.charAt(0).toUpperCase()}</Text>
                      )}
                    </View>
                    <View style={styles.houseInfo}>
                      <Text style={styles.houseName}>{house.name}</Text>
                      <Text style={styles.houseCount}>
                        {house.rows.length} measurement{house.rows.length !== 1 ? "s" : ""}
                      </Text>
                    </View>
                    <ChevronRight size={18} color="#8A7550" />
                  </Pressable>
                ))}
              </ScrollView>
            )
          ) : null}

          {/* Measurement Detail */}
          {!error && selectedGroup ? (
            <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
              <View style={styles.grid}>
                {selectedGroup.rows.map(row => (
                  <View key={row.id} style={styles.metric}>
                    <Text style={styles.label}>{measurementLabel(row.field)}</Text>
                    <View style={styles.reading}>
                      <Text style={styles.value}>{Number(row.value.toFixed(2))}</Text>
                      <Text style={styles.unit}>{row.unit}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          ) : null}

          <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.done, pressed && { opacity: 0.8 }]}>
            <Text style={styles.buttonText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", paddingHorizontal: 20, paddingVertical: 20 },
  card: { width: "100%", maxWidth: 440, flexShrink: 1, backgroundColor: "#FFFFFF", borderRadius: 28, padding: 20, gap: 18 },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  headingIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#FFF1ED", alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontFamily: "InstrumentSans-SemiBold", fontSize: 19, color: "#2B2B2B" },
  iconButton: { minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: "#F5F5F5" },
  scroll: { flexShrink: 1 },
  houseList: { gap: 4, paddingBottom: 2 },
  houseRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 16 },
  houseAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#453332", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 },
  houseAvatarImg: { width: 52, height: 52, borderRadius: 26 },
  houseAvatarLetter: { fontFamily: "InstrumentSans-SemiBold", fontSize: 20, color: "#FFFFFF" },
  houseInfo: { flex: 1 },
  houseName: { fontFamily: "InstrumentSans-SemiBold", fontSize: 15, color: "#2B2B2B" },
  houseCount: { fontFamily: "InstrumentSans-Regular", fontSize: 13, color: "#8A7550", marginTop: 2 },
  content: { gap: 20, paddingBottom: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: { flexBasis: "45%", flexGrow: 1, backgroundColor: "#F7F7F7", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 16, minHeight: 94, gap: 10 },
  label: { fontFamily: "InstrumentSans-Regular", fontSize: 13, lineHeight: 18, color: "#2B2B2B" },
  reading: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: 6 },
  value: { fontFamily: "InstrumentSans-SemiBold", fontSize: 27, lineHeight: 34, color: "#2B2B2B" },
  unit: { fontFamily: "InstrumentSans-Regular", fontSize: 13, color: "#2B2B2B" },
  loading: { paddingVertical: 16 },
  text: { fontFamily: "InstrumentSans-Regular", fontSize: 14, lineHeight: 21, color: "#2B2B2B", textAlign: "center" },
  hint: { fontFamily: "InstrumentSans-Regular", fontSize: 13, lineHeight: 20, color: "#2B2B2B", textAlign: "center", maxWidth: 260 },
  empty: { paddingVertical: 18, gap: 12, alignItems: "center" },
  emptyIcon: { height: 64, width: 64, borderRadius: 20, backgroundColor: "#FFF1ED", justifyContent: "center", alignItems: "center", marginBottom: 4 },
  emptyTitle: { fontFamily: "InstrumentSans-SemiBold", fontSize: 17, color: "#2B2B2B" },
  retry: { minHeight: 44, paddingHorizontal: 20, backgroundColor: "#F96951", borderRadius: 22, justifyContent: "center" },
  done: { minHeight: 50, borderRadius: 25, backgroundColor: "#F96951", alignItems: "center", justifyContent: "center" },
  buttonText: { fontFamily: "InstrumentSans-SemiBold", fontSize: 15, color: "#FFFFFF" },
});

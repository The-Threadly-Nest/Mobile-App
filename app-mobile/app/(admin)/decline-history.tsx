import React, { useCallback, useState } from "react";
import { View, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Text } from "@/shared/components/Typography";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import { apiFetch } from "@/shared/utils/apiClient";
import { typeScale } from "@/shared/utils/typeScale";
export default function DeclineHistory() {
  const [rows, setRows] = useState<Array<{ id: string; targetId: string; comment: string; actorName: string | null; createdAt: string }>>([]);
  const [message, setMessage] = useState("Loading decline history…");
  useFocusEffect(useCallback(() => { let active = true; void apiFetch<typeof rows>("/api/escalations/decline-records", { silent: true }).then(value => { if (active) { setRows(value); setMessage("No declined requests yet."); } }).catch(() => { if (active) setMessage("Couldn't load decline history. Please reopen this page to retry."); }); return () => { active = false; }; }, []));
  return <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}><ScrollView contentContainerStyle={{ padding: 24, paddingTop: 36, gap: 16 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Pressable accessibilityLabel="Back" onPress={() => router.canGoBack() ? router.back() : router.replace("/(admin)/dashboard")} style={{ width: 44, height: 44, justifyContent: "center", alignItems: "center" }}><BackArrowIcon /></Pressable><Text style={typeScale.pageTitle}>Decline history</Text></View><Text style={typeScale.caption}>Internal records, visible only to your fashion house admin.</Text>{!rows.length && <Text style={typeScale.body}>{message}</Text>}{rows.map(row => <View key={row.id} style={{ backgroundColor: "#F9E8D3", padding: 18, borderRadius: 18, gap: 8 }}><Text style={typeScale.sectionTitle}>Request #{row.targetId.slice(0,8)}</Text><Text style={typeScale.body}>{row.comment}</Text><Text style={typeScale.caption}>{row.actorName || "Admin"} · {new Date(row.createdAt).toLocaleString()}</Text></View>)}</ScrollView></SafeAreaView>;
}

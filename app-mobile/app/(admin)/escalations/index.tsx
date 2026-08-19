import React, { useState, useEffect } from "react";
import { View, FlatList, Pressable, Text, Modal, ScrollView, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AlertCircle, X, ChevronLeft, CheckCircle } from "lucide-react-native";
import { router } from "expo-router";
import { Headline, Subtext } from "@/shared/components/Headline";
import { EmptyState } from "@/shared/components/EmptyState";
import { Button } from "@/shared/components/Button";
import { useAuthStore } from "@/stores/useAuthStore";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

interface Handoff {
  id: string;
  summary: string;
  reason: string;
  resolved: boolean;
  createdAt: string;
  customer: {
    email: string;
  };
}

interface MessageTurn {
  role: "user" | "model";
  text: string;
}

export default function EscalationQueueScreen() {
  const [filter, setFilter] = useState<"open" | "resolved">("open");
  const [escalations, setEscalations] = useState<Handoff[]>([]);
  const [loading, setLoading] = useState(false);

  // Detail Modal States
  const [selectedItem, setSelectedItem] = useState<Handoff | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [transcript, setTranscript] = useState<MessageTurn[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [resolving, setResolving] = useState(false);

  const token = useAuthStore((s) => s.token);

  const fetchEscalations = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/escalations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setEscalations(data);
      }
    } catch (e) {
      console.error("Failed to fetch handoffs", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEscalations();
  }, [token]);

  const handleOpenItem = async (item: Handoff) => {
    setSelectedItem(item);
    setTranscript([]);
    setDetailModalVisible(true);
    setLoadingDetail(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/escalations/${item.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setTranscript(data.transcript ?? []);
      }
    } catch (e) {
      console.error("Failed to fetch transcript", e);
      Alert.alert("Error", "Could not load conversation transcript.");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedItem || !token) return;
    setResolving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/escalations/${selectedItem.id}/resolve`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        // Update local list
        setEscalations((prev) =>
          prev.map((e) => (e.id === selectedItem.id ? { ...e, resolved: true } : e))
        );
        setDetailModalVisible(false);
        setSelectedItem(null);
      } else {
        const body = await res.json();
        Alert.alert("Error", body.error ?? "Failed to resolve handoff.");
      }
    } catch (e) {
      console.error("Failed to resolve", e);
      Alert.alert("Error", "Something went wrong.");
    } finally {
      setResolving(false);
    }
  };

  const filtered = escalations.filter((e) => (filter === "open" ? !e.resolved : e.resolved));

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return "Just now";
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-4 pb-2">
        <Pressable onPress={() => router.back()} className="mr-3">
          <ChevronLeft size={24} color="#4A080C" />
        </Pressable>
        <Headline className="text-xl">Chat Handoffs</Headline>
      </View>

      <View className="flex-row px-5 mb-3 gap-2">
        <Pressable
          onPress={() => setFilter("open")}
          className={`px-4 py-2 rounded-pill ${filter === "open" ? "bg-oxblood" : "bg-white border border-oxblood"}`}
        >
          <Text className={`font-body-semibold text-xs ${filter === "open" ? "text-cream" : "text-oxblood"}`}>
            Open ({escalations.filter((e) => !e.resolved).length})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setFilter("resolved")}
          className={`px-4 py-2 rounded-pill ${filter === "resolved" ? "bg-oxblood" : "bg-white border border-oxblood"}`}
        >
          <Text className={`font-body-semibold text-xs ${filter === "resolved" ? "text-cream" : "text-oxblood"}`}>
            Resolved
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#4A080C" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 20 }}
          refreshing={loading}
          onRefresh={fetchEscalations}
          ListEmptyComponent={
            <EmptyState
              title={filter === "open" ? "No open handoffs" : "No resolved handoffs"}
              message="Conversations the assistant couldn't complete show up here."
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleOpenItem(item)}
              className="border border-grey100 bg-white rounded-xl p-4 mb-3 active:bg-grey100/30"
            >
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center flex-1 mr-2">
                  <AlertCircle size={14} color="#4A080C" />
                  <Text className="font-body-semibold text-ink ml-1.5 flex-1" numberOfLines={1}>
                    {item.customer?.email ?? "Unknown Customer"}
                  </Text>
                </View>
                {item.resolved && (
                  <View className="flex-row items-center bg-green-100 px-2 py-0.5 rounded-full">
                    <CheckCircle size={10} color="#15803d" />
                    <Text className="font-body-semibold text-[10px] text-green-700 ml-1">Resolved</Text>
                  </View>
                )}
              </View>
              <Text className="font-body text-grey700 text-sm mb-2" numberOfLines={2}>
                {item.summary}
              </Text>
              <View className="flex-row justify-between items-center">
                <Text className="font-body-semibold text-gold text-[10px] uppercase tracking-wider">
                  Reason: {item.reason.replace(/_/g, " ")}
                </Text>
                <Text className="font-body text-grey500 text-xs">{formatTime(item.createdAt)}</Text>
              </View>
            </Pressable>
          )}
        />
      )}

      {/* Transcript Detail Modal */}
      <Modal visible={detailModalVisible} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-cream rounded-t-3xl p-6 h-[85%]">
            {/* Header */}
            <View className="flex-row justify-between items-center pb-4 border-b border-grey100 mb-4">
              <View className="flex-1 mr-4">
                <Text className="font-display text-oxblood text-base" numberOfLines={1}>
                  {selectedItem?.customer?.email}
                </Text>
                <Text className="font-body text-grey700 text-xs mt-0.5">
                  Handoff Reason: {selectedItem?.reason.replace(/_/g, " ")}
                </Text>
              </View>
              <Pressable onPress={() => setDetailModalVisible(false)} className="p-1">
                <X size={20} color="#4A080C" />
              </Pressable>
            </View>

            {/* Transcript scroll view */}
            {loadingDetail ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator color="#4A080C" />
                <Text className="font-body text-grey700 text-xs mt-2">Loading transcript...</Text>
              </View>
            ) : (
              <View className="flex-1">
                <ScrollView className="flex-1 mb-4" showsVerticalScrollIndicator={false}>
                  <View className="bg-white border border-grey100 rounded-xl p-3 mb-4">
                    <Text className="font-body-semibold text-ink text-xs mb-1">AI Summary:</Text>
                    <Text className="font-body text-grey700 text-xs">{selectedItem?.summary}</Text>
                  </View>

                  {transcript.length === 0 ? (
                    <Text className="font-body text-grey500 text-xs text-center py-10">
                      No message exchanges available.
                    </Text>
                  ) : (
                    transcript.map((turn, i) => (
                      <View
                        key={i}
                        className={`mb-3 max-w-[85%] ${
                          turn.role === "user" ? "self-end items-end" : "self-start items-start"
                        }`}
                      >
                        <View
                          className={`px-4 py-2.5 rounded-2xl ${
                            turn.role === "user"
                              ? "bg-oxblood"
                              : "bg-white border border-grey100"
                          }`}
                        >
                          <Text
                            className={`font-body text-sm ${
                              turn.role === "user" ? "text-cream" : "text-ink"
                            }`}
                          >
                            {turn.text}
                          </Text>
                        </View>
                      </View>
                    ))
                  )}
                </ScrollView>

                {/* Footer Actions */}
                {selectedItem && !selectedItem.resolved && (
                  <View className="pt-2 border-t border-grey100">
                    <Button
                      label={resolving ? "Resolving..." : "Mark as Resolved"}
                      onPress={handleResolve}
                      loading={resolving}
                      disabled={resolving}
                    />
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

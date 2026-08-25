import React, { useState, useEffect } from "react";
import { View, FlatList, Pressable, Modal, Text, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Plus, Clock, CheckCircle2, Image as ImageIcon } from "lucide-react-native";
import { router } from "expo-router";
import { Headline, Subtext } from "@/shared/components/Headline";
import { Card } from "@/shared/components/Card";
import { Input } from "@/shared/components/Input";
import { Button } from "@/shared/components/Button";
import { useAuthStore } from "@/stores/useAuthStore";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

interface StaffMember {
  id: string;
  email: string;
  active: boolean;
  name?: string;
}

export default function StaffScreen() {
  const [showInvite, setShowInvite] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingStaff, setFetchingStaff] = useState(false);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [error, setError] = useState("");
  const token = useAuthStore((s) => s.token);

  const fetchStaff = async () => {
    if (!token) return;
    setFetchingStaff(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/staff`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setStaffList(data);
      }
    } catch (e) {
      console.error("Failed to fetch staff list", e);
    } finally {
      setFetchingStaff(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, [token]);

  const handleInvite = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/staff/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, email }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not send invite.");
      setShowInvite(false);
      setName("");
      setEmail("");
      fetchStaff();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row justify-between items-center px-5 pt-4 pb-2">
        <Headline className="text-2xl">Staff</Headline>
        <Pressable onPress={() => setShowInvite(true)} className="w-10 h-10 bg-oxblood rounded-full items-center justify-center">
          <Plus size={20} color="#FBF7EF" />
        </Pressable>
      </View>

      {fetchingStaff ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#4A080C" />
        </View>
      ) : (
        <FlatList
          data={staffList}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 20 }}
          ListEmptyComponent={
            <View className="py-12 items-center">
              <Text className="font-body text-grey700 text-sm text-center">No staff members found. Tap + to invite staff.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Card className="mb-3 flex-row items-center justify-between">
              <View className="flex-1 mr-2">
                <Text className="font-body-semibold text-ink" numberOfLines={1}>
                  {item.email}
                </Text>
                <View className="flex-row items-center mt-1">
                  {item.active ? (
                    <View className="flex-row items-center">
                      <CheckCircle2 size={12} color="#4A080C" />
                      <Text className="font-body text-[11px] text-grey700 ml-1">Active</Text>
                    </View>
                  ) : (
                    <View className="flex-row items-center">
                      <Clock size={12} color="#C4A763" />
                      <Text className="font-body text-[11px] text-gold ml-1">Pending Activation</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* View Staff Moodboard Button */}
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/(admin)/staff/[staffId]/moodboard",
                    params: { staffId: item.id, staffName: item.name || item.email.split("@")[0] },
                  })
                }
                className="bg-oxblood/10 px-3 py-2 rounded-xl flex-row items-center gap-1.5"
              >
                <ImageIcon size={14} color="#4A080C" />
                <Text className="font-body-semibold text-oxblood text-xs">Moodboard →</Text>
              </Pressable>
            </Card>
          )}
        />
      )}

      <Modal visible={showInvite} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-cream p-6 rounded-t-2xl">
            <Headline className="text-xl mb-4">Add Staff</Headline>
            <Input placeholder="Full name" value={name} onChangeText={setName} />
            <Input placeholder="Email" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
            <Subtext className="text-xs mb-4">They'll receive an email to set their password and activate their account.</Subtext>
            {error ? <Text className="font-body text-red-500 text-xs mb-3">{error}</Text> : null}
            <Button label="Send Invitation" onPress={handleInvite} loading={loading} disabled={!name || !email} />
            <Pressable onPress={() => setShowInvite(false)} className="mt-3">
              <Text className="font-body text-center text-grey700 text-sm">Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

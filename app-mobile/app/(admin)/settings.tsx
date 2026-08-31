import React, { useState, useEffect } from "react";
import { View, Pressable, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronRight, Users, User, Bell, HelpCircle, Shield, LogOut, Tag } from "lucide-react-native";
import { useAuthStore } from "@/stores/useAuthStore";
import { adminApi } from "@/shared/utils/apiClient";

export default function AdminSettingsScreen() {
  const logout = useAuthStore((s) => s.logout);
  const name = useAuthStore((s) => s.name);
  const email = useAuthStore((s) => s.email);
  const [businessName, setBusinessName] = useState(name || "");

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await adminApi.getProfile();
        if (res?.fashionHouse) {
          const house = res.fashionHouse;
          if (house.shopName || house.name) {
            setBusinessName(house.shopName || house.name);
          }
        }
      } catch (err) {
        console.warn("Failed to load profile for settings", err);
      }
    }
    loadProfile();
  }, []);

  const emailPrefix = email ? email.split("@")[0] : "";
  const fallbackName = emailPrefix
    ? emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1)
    : "Fashion House";
  const displayTitle = businessName || name || fallbackName;

  const SECTIONS = [
    {
      title: "Team & Business",
      items: [
        {
          label: "Garment Catalog & Clothes",
          icon: Tag,
          onPress: () => router.push("/(admin)/catalog" as any),
        },
        {
          label: "Staff Management",
          icon: Users,
          onPress: () => router.push("/(admin)/staff" as any),
        },
        {
          label: "Profile & Business Info",
          icon: User,
          onPress: () => router.push("/(admin)/profile-edit" as any),
        },
      ],
    },
    {
      title: "Preferences & Legal",
      items: [
        { label: "Notifications", icon: Bell, onPress: () => {} },
        { label: "Help & Support", icon: HelpCircle, onPress: () => {} },
        { label: "Privacy Policy", icon: Shield, onPress: () => {} },
      ],
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FBF7EF" }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 }}>
        {/* Header */}
        <Text
          style={{
            fontFamily: "Fraunces-SemiBold",
            fontSize: 28,
            color: "#3B0508",
            marginBottom: 20,
          }}
        >
          {displayTitle}
        </Text>

        {/* User Card */}
        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 20,
            padding: 18,
            marginBottom: 24,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: "#4A080C",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 14,
            }}
          >
            <Text
              style={{
                fontFamily: "Fraunces-Bold",
                fontSize: 20,
                color: "#FFFFFF",
              }}
            >
              {name ? name.charAt(0).toUpperCase() : "A"}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: "WorkSans_600SemiBold",
                fontSize: 16,
                color: "#3B0508",
                marginBottom: 2,
              }}
            >
              {name || "Fashion House Admin"}
            </Text>
            <Text
              style={{
                fontFamily: "WorkSans_400Regular",
                fontSize: 12,
                color: "#8A7550",
              }}
            >
              {email || "admin@threadly.com"}
            </Text>
          </View>
        </View>

        {/* Sections */}
        {SECTIONS.map((sec, secIdx) => (
          <View key={secIdx} style={{ marginBottom: 24 }}>
            <Text
              style={{
                fontFamily: "WorkSans_600SemiBold",
                fontSize: 12,
                color: "#8A7550",
                letterSpacing: 1.0,
                textTransform: "uppercase",
                marginBottom: 10,
                marginLeft: 4,
              }}
            >
              {sec.title}
            </Text>

            <View style={{ backgroundColor: "#FFFFFF", borderRadius: 20, overflow: "hidden" }}>
              {sec.items.map((item, itemIdx) => {
                const IconComponent = item.icon;
                const isLast = itemIdx === sec.items.length - 1;

                return (
                  <Pressable
                    key={item.label}
                    onPress={item.onPress}
                    style={({ pressed }) => [
                      {
                        flexDirection: "row",
                        alignItems: "center",
                        paddingVertical: 16,
                        paddingHorizontal: 18,
                        borderBottomWidth: isLast ? 0 : 1,
                        borderBottomColor: "rgba(0, 0, 0, 0.05)",
                        backgroundColor: pressed ? "rgba(74, 8, 12, 0.03)" : "#FFFFFF",
                      },
                    ]}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: "#F4EFE6",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 14,
                      }}
                    >
                      <IconComponent size={18} color="#4A080C" />
                    </View>
                    <Text
                      style={{
                        flex: 1,
                        fontFamily: "WorkSans_500Medium",
                        fontSize: 15,
                        color: "#3B0508",
                      }}
                    >
                      {item.label}
                    </Text>
                    <ChevronRight size={18} color="#8A7550" />
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}

        {/* Log Out Button */}
        <Pressable
          onPress={() => {
            logout();
            router.replace("/(auth)/login");
          }}
          style={({ pressed }) => [
            {
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#FFFFFF",
              borderRadius: 20,
              paddingVertical: 16,
              borderWidth: 1,
              borderColor: "rgba(239, 68, 68, 0.2)",
              gap: 8,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <LogOut size={18} color="#EF4444" />
          <Text
            style={{
              fontFamily: "WorkSans_600SemiBold",
              fontSize: 15,
              color: "#EF4444",
            }}
          >
            Log Out
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

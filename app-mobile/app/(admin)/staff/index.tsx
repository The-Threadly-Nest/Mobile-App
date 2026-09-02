import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowLeft, Search, Plus } from "lucide-react-native";
import Svg, { Rect, Defs, LinearGradient, Stop } from "react-native-svg";
import { useAuthStore } from "@/stores/useAuthStore";
import { API_BASE_URL } from "@/api/config";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  active: boolean;
  activeOrders: number;
}

const DEFAULT_STAFF: StaffMember[] = [
  {
    id: "s1",
    name: "Ngozi Umeh",
    email: "ngozi@adaezecouture.com",
    active: true,
    activeOrders: 3,
  },
  {
    id: "s2",
    name: "Tunde Bakare",
    email: "tunde@adaezecouture.com",
    active: true,
    activeOrders: 5,
  },
  {
    id: "s3",
    name: "Funmilayo Adeyemi",
    email: "funmi@adaezecouture.com",
    active: true,
    activeOrders: 1,
  },
];

function GradientAvatar({ initial }: { initial: string }) {
  return (
    <View style={styles.avatarWrapper}>
      <Svg width={40} height={40} viewBox="0 0 40 40" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="avatarGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#4A080C" />
            <Stop offset="100%" stopColor="#C4A763" />
          </LinearGradient>
        </Defs>
        <Rect width="40" height="40" rx="20" fill="url(#avatarGrad)" />
      </Svg>
      <Text style={styles.avatarText}>{initial}</Text>
    </View>
  );
}

function FloatingAddCircle({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.floatingCircle,
        {
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        },
      ]}
    >
      <Plus size={28} color="#FFFFFF" strokeWidth={2.5} />
    </Pressable>
  );
}

export default function StaffScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [searchQuery, setSearchQuery] = useState("");
  const [staffList, setStaffList] = useState<StaffMember[]>(DEFAULT_STAFF);
  const [fetchingStaff, setFetchingStaff] = useState(false);

  const token = useAuthStore((s) => s.token);

  const fetchStaff = async () => {
    if (!token) return;
    setFetchingStaff(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/staff`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data) && data.length > 0) {
        const mapped: StaffMember[] = data.map((st: any, idx: number) => {
          const emailName = st.email ? st.email.split("@")[0] : "Staff";
          const formattedName = st.name || emailName.charAt(0).toUpperCase() + emailName.slice(1);
          return {
            id: st.id,
            name: formattedName,
            email: st.email,
            active: st.active ?? true,
            activeOrders: (idx * 2 + 1) % 6,
          };
        });
        setStaffList(mapped);
      }
    } catch (e) {
      console.warn("Failed to fetch staff list", e);
    } finally {
      setFetchingStaff(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, [token]);

  const filteredStaff = staffList.filter(
    (st) =>
      st.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      st.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={[styles.container, isLandscape && styles.containerLandscape]}>
        {/* Header Row */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.push("/(admin)/settings" as any)}
            style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <ArrowLeft size={18} color="#3B0508" />
          </Pressable>

          <Text style={styles.headerTitle}>Staff</Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Search size={20} color="#7A7265" style={{ marginRight: 12 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search staff members..."
            placeholderTextColor="#8A7550"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>

        {/* Staff List */}
        {fetchingStaff && staffList.length === 0 ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator color="#4A080C" size="large" />
          </View>
        ) : (
          <FlatList
            data={filteredStaff}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const initial = (item.name || "S").charAt(0).toUpperCase();

              return (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/(admin)/staff/[staffId]/moodboard",
                      params: { staffId: item.id, staffName: item.name },
                    })
                  }
                  style={({ pressed }) => [
                    styles.card,
                    { opacity: pressed ? 0.94 : 1 },
                  ]}
                >
                  {/* Linear Gradient Avatar */}
                  <GradientAvatar initial={initial} />

                  {/* Text Column */}
                  <View style={styles.detailsContainer}>
                    <Text style={styles.staffName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.staffEmail} numberOfLines={1}>{item.email}</Text>
                    <Text style={styles.ordersText}>
                      {item.activeOrders} active {item.activeOrders === 1 ? "order" : "orders"}
                    </Text>
                  </View>

                  {/* Active Status Pill */}
                  <View
                    style={[
                      styles.badge,
                      item.active ? styles.badgeActive : styles.badgePending,
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        item.active ? styles.badgeTextActive : styles.badgeTextPending,
                      ]}
                    >
                      {item.active ? "Active" : "Pending"}
                    </Text>
                  </View>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No staff members matching "{searchQuery}"</Text>
              </View>
            }
          />
        )}

        {/* 56x56 Floating Gold Action Circle at bottom right */}
        <FloatingAddCircle
          onPress={() => router.push("/(admin)/staff/invite" as any)}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FBF7EF",
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    position: "relative",
  },
  containerLandscape: {
    maxWidth: 680,
    alignSelf: "center",
    width: "100%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(74, 8, 12, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  headerTitle: {
    fontFamily: "Fraunces-Bold",
    fontSize: 24,
    lineHeight: 28,
    color: "#1A1110",
    letterSpacing: -0.2,
  },
  searchBar: {
    height: 54,
    borderRadius: 27,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(74, 8, 12, 0.25)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    fontFamily: "WorkSans_400Regular",
    fontSize: 15,
    color: "#1A1110",
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingBottom: 96,
  },
  card: {
    width: "100%",
    maxWidth: 376,
    height: 114,
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 24,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  avatarWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  avatarText: {
    fontFamily: "Fraunces-Bold",
    fontSize: 17,
    color: "#FFFFFF",
  },
  detailsContainer: {
    flex: 1,
    paddingRight: 8,
  },
  staffName: {
    fontFamily: "WorkSans_500Medium",
    fontSize: 16,
    color: "#000000",
    marginBottom: 2,
  },
  staffEmail: {
    fontFamily: "WorkSans_300Light",
    fontSize: 12,
    color: "#404040",
    marginBottom: 2,
  },
  ordersText: {
    fontFamily: "WorkSans_300Light",
    fontSize: 12,
    color: "#404040",
  },
  badge: {
    width: 53,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  badgeActive: {
    backgroundColor: "rgba(67, 160, 71, 0.25)",
  },
  badgePending: {
    backgroundColor: "rgba(220, 38, 38, 0.2)",
  },
  badgeText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 11.5,
  },
  badgeTextActive: {
    color: "#43A047",
  },
  badgeTextPending: {
    color: "#DC2626",
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyText: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 14,
    color: "#8A7550",
  },
  floatingCircle: {
    position: "absolute",
    bottom: 32,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#4A080C",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#4A080C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
});

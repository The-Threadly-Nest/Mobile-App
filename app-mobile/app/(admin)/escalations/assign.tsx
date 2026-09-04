import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { DollarSign, Ruler, Scissors } from "lucide-react-native";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import { useAppAlert } from "@/shared/hooks/useAppAlert";
import { useAuthStore } from "@/stores/useAuthStore";
import { API_BASE_URL } from "@/api/config";

interface TailorOption {
  id: string;
  name: string;
  activeOrders: number;
}

const DEFAULT_TAILORS: TailorOption[] = [
  { id: "t1", name: "Ngozi Umeh", activeOrders: 3 },
  { id: "t2", name: "Tunde Bakare", activeOrders: 5 },
  { id: "t3", name: "Funmilayo Adeyemi", activeOrders: 1 },
];

export default function AssignStaffScreen() {
  const params = useLocalSearchParams<{
    bookingId?: string;
    customerName?: string;
    serviceTitle?: string;
    appointmentTime?: string;
  }>();

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { showAlert } = useAppAlert();
  const token = useAuthStore((s) => s.token);

  const customerName = params.customerName || "Chiamaka O.";
  const serviceTitle = params.serviceTitle || "Bridal Aso-Ebi";
  const appointmentTime = params.appointmentTime || "Sat, Sept 6";

  const [tailors, setTailors] = useState<TailorOption[]>(DEFAULT_TAILORS);
  const [selectedTailorId, setSelectedTailorId] = useState<string>("t1");
  const [loadingStaff, setLoadingStaff] = useState<boolean>(true);

  // Garment Title, Price & Measurement Inputs
  const [serviceTitleInput, setServiceTitleInput] = useState<string>(
    params.serviceTitle || "Bespoke Fitting"
  );
  const [priceInput, setPriceInput] = useState<string>("");
  const [bust, setBust] = useState<string>("");
  const [waist, setWaist] = useState<string>("");
  const [hip, setHip] = useState<string>("");
  const [length, setLength] = useState<string>("");

  useEffect(() => {
    (async () => {
      if (!token) {
        setLoadingStaff(false);
        return;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/api/staff`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const mapped: TailorOption[] = data.map((st: any) => {
              const rawName = st.name ? st.name.trim() : "";
              const emailParts = st.email ? st.email.split("@")[0].split(/[._-]/) : ["Staff"];
              const fallbackName = emailParts.map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
              return {
                id: st.id,
                name: rawName || fallbackName,
                activeOrders: typeof st.activeOrders === "number" ? st.activeOrders : 0,
              };
            });
            setTailors(mapped);
            setSelectedTailorId(mapped[0].id);
          }
        }
      } catch {
        // Silent fallback
      } finally {
        setLoadingStaff(false);
      }
    })();
  }, [token]);

  const handleConfirm = async () => {
    const tailor = tailors.find((t) => t.id === selectedTailorId) || tailors[0];
    const cleanedPrice = Number(priceInput.replace(/[^0-9]/g, "")) || 0;

    try {
      if (token) {
        const res = await fetch(`${API_BASE_URL}/api/escalations/assign`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            bookingId: params.bookingId,
            staffId: tailor.id,
            serviceTitle: serviceTitleInput.trim() || serviceTitle,
            customerName,
            price: cleanedPrice,
          }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          // Server returns { error: { status, code, message } } or { error: "string" }
          const errField = (errBody as any)?.error;
          const raw =
            (typeof errField === "object" ? errField?.message : errField) ??
            (errBody as any)?.message ??
            "";
          const errMsg =
            typeof raw === "string" && raw.length > 0
              ? raw
              : `Server error ${res.status}. Please try again.`;
          showAlert("Assignment Failed", errMsg);
          return;
        }
      }
    } catch {
      showAlert("Network Error", "Could not reach the server. Please check your connection.");
      return;
    }

    showAlert("Assignment Confirmed", `${customerName}'s fitting has been successfully assigned to ${tailor.name}.`);
    setTimeout(() => {
      router.replace("/(admin)/dashboard" as any);
    }, 1200);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={[styles.container, isLandscape && styles.containerLandscape]}>
        {/* Header Row */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.push("/(admin)/escalations" as any)}
            style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <BackArrowIcon size={18} color="#3B0508" />
          </Pressable>
          <Text style={styles.headerTitle}>Assign Staff</Text>
        </View>

        {/* Subtitle Details */}
        <Text style={styles.subtitle} numberOfLines={1}>
          {customerName}  •  {serviceTitleInput || serviceTitle}  •  {appointmentTime}
        </Text>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Garment / Service Title Section */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Scissors size={18} color="#4A080C" />
              <Text style={styles.sectionTitle}>Garment / Item Name</Text>
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.priceInput}
                value={serviceTitleInput}
                onChangeText={setServiceTitleInput}
                placeholder="e.g. Aso-Ebi (2 pcs), Senator Kaftan"
                placeholderTextColor="#8A7550"
              />
            </View>
          </View>

          {/* Order Details & Pricing Section */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <DollarSign size={18} color="#4A080C" />
              <Text style={styles.sectionTitle}>Agreed Order Price (Optional)</Text>
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.currencyPrefix}>₦</Text>
              <TextInput
                style={styles.priceInput}
                value={priceInput}
                onChangeText={setPriceInput}
                keyboardType="numeric"
                placeholder="e.g. 250,000"
                placeholderTextColor="#8A7550"
              />
            </View>
          </View>

          {/* Tailor Selection Title */}
          <Text style={styles.selectTailorHeadline}>Assign Tailor / Stylist</Text>

          {/* Staff List */}
          {loadingStaff ? (
            <ActivityIndicator size="small" color="#4A080C" style={{ marginVertical: 24 }} />
          ) : (
            tailors.map((tailor) => {
              const isSelected = tailor.id === selectedTailorId;
              const initial = tailor.name.charAt(0).toUpperCase();

              return (
                <Pressable
                  key={tailor.id}
                  onPress={() => setSelectedTailorId(tailor.id)}
                  style={({ pressed }) => [
                    styles.card,
                    isSelected ? styles.cardSelected : styles.cardUnselected,
                    { opacity: pressed ? 0.9 : 1 },
                  ]}
                >
                  {/* Initial Avatar */}
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initial}</Text>
                  </View>

                  {/* Tailor Name */}
                  <Text style={styles.tailorName}>{tailor.name}</Text>

                  {/* Active Orders Subtitle */}
                  <Text style={styles.ordersCount}>
                    {tailor.activeOrders} {tailor.activeOrders === 1 ? "active order" : "active orders"}
                  </Text>
                </Pressable>
              );
            })
          )}
        </ScrollView>

        {/* Bottom Pinned Action Button */}
        <View style={styles.bottomBar}>
          <Pressable
            onPress={handleConfirm}
            style={({ pressed }) => [
              styles.confirmBtn,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.confirmBtnText}>Confirm Assignment</Text>
          </Pressable>
        </View>
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
    color: "#1A1110",
  },
  subtitle: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 14,
    color: "#7A7265",
    marginBottom: 20,
    paddingHorizontal: 2,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(74, 8, 12, 0.12)",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: "Fraunces-Bold",
    fontSize: 16,
    color: "#4A080C",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FBF7EF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(74, 8, 12, 0.2)",
    paddingHorizontal: 14,
    height: 48,
  },
  currencyPrefix: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#4A080C",
    marginRight: 6,
  },
  priceInput: {
    flex: 1,
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#1A1110",
  },
  measurementsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  measItem: {
    flex: 1,
  },
  measLabel: {
    fontFamily: "WorkSans_500Medium",
    fontSize: 12,
    color: "#7A7265",
    marginBottom: 4,
  },
  measInput: {
    backgroundColor: "#FBF7EF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(74, 8, 12, 0.2)",
    height: 44,
    paddingHorizontal: 10,
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 14,
    color: "#1A1110",
    textAlign: "center",
  },
  selectTailorHeadline: {
    fontFamily: "Fraunces-Bold",
    fontSize: 18,
    color: "#4A080C",
    marginTop: 4,
    marginBottom: 14,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    height: 76,
    borderRadius: 24,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  cardSelected: {
    backgroundColor: "#DDE1DA",
    borderColor: "rgba(74, 8, 12, 0.5)",
  },
  cardUnselected: {
    backgroundColor: "#FFFFFF",
    borderColor: "rgba(74, 8, 12, 0.15)",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#4A080C",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  avatarText: {
    fontFamily: "Fraunces-Bold",
    fontSize: 18,
    color: "#FFFFFF",
  },
  tailorName: {
    flex: 1,
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#1A1110",
  },
  ordersCount: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 13,
    color: "#7A7265",
  },
  bottomBar: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  confirmBtn: {
    width: "100%",
    maxWidth: 380,
    alignSelf: "center",
    height: 58,
    borderRadius: 29,
    backgroundColor: "#4A080C",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
});

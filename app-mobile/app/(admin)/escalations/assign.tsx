import { typeScale } from "@/shared/utils/typeScale";
import React, { useState, useEffect } from "react";
import { View, Pressable, ScrollView, StyleSheet, useWindowDimensions, ActivityIndicator } from "react-native";
import { Text, TextInput } from "@/shared/components/Typography";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { DollarSign, Ruler, Scissors } from "lucide-react-native";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import { useAppAlert } from "@/shared/hooks/useAppAlert";
import { useAuthStore } from "@/stores/useAuthStore";
import { apiFetch, staffApi } from "@/shared/utils/apiClient";
import { isReadyToWear } from "@/shared/utils/orderFulfillment";

interface TailorOption {
  id: string;
  name: string;
  activeOrders: number;
}

export default function AssignStaffScreen() {
  const params = useLocalSearchParams<{
    bookingId?: string;
    orderId?: string;
    fulfillmentType?: string;
    customerName?: string;
    serviceTitle?: string;
    appointmentTime?: string;
  }>();

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { showAlert } = useAppAlert();
  const token = useAuthStore((s) => s.token);

  const customerName = params.customerName || "Customer";
  const serviceTitle = params.serviceTitle || "Bespoke Fitting";
  const appointmentTime = params.appointmentTime || "Appointment time unavailable";
  const readyToWear = isReadyToWear(params);

  const [tailors, setTailors] = useState<TailorOption[]>([]);
  const [selectedTailorId, setSelectedTailorId] = useState<string>("");
  const [loadingStaff, setLoadingStaff] = useState<boolean>(true);

  // Garment Title, Price & Measurement Inputs
  const [serviceTitleInput, setServiceTitleInput] = useState<string>(
    params.serviceTitle || "Bespoke Fitting"
  );
  const [priceInput, setPriceInput] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const savingRef = React.useRef(false);

  useEffect(() => {
    (async () => {
      if (!token) {
        setLoadingStaff(false);
        return;
      }
      try {
        const data = await staffApi.getStaff();
        if (Array.isArray(data) && data.length > 0) {
          const mapped: TailorOption[] = data.filter((st: any) => st.active === true).map((st: any) => {
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
          setSelectedTailorId(mapped[0]?.id || "");
        }
      } catch {
        // Silent fallback
      } finally {
        setLoadingStaff(false);
      }
    })();
  }, [token]);

  const handleConfirm = async () => {
    if (savingRef.current) return;
    if (!token) { showAlert("Sign in required", "Please sign in again before assigning staff."); return; }
    const tailor = tailors.find((t) => t.id === selectedTailorId) || tailors[0];
    if (!tailor) {
      showAlert("No Staff Available", "Add an active staff member before assigning this booking.");
      return;
    }
    const cleanedPrice = Number(priceInput.replace(/[^0-9]/g, "")) || 0;
    savingRef.current = true;
    setSaving(true);
    try {
      if (params.orderId) {
        await apiFetch(`/api/orders/${encodeURIComponent(params.orderId)}/assign`, {
          method: "PATCH", body: JSON.stringify({ staffId: tailor.id }),
        });
      } else {
        await apiFetch("/api/escalations/assign", {
          method: "POST",
          body: JSON.stringify({
            bookingId: params.bookingId,
            staffId: tailor.id,
            serviceTitle: serviceTitleInput.trim() || serviceTitle,
            customerName,
            price: cleanedPrice,
          }),
        });
      }
    } catch (error) {
      showAlert("Couldn't assign staff", error instanceof Error ? error.message : "Please try again.");
      return;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }

    showAlert("Assignment Confirmed", `${customerName}'s ${readyToWear ? "order" : "fitting"} has been successfully assigned to ${tailor.name}.`);
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
            style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 , width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: 0, }]}
          >
            <BackArrowIcon size={24} color="#453332" />
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
              <Scissors size={18} color="#453332" />
              <Text style={styles.sectionTitle}>Garment / Item Name</Text>
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.priceInput}
                editable={!params.orderId}
                value={serviceTitleInput}
                onChangeText={setServiceTitleInput}
                placeholder="e.g. Aso-Ebi (2 pcs), Senator Kaftan"
                placeholderTextColor="#453332"
              />
            </View>
          </View>

          {/* Existing orders retain their checkout price during assignment. */}
          {!params.orderId && <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <DollarSign size={18} color="#453332" />
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
                placeholderTextColor="#453332"
              />
            </View>
          </View>}
          {readyToWear ? <Text style={styles.subtitle}>Standard-size order. Custom measurements are not required.</Text> : null}
          {/* Tailor Selection Title */}
          <Text style={styles.selectTailorHeadline}>Assign Tailor / Stylist</Text>

          {/* Staff List */}
          {!loadingStaff && !tailors.length ? <View style={styles.sectionCard}><Text style={styles.subtitle}>No activated staff are available. Invite a staff member and wait for them to activate before assigning.</Text><Pressable onPress={() => router.push("/(admin)/staff/invite")}><Text style={{ color: "#F96951", fontFamily: "InstrumentSans-SemiBold" }}>Invite staff</Text></Pressable></View> : null}
          {loadingStaff ? (
            <ActivityIndicator size="small" color="#453332" style={{ marginVertical: 24 }} />
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
            disabled={saving || loadingStaff || !tailors.length}
            style={({ pressed }) => [
              styles.confirmBtn,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.confirmBtnText}>{saving ? "Assigning…" : "Confirm Assignment"}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 36,
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
  gap: 8, },
  backBtn: {
    width: 44,
    height: 44,



    alignItems: "center",
    justifyContent: "center",
    marginRight: 0,
  },
  headerTitle: {
    ...typeScale.pageTitle,
    color: "#4A403B",
  },
  subtitle: {
    ...typeScale.caption,
    color: "#4A403B",
    marginBottom: 20,
    paddingHorizontal: 2,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  sectionCard: {
    backgroundColor: "#F9E8D3",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(69, 51, 50, 0.12)",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    ...typeScale.sectionTitle,
    color: "#4A403B",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(69, 51, 50, 0.2)",
    paddingHorizontal: 14,
    height: 48,
  },
  currencyPrefix: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 16,
    color: "#4A403B",
    marginRight: 6,
  },
  priceInput: {
    flex: 1,
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 16,
    color: "#4A403B",
  },
  measurementsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  measItem: {
    flex: 1,
  },
  measLabel: {
    fontFamily: "InstrumentSans-Medium",
    fontSize: 12,
    color: "#4A403B",
    marginBottom: 4,
  },
  measInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(69, 51, 50, 0.2)",
    height: 44,
    paddingHorizontal: 10,
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 14,
    color: "#4A403B",
    textAlign: "center",
  },
  selectTailorHeadline: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 18,
    color: "#4A403B",
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
    backgroundColor: "#F9E8D3",
    borderColor: "rgba(69, 51, 50, 0.5)",
  },
  cardUnselected: {
    backgroundColor: "#F9E8D3",
    borderColor: "rgba(69, 51, 50, 0.15)",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#453332",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  avatarText: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 18,
    color: "#FFFDF9",
  },
  tailorName: {
    flex: 1,
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 16,
    color: "#4A403B",
  },
  ordersCount: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 13,
    color: "#4A403B",
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
    backgroundColor: "#F96951",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnText: {
    ...typeScale.button,
    color: "#FFFDF9",
    letterSpacing: 0.2,
  },
});

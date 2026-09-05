import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
  StyleSheet,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Info, Check, ArrowRight } from "lucide-react-native";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import { useAuthStore } from "@/stores/useAuthStore";
import { API_BASE_URL } from "@/api/config";
import { useAppAlert } from "@/shared/hooks/useAppAlert";

interface StageItem {
  key: string;
  label: string;
}

const STAGES: StageItem[] = [
  { key: "booked", label: "Booked" },
  { key: "measurements_confirmed", label: "Measurements Confirmed" },
  { key: "fabric_sourced", label: "Fabric Sourced" },
  { key: "in_production", label: "In Production" },
  { key: "quality_check", label: "Quality Check" },
  { key: "ready_for_pickup", label: "Ready for Pickup" },
  { key: "completed", label: "Completed" },
];

export default function UpdateProgressScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { showAlert } = useAppAlert();
  const token = useAuthStore((s) => s.token);

  const params = useLocalSearchParams<{
    orderId?: string;
    customerName?: string;
    orderNumber?: string;
    garmentDetails?: string;
    dueDate?: string;
    initialStage?: string;
  }>();

  const orderId = params.orderId || "1";
  const customerName = params.customerName || "Chiamaka O.";
  const orderNumber = params.orderNumber || "#TFH-2291";
  const garmentDetails = params.garmentDetails || "Aso-Ebi (2 pcs)";
  const dueDate = params.dueDate || "Due Sep 27";

  const [activeStageKey, setActiveStageKey] = useState<string>(
    params.initialStage || "in_production"
  );
  const [updateNote, setUpdateNote] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  const initial = customerName.charAt(0).toUpperCase();
  const activeIndex = STAGES.findIndex((s) => s.key === activeStageKey);

  const handleUpdateStatus = async () => {
    setSubmitting(true);
    try {
      if (token && orderId) {
        const res = await fetch(`${API_BASE_URL}/api/orders/${orderId}/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status: activeStageKey,
            note: updateNote.trim(),
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const message = body?.error || "Could not update order status. Please try again.";
          showAlert("Update Failed", message);
          return;
        }
      }

      const activeStageLabel = STAGES.find((s) => s.key === activeStageKey)?.label;
      showAlert(
        "Progress Updated",
        `Order ${orderNumber} has been updated to "${activeStageLabel}".`
      );

      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/(staff)/dashboard");
      }
    } catch {
      showAlert(
        "Connection Error",
        "Could not reach the server. Please check your connection and try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/(staff)/dashboard");
          }}
          style={({ pressed }) => [styles.headerBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <BackArrowIcon size={20} color="#4A080C" />
        </Pressable>

        <Text style={styles.headerTitleText}>Update Progress</Text>

        <Pressable style={({ pressed }) => [styles.headerBtn, { opacity: pressed ? 0.7 : 1 }]}>
          <Info size={18} color="#4A080C" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 100 + insets.bottom },
          isLandscape && styles.scrollContentLandscape,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Order Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.summaryCol}>
            <Text style={styles.customerNameText}>
              {customerName} <Text style={styles.orderNumberText}>· {orderNumber}</Text>
            </Text>
            <Text style={styles.garmentSubtext}>
              {garmentDetails} · {dueDate}
            </Text>
          </View>
        </View>

        {/* Order Stages Vertical Stepper */}
        <View style={styles.stagesCard}>
          <Text style={styles.stagesHeadline}>Order Stages</Text>

          <View style={styles.stepperContainer}>
            {STAGES.map((stage, idx) => {
              const isCompleted = idx < activeIndex;
              const isActive = idx === activeIndex;
              const isLast = idx === STAGES.length - 1;

              return (
                <Pressable
                  key={stage.key}
                  onPress={() => setActiveStageKey(stage.key)}
                  style={styles.stepRow}
                >
                  {/* Node & Line Column */}
                  <View style={styles.nodeColumn}>
                    {/* Node Icon */}
                    {isCompleted ? (
                      <View style={styles.completedNode}>
                        <Check size={11} color="#FFFFFF" strokeWidth={3} />
                      </View>
                    ) : isActive ? (
                      <View style={styles.activeNodeRing}>
                        <View style={styles.activeNodeDot} />
                      </View>
                    ) : (
                      <View style={styles.upcomingNode} />
                    )}

                    {/* Vertical Connector Line */}
                    {!isLast && (
                      <View
                        style={[
                          styles.connectorLine,
                          idx < activeIndex ? styles.completedLine : styles.upcomingLine,
                        ]}
                      />
                    )}
                  </View>

                  {/* Label & Description Column */}
                  <View style={styles.labelColumn}>
                    <Text
                      style={[
                        styles.stepLabelText,
                        isCompleted && styles.completedLabelText,
                        isActive && styles.activeLabelText,
                        !isCompleted && !isActive && styles.upcomingLabelText,
                      ]}
                    >
                      {stage.label}
                    </Text>

                    {isActive && (
                      <Text style={styles.activeSubtext}>
                        Active stage on atelier floor
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Update Note Input */}
        <View style={styles.noteSection}>
          <Text style={styles.noteLabelText}>Update Note</Text>
          <TextInput
            style={styles.noteInput}
            value={updateNote}
            onChangeText={setUpdateNote}
            placeholder="Add a note about this update..."
            placeholderTextColor="#8A7550"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Submit Action Button */}
        <Pressable
          onPress={handleUpdateStatus}
          disabled={submitting}
          style={({ pressed }) => [
            styles.submitBtn,
            { opacity: pressed || submitting ? 0.85 : 1 },
          ]}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Text style={styles.submitBtnText}>Update Status</Text>
              <ArrowRight size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
            </>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FBF7EF",
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#FBF7EF",
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E4D5B7",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleText: {
    fontFamily: "Fraunces-Bold",
    fontSize: 22,
    color: "#4A080C",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
  },
  scrollContentLandscape: {
    maxWidth: 680,
    alignSelf: "center",
    width: "100%",
  },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(228, 213, 183, 0.5)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#4A080C",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: "Fraunces-Bold",
    fontSize: 18,
    color: "#FFFFFF",
  },
  summaryCol: {
    flex: 1,
  },
  customerNameText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#3A2E1A",
    marginBottom: 2,
  },
  orderNumberText: {
    fontFamily: "WorkSans_500Medium",
    color: "#3A2E1A",
  },
  garmentSubtext: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 12,
    color: "#8A7550",
  },
  stagesCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(228, 213, 183, 0.5)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  stagesHeadline: {
    fontFamily: "Fraunces-Bold",
    fontSize: 18,
    color: "#4A080C",
    marginBottom: 16,
  },
  stepperContainer: {
    paddingLeft: 4,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  nodeColumn: {
    alignItems: "center",
    width: 28,
    marginRight: 12,
  },
  completedNode: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#4A080C",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  activeNodeRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#4A080C",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  activeNodeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#4A080C",
  },
  upcomingNode: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#E4D5B7",
    zIndex: 1,
  },
  connectorLine: {
    width: 2,
    height: 38,
    marginTop: -2,
    marginBottom: -2,
  },
  completedLine: {
    backgroundColor: "#4A080C",
  },
  upcomingLine: {
    backgroundColor: "#E4D5B7",
  },
  labelColumn: {
    flex: 1,
    paddingTop: 1,
    paddingBottom: 16,
  },
  stepLabelText: {
    fontSize: 15,
  },
  completedLabelText: {
    fontFamily: "WorkSans_600SemiBold",
    color: "#3A2E1A",
  },
  activeLabelText: {
    fontFamily: "WorkSans_600SemiBold",
    color: "#4A080C",
  },
  upcomingLabelText: {
    fontFamily: "WorkSans_400Regular",
    color: "#8A7550",
  },
  activeSubtext: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 12,
    color: "#8A7550",
    marginTop: 2,
  },
  noteSection: {
    marginBottom: 24,
  },
  noteLabelText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 13,
    color: "#3A2E1A",
    marginBottom: 8,
  },
  noteInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E4D5B7",
    padding: 14,
    fontFamily: "WorkSans_400Regular",
    fontSize: 14,
    color: "#3A2E1A",
    height: 96,
  },
  submitBtn: {
    width: "100%",
    height: 54,
    borderRadius: 27,
    backgroundColor: "#4A080C",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
});

import React, { useState } from "react";
import { View, ScrollView, Pressable, ActivityIndicator, useWindowDimensions, StyleSheet } from "react-native";
import { Text, TextInput } from "@/shared/components/Typography";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Info, Check, ArrowRight } from "lucide-react-native";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import { useAuthStore } from "@/stores/useAuthStore";
import { apiFetch } from "@/shared/utils/apiClient";
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

  const orderId = params.orderId || "";
  const customerName = params.customerName || "Customer";
  const orderNumber = params.orderNumber || "";
  const garmentDetails = params.garmentDetails || "Custom garment";
  const dueDate = params.dueDate || "";

  const [activeStageKey, setActiveStageKey] = useState<string>(
    params.initialStage || "in_production"
  );
  const [updateNote, setUpdateNote] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  const initial = customerName.charAt(0).toUpperCase();
  const activeIndex = STAGES.findIndex((s) => s.key === activeStageKey);

  const handleUpdateStatus = async () => {
    if (!token || !orderId || submitting) { showAlert("Order unavailable", "Please reopen your assigned order before updating it."); return; }
    setSubmitting(true);
    try {
      if (token && orderId) {
        await apiFetch(`/api/orders/${orderId}/status`, {
          method: "PATCH",
          body: JSON.stringify({
            status: activeStageKey,
            note: updateNote.trim(),
          }),
        });
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
          <BackArrowIcon size={24} color="#453332" />
        </Pressable>

        <Text style={styles.headerTitleText}>Update Progress</Text>

        <Pressable style={({ pressed }) => [styles.headerBtn, { opacity: pressed ? 0.7 : 1 }]}>
          <Info size={18} color="#453332" />
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
                        <Check size={11} color="#FFFDF9" strokeWidth={3} />
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
            placeholderTextColor="#453332"
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
            <ActivityIndicator color="#FFFDF9" size="small" />
          ) : (
            <>
              <Text style={styles.submitBtnText}>Update Status</Text>
              <ArrowRight size={18} color="#FFFDF9" style={{ marginLeft: 8 }} />
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
    backgroundColor: "#FFFFFF",
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
  },
  headerBtn: {
    width: 40,
    height: 40,
    
    
    
    
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleText: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 22,
    color: "#4A403B",
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
    backgroundColor: "#FFFDF9",
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(69, 51, 50, 0.5)",
    shadowColor: "#2B2B2B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#453332",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 18,
    color: "#FFFDF9",
  },
  summaryCol: {
    flex: 1,
  },
  customerNameText: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 16,
    color: "#4A403B",
    marginBottom: 2,
  },
  orderNumberText: {
    fontFamily: "InstrumentSans-Medium",
    color: "#4A403B",
  },
  garmentSubtext: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 12,
    color: "#4A403B",
  },
  stagesCard: {
    backgroundColor: "#FFFDF9",
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(69, 51, 50, 0.5)",
    shadowColor: "#2B2B2B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  stagesHeadline: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 18,
    color: "#4A403B",
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
    backgroundColor: "#453332",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  activeNodeRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#453332",
    backgroundColor: "#F9E8D3",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  activeNodeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#453332",
  },
  upcomingNode: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#F9E8D3",
    zIndex: 1,
  },
  connectorLine: {
    width: 2,
    height: 38,
    marginTop: -2,
    marginBottom: -2,
  },
  completedLine: {
    backgroundColor: "#453332",
  },
  upcomingLine: {
    backgroundColor: "#FFFDF9",
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
    fontFamily: "InstrumentSans-SemiBold",
    color: "#4A403B",
  },
  activeLabelText: {
    fontFamily: "InstrumentSans-SemiBold",
    color: "#4A403B",
  },
  upcomingLabelText: {
    fontFamily: "InstrumentSans-Regular",
    color: "#4A403B",
  },
  activeSubtext: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 12,
    color: "#4A403B",
    marginTop: 2,
  },
  noteSection: {
    marginBottom: 24,
  },
  noteLabelText: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 13,
    color: "#4A403B",
    marginBottom: 8,
  },
  noteInput: {
    backgroundColor: "#FFFDF9",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#453332",
    padding: 14,
    fontFamily: "InstrumentSans-Regular",
    fontSize: 14,
    color: "#4A403B",
    height: 96,
  },
  submitBtn: {
    width: "100%",
    height: 54,
    borderRadius: 27,
    backgroundColor: "#F96951",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnText: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 16,
    color: "#FFFDF9",
    letterSpacing: 0.2,
  },
});

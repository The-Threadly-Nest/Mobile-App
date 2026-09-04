import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Sparkles, Info, CheckCircle2, ChevronRight, X } from "lucide-react-native";

interface FlowMessageCardProps {
  stepBadge?: string;
  title: string;
  message?: string;
  steps?: string[];
  icon?: "sparkles" | "info" | "check";
  primaryButtonLabel?: string;
  onPrimaryPress?: () => void;
  secondaryButtonLabel?: string;
  onSecondaryPress?: () => void;
  onDismiss?: () => void;
  onClose?: () => void;
}

export default function FlowMessageCard({
  stepBadge,
  title,
  message,
  steps,
  icon = "sparkles",
  primaryButtonLabel,
  onPrimaryPress,
  secondaryButtonLabel,
  onSecondaryPress,
  onDismiss,
  onClose,
}: FlowMessageCardProps) {
  const IconComponent = icon === "sparkles" ? Sparkles : icon === "check" ? CheckCircle2 : Info;
  const dismissHandler = onDismiss || onClose;

  return (
    <View style={styles.cardContainer}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <View style={styles.iconCircle}>
            <IconComponent size={13} color="#C4A763" />
          </View>
          {stepBadge && <Text style={styles.badgeText}>{stepBadge}</Text>}
          <Text style={styles.titleText}>{title}</Text>
        </View>

        {dismissHandler && (
          <Pressable onPress={dismissHandler} style={styles.dismissBtn} hitSlop={8}>
            <X size={14} color="#8A7550" />
          </Pressable>
        )}
      </View>

      {/* Message Body */}
      {message ? <Text style={styles.messageText}>{message}</Text> : null}

      {/* Vertical Steps List (1, 2, 3) */}
      {steps && steps.length > 0 && (
        <View style={styles.stepsContainer}>
          {steps.map((step, idx) => (
            <View key={idx} style={styles.stepItemRow}>
              <View style={styles.stepNumberBadge}>
                <Text style={styles.stepNumberText}>{idx + 1}</Text>
              </View>
              <Text style={styles.stepItemText}>{step}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Action Buttons Row */}
      {(primaryButtonLabel || secondaryButtonLabel) && (
        <View style={styles.buttonRow}>
          {secondaryButtonLabel && (
            <Pressable onPress={onSecondaryPress} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>{secondaryButtonLabel}</Text>
            </Pressable>
          )}

          {primaryButtonLabel && (
            <Pressable onPress={onPrimaryPress} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>{primaryButtonLabel}</Text>
              <ChevronRight size={13} color="#FFFFFF" />
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: "#FBF7EF",
    borderColor: "#E4D5B7",
    borderWidth: 1.5,
    borderRadius: 20,
    borderTopLeftRadius: 6, // Chat-bubble shape
    padding: 16,
    marginVertical: 4,
    shadowColor: "#4A080C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#4A080C",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 10,
    color: "#C4A763",
    backgroundColor: "#4A080C",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: "hidden",
  },
  titleText: {
    fontFamily: "Fraunces-Bold",
    fontSize: 15,
    color: "#4A080C",
    flex: 1,
  },
  dismissBtn: {
    padding: 4,
  },
  messageText: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 13,
    lineHeight: 18,
    color: "#3A2E1A",
    marginBottom: 8,
  },
  stepsContainer: {
    gap: 8,
    marginVertical: 4,
  },
  stepItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepNumberBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#4A080C",
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 11,
    color: "#FFFFFF",
  },
  stepItemText: {
    fontFamily: "WorkSans_500Medium",
    fontSize: 13,
    color: "#3A2E1A",
    flex: 1,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  secondaryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  secondaryBtnText: {
    fontFamily: "WorkSans_500Medium",
    fontSize: 12,
    color: "#8A7550",
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4A080C",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  primaryBtnText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 12,
    color: "#FFFFFF",
  },
});

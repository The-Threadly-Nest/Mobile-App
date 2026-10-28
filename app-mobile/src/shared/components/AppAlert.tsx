import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  Animated,
  StyleSheet,
} from "react-native";
import { ShoppingBag } from "lucide-react-native";
import { alertEmitter, AlertPayload } from "@/shared/utils/alertEmitter";

/**
 * AppAlert — Global branded alert modal.
 *
 * Mount exactly ONCE near the root of the app (e.g. in the root _layout.tsx).
 * It listens to alertEmitter so any screen or utility can trigger it.
 *
 * Supports:
 *   - Simple dismissal:  emit({ title, message })
 *   - Confirm/Cancel:    emit({ title, message, confirmLabel, cancelLabel, onConfirm, onCancel })
 */
export default function AppAlert() {
  const [visible, setVisible] = useState(false);
  const [payload, setPayload] = useState<AlertPayload>({ title: "", message: "" });
  const anim = useRef(new Animated.Value(0)).current;

  const open = useCallback((p: AlertPayload) => {
    setPayload(p);
    setVisible(true);
    anim.setValue(0);
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 62,
      friction: 10,
    }).start();
  }, [anim]);

  const closingRef = useRef(false);

  const close = useCallback((cb?: () => void | Promise<void>) => {
    if (closingRef.current) return;
    closingRef.current = true;
    Animated.timing(anim, { toValue: 0, duration: 170, useNativeDriver: true }).start(() => {
      setVisible(false);
      closingRef.current = false;
      if (cb) {
        Promise.resolve(cb()).catch((error) => {
          console.error("Alert action failed", error);
        });
      }
    });
  }, [anim]);

  useEffect(() => {
    const unsub = alertEmitter.subscribe(open);
    return unsub;
  }, [open]);

  const isConfirm = !!(payload.onConfirm || payload.confirmLabel);
  const isCartAlert = payload.variant === "cart";

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={() => close(payload.onCancel)}>
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel="Close dialog"
          style={StyleSheet.absoluteFill}
          onPress={() => close(payload.onCancel)}
        />
        <Animated.View
          style={[
            styles.card,
            {
              opacity: anim,
              transform: [
                { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) },
              ],
            },
          ]}
        >
          {/* Oxblood accent bar */}
          <View style={styles.accent} />

          <View style={[styles.body, isCartAlert && styles.cartBody]}>
            {isCartAlert && (
              <View style={styles.cartHeading}>
                <View style={styles.cartIconCircle}>
                  <ShoppingBag size={28} color="#453332" strokeWidth={1.8} />
                </View>
                <Text style={styles.cartEyebrow}>CART UPDATED</Text>
              </View>
            )}

            <Text style={[styles.title, isCartAlert && styles.centeredText]}>{payload.title}</Text>
            <Text style={[styles.message, isCartAlert && styles.centeredText]}>{payload.message}</Text>

            <View style={[styles.actions, isConfirm && styles.actionsRow]}>
              {isConfirm && (
                <Pressable
                  style={({ pressed }) => [
                    styles.cancelBtn,
                    styles.btnEqual,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                  onPress={() => close(payload.onCancel)}
                >
                  <Text style={styles.cancelText}>{payload.cancelLabel ?? "Cancel"}</Text>
                </Pressable>
              )}
              <Pressable
                style={({ pressed }) => [
                  styles.confirmBtn,
                  isConfirm && styles.btnEqual,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
                onPress={() => close(payload.onConfirm)}
              >
                <Text style={styles.confirmText}>{payload.confirmLabel ?? "OK"}</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(20, 5, 5, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#453332",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  accent: {
    height: 6,
    backgroundColor: "#453332",
  },
  body: {
    padding: 24,
  },
  cartBody: {
    paddingTop: 22,
  },
  cartHeading: {
    alignItems: "center",
    marginBottom: 14,
  },
  cartIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3E9DE",
    borderWidth: 1,
    borderColor: "#E8D5C2",
    marginBottom: 10,
  },
  cartEyebrow: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 11,
    letterSpacing: 1.5,
    color: "#8A6252",
  },
  title: {
    fontFamily: "Fraunces-Bold",
    fontSize: 20,
    color: "#3B0508",
    marginBottom: 8,
  },
  message: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 14,
    color: "#5C4A32",
    lineHeight: 21,
    marginBottom: 24,
  },
  centeredText: {
    textAlign: "center",
  },
  actions: {
    alignItems: "flex-end",
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    width: "100%",
  },
  btnEqual: {
    flex: 1,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "rgba(74, 8, 12, 0.3)",
  },
  cancelText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 14,
    color: "#453332",
  },
  confirmBtn: {
    backgroundColor: "#453332",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
  },
  confirmText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 14,
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
});

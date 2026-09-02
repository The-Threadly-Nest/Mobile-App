import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  Animated,
  StyleSheet,
} from "react-native";
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

  const close = useCallback((cb?: () => void) => {
    Animated.timing(anim, { toValue: 0, duration: 170, useNativeDriver: true }).start(() => {
      setVisible(false);
      cb?.();
    });
  }, [anim]);

  useEffect(() => {
    const unsub = alertEmitter.subscribe(open);
    return unsub;
  }, [open]);

  const isConfirm = !!(payload.onConfirm || payload.confirmLabel);

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={() => close(payload.onCancel)}>
      <Pressable style={styles.overlay} onPress={() => close(payload.onCancel)}>
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

          <View style={styles.body}>
            <Text style={styles.title}>{payload.title}</Text>
            <Text style={styles.message}>{payload.message}</Text>

            <View style={[styles.actions, isConfirm && styles.actionsRow]}>
              {isConfirm && (
                <Pressable
                  style={({ pressed }) => [styles.cancelBtn, { opacity: pressed ? 0.7 : 1 }]}
                  onPress={() => close(payload.onCancel)}
                >
                  <Text style={styles.cancelText}>{payload.cancelLabel ?? "Cancel"}</Text>
                </Pressable>
              )}
              <Pressable
                style={({ pressed }) => [
                  styles.confirmBtn,
                  isConfirm && styles.confirmBtnFlex,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
                onPress={() => close(payload.onConfirm)}
              >
                <Text style={styles.confirmText}>{payload.confirmLabel ?? "OK"}</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </Pressable>
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
    shadowColor: "#4A080C",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  accent: {
    height: 6,
    backgroundColor: "#4A080C",
  },
  body: {
    padding: 24,
  },
  title: {
    fontFamily: "Fraunces_700Bold",
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
  actions: {
    alignItems: "flex-end",
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  cancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "rgba(74, 8, 12, 0.3)",
  },
  cancelText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 14,
    color: "#4A080C",
  },
  confirmBtn: {
    backgroundColor: "#4A080C",
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 24,
  },
  confirmBtnFlex: {
    flex: 1,
    alignItems: "center",
  },
  confirmText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 14,
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
});

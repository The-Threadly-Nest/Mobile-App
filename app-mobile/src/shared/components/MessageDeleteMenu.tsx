import React from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";

type MessageDeleteMenuProps = {
  visible: boolean;
  canDeleteForEveryone: boolean;
  busy?: boolean;
  onDeleteForEveryone: () => void;
  onDeleteForMe: () => void;
  onCancel: () => void;
};

export default function MessageDeleteMenu({
  visible,
  canDeleteForEveryone,
  busy = false,
  onDeleteForEveryone,
  onDeleteForMe,
  onCancel,
}: MessageDeleteMenuProps) {
  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <Pressable style={styles.overlay} onPress={busy ? undefined : onCancel}>
        <Pressable style={styles.menu} onPress={(event) => event.stopPropagation()}>
          <Text style={styles.title}>Delete message?</Text>

          {busy ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#4A080C" />
            </View>
          ) : (
            <View style={styles.actions}>
              {canDeleteForEveryone ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={onDeleteForEveryone}
                  style={({ pressed }) => [styles.action, pressed && styles.pressed]}
                >
                  <Text style={styles.actionText}>Delete for everyone</Text>
                </Pressable>
              ) : null}

              <Pressable
                accessibilityRole="button"
                onPress={onDeleteForMe}
                style={({ pressed }) => [styles.action, pressed && styles.pressed]}
              >
                <Text style={styles.actionText}>Delete for me</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={onCancel}
                style={({ pressed }) => [styles.action, pressed && styles.pressed]}
              >
                <Text style={styles.actionText}>Cancel</Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(58,46,26,0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  menu: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    backgroundColor: "#FBF7EF",
    paddingTop: 22,
    paddingBottom: 10,
    shadowColor: "#3A2E1A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    paddingHorizontal: 24,
    paddingBottom: 10,
    color: "#3A2E1A",
    fontFamily: "WorkSans_500Medium",
    fontSize: 16,
  },
  actions: {
    alignItems: "flex-end",
  },
  action: {
    minWidth: 220,
    paddingHorizontal: 24,
    paddingVertical: 15,
    alignItems: "flex-end",
  },
  actionText: {
    color: "#4A080C",
    fontFamily: "WorkSans_500Medium",
    fontSize: 16,
  },
  pressed: {
    backgroundColor: "rgba(228,213,183,0.45)",
  },
  loadingRow: {
    minHeight: 130,
    alignItems: "center",
    justifyContent: "center",
  },
});

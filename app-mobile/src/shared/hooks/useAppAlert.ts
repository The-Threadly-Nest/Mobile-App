import { useRef, useCallback } from "react";
import { Animated } from "react-native";
import { alertEmitter, AlertPayload } from "@/shared/utils/alertEmitter";

/**
 * useAppAlert — Hook for triggering the global AppAlert from any screen.
 *
 * Returns:
 *   showAlert(title, message)           — simple dismissible alert
 *   showConfirm(title, message, opts)   — confirm/cancel alert with callbacks
 */
export function useAppAlert() {
  const showAlert = useCallback((title: string, message: string) => {
    alertEmitter.emit({ title, message });
  }, []);

  const showConfirm = useCallback(
    (
      title: string,
      message: string,
      opts: {
        confirmLabel?: string;
        cancelLabel?: string;
        onConfirm?: () => void;
        onCancel?: () => void;
      } = {}
    ) => {
      alertEmitter.emit({ title, message, ...opts });
    },
    []
  );

  return { showAlert, showConfirm };
}

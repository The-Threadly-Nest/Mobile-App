/**
 * alertEmitter — A tiny event bus that allows non-React code (e.g. apiClient)
 * to trigger the global AppAlert modal without prop-drilling or context.
 *
 * Usage (emit):
 *   alertEmitter.emit({ title: "Oops", message: "Something went wrong." });
 *
 * Usage (listen):
 *   const unsub = alertEmitter.subscribe((payload) => { ... });
 *   // call unsub() to clean up
 */

export type AlertPayload = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
};

type Listener = (payload: AlertPayload) => void;

class AlertEmitter {
  private listeners: Listener[] = [];

  subscribe(fn: Listener): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  emit(payload: AlertPayload) {
    this.listeners.forEach((fn) => fn(payload));
  }
}

export const alertEmitter = new AlertEmitter();

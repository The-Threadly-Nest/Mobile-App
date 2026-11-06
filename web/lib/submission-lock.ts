/** Synchronous lock: React state alone cannot stop two submits in one render. */
export function createSubmissionLock() {
  let state: "idle" | "pending" | "complete" = "idle";
  return {
    start() {
      if (state !== "idle") return false;
      state = "pending";
      return true;
    },
    complete() { state = "complete"; },
    retry() { if (state === "pending") state = "idle"; },
  };
}

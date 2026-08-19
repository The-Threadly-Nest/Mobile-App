interface ChatTurn { role: "user" | "model"; text: string }

const RECENT_TURNS_TO_KEEP = 6;
const MAX_TURNS_BEFORE_ESCALATE = 8;

export function buildTruncatedHistory(fullHistory: ChatTurn[]): ChatTurn[] {
  if (fullHistory.length <= RECENT_TURNS_TO_KEEP) return fullHistory;
  const recent = fullHistory.slice(-RECENT_TURNS_TO_KEEP);
  const earlierCount = fullHistory.length - RECENT_TURNS_TO_KEEP;
  return [{ role: "user", text: `[${earlierCount} earlier messages omitted]` }, ...recent];
}

export function shouldForceEscalate(fullHistory: ChatTurn[]): boolean {
  return fullHistory.filter((t) => t.role === "user").length >= MAX_TURNS_BEFORE_ESCALATE;
}

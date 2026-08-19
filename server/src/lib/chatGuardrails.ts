const CARD_NUMBER_PATTERN = /\b(?:\d[ -]*?){13,16}\b/;
const BLOCKED_TOPICS_PATTERN = /\b(refund|dispute|chargeback|lawsuit|sue|scam)\b/i;

export interface GuardrailResult { blocked: boolean; reason?: string }

export function checkMessageGuardrails(message: string): GuardrailResult {
  if (CARD_NUMBER_PATTERN.test(message)) return { blocked: true, reason: "message_contains_sensitive_data" };
  if (BLOCKED_TOPICS_PATTERN.test(message)) return { blocked: true, reason: "requires_human_attention" };
  if (message.length > 1000) return { blocked: true, reason: "message_too_long" };
  return { blocked: false };
}

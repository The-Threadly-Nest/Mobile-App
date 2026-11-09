/** Map microphone decibels to a visible, bounded bar height. */
export function meterAmplitude(decibels?: number) {
  if (typeof decibels !== "number" || !Number.isFinite(decibels)) return 0.08;
  return Math.max(0.08, Math.min(1, (decibels + 60) / 60));
}

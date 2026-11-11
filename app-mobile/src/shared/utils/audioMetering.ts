/** Map microphone decibels to a visible, bounded bar height. */
export function meterAmplitude(decibels?: number) {
  if (typeof decibels !== "number" || !Number.isFinite(decibels)) return 0.08;
  return Math.max(0.08, Math.min(1, (decibels + 60) / 60));
}

/** Smooth travelling motion, separate from microphone loudness. */
export function waveScale(phase: number, index: number) {
  return 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(2 * Math.PI * (phase - index / 12)));
}

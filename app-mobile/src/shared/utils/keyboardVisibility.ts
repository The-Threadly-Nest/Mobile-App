export function keyboardScrollAdjustment(inputY: number, inputHeight: number, viewportY: number, viewportHeight: number, keyboardTop: number, gap: number): number {
  const bottom = Math.min(viewportY + viewportHeight, keyboardTop) - gap;
  if (inputY + inputHeight > bottom) return inputY + inputHeight - bottom;
  if (inputY < viewportY + gap) return inputY - viewportY - gap;
  return 0;
}

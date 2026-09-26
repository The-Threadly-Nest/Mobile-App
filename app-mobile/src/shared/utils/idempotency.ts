export function createIdempotencyKey(scope: string) {
  const randomPart = Math.random().toString(36).slice(2, 12);
  return `${scope}:${Date.now().toString(36)}:${randomPart}`;
}

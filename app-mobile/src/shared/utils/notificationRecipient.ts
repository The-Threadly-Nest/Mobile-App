export function notificationBelongsToAccount(data: { recipientUserId?: unknown; senderId?: unknown } | undefined, userId: string | null): boolean {
  if (!userId) return false;
  if (data?.senderId === userId) return false;
  return !data?.recipientUserId || data.recipientUserId === userId;
}

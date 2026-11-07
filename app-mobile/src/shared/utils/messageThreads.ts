export interface MessageThread {
  fashionHouseId: string;
  fashionHouseName: string;
  fashionHouseLogo: string | null;
  latestMessage: string;
  latestAt: string | null;
  unreadCount: number;
}

export function unreadMessages(threads: MessageThread[]): number {
  return threads.reduce((total, thread) => total + Math.max(0, thread.unreadCount || 0), 0);
}

export function visibleMessageThreads(threads: MessageThread[], tab: "messages" | "notifications"): MessageThread[] {
  return tab === "notifications" ? threads.filter(thread => thread.unreadCount > 0) : threads;
}

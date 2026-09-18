export interface MergeableDirectMessage {
  id: string;
  senderType?: 'CUSTOMER' | 'FASHION_HOUSE';
  senderRole?: 'customer' | 'admin' | 'CUSTOMER' | 'FASHION_HOUSE';
  content?: string;
  text?: string;
  imageUrl?: string;
  audioUrl?: string;
  audioDuration?: number;
  createdAt: string;
}

const OPTIMISTIC_ID_PREFIX = 'temp-';
const MATCH_WINDOW_MS = 2 * 60 * 1000;

const normalizedSender = (message: MergeableDirectMessage) => {
  const sender = (message.senderType || message.senderRole || '').toUpperCase();
  return sender === 'ADMIN' ? 'FASHION_HOUSE' : sender;
};

const messagesMatch = (
  optimistic: MergeableDirectMessage,
  serverMessage: MergeableDirectMessage
) => {
  const optimisticTime = new Date(optimistic.createdAt).getTime();
  const optimisticText = optimistic.text || optimistic.content || '';
  const serverTime = new Date(serverMessage.createdAt).getTime();

  return (
    Number.isFinite(optimisticTime) &&
    Number.isFinite(serverTime) &&
    Math.abs(serverTime - optimisticTime) <= MATCH_WINDOW_MS &&
    normalizedSender(serverMessage) === normalizedSender(optimistic) &&
    (serverMessage.text || serverMessage.content || '') === optimisticText &&
    (serverMessage.imageUrl || '') === (optimistic.imageUrl || '') &&
    (serverMessage.audioUrl || '') === (optimistic.audioUrl || '') &&
    (serverMessage.audioDuration || 0) === (optimistic.audioDuration || 0)
  );
};

/**
 * Keeps locally sent messages visible while a polling request is in flight.
 * Once the server returns the corresponding message, the temporary copy is
 * removed so the user never sees it disappear or appear twice.
 */
export const mergeDirectMessages = <T extends MergeableDirectMessage>(
  currentMessages: T[],
  serverMessages: T[]
) => {
  const availableServerIndexes = new Set(serverMessages.map((_, index) => index));
  const unmatchedOptimistic = currentMessages
    .filter((message) => message.id.startsWith(OPTIMISTIC_ID_PREFIX))
    .filter((message) => {
      const matchingIndex = serverMessages.findIndex(
        (serverMessage, index) =>
          availableServerIndexes.has(index) && messagesMatch(message, serverMessage)
      );
      if (matchingIndex < 0) return true;
      availableServerIndexes.delete(matchingIndex);
      return false;
    });

  return [...serverMessages, ...unmatchedOptimistic].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  );
};

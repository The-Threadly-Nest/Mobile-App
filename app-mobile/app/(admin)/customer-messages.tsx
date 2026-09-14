import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiFetch } from '../../src/shared/utils/apiClient';
import BackArrowIcon from '@/shared/components/BackArrowIcon';

interface ThreadSummary {
  customerId: string;
  customerName: string;
  customerEmail: string;
  unreadCount: number;
  lastMessage?: {
    content: string;
    createdAt: string;
    senderType: 'CUSTOMER' | 'FASHION_HOUSE';
    isRead: boolean;
  };
}

interface DirectMessage {
  id: string;
  senderType: 'CUSTOMER' | 'FASHION_HOUSE';
  content: string;
  createdAt: string;
  isRead: boolean;
}

interface TranscriptTurn {
  role: 'user' | 'model' | 'admin' | 'staff';
  text: string;
}

export default function AdminCustomerMessagesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<ThreadSummary | null>(null);

  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const fetchThreads = async (silent = false) => {
    try {
      if (!silent) setLoadingThreads(true);
      const data = await apiFetch<ThreadSummary[]>('/api/direct-messages/threads');
      if (Array.isArray(data)) {
        setThreads(data);
      }
    } catch (err) {
      console.error('Error fetching threads:', err);
    } finally {
      if (!silent) setLoadingThreads(false);
    }
  };

  useEffect(() => {
    fetchThreads();
    const interval = setInterval(() => {
      if (!selectedCustomer) {
        fetchThreads(true);
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [selectedCustomer]);

  const openThread = async (thread: ThreadSummary) => {
    setSelectedCustomer(thread);
    setLoadingMessages(true);
    try {
      // Mark as read
      apiFetch(`/api/direct-messages/thread/${thread.customerId}/read`, { method: 'PATCH' }).catch(() => {});
      const data = await apiFetch<{ messages: DirectMessage[]; transcript: TranscriptTurn[] }>(`/api/direct-messages/thread/${thread.customerId}`);
      if (data && Array.isArray(data.messages)) {
        setMessages(data.messages);
      }
      if (data && Array.isArray(data.transcript)) {
        setTranscript(data.transcript.filter((t) => t.text && !t.text.includes('--- Chat Session Ended ---')));
      }
    } catch (err) {
      console.error('Error fetching thread messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (!selectedCustomer) return;
    const interval = setInterval(async () => {
      try {
        const data = await apiFetch<{ messages: DirectMessage[]; transcript: TranscriptTurn[] }>(`/api/direct-messages/thread/${selectedCustomer.customerId}`);
        if (data && Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
      } catch (err) {}
    }, 4000);
    return () => clearInterval(interval);
  }, [selectedCustomer]);

  const handleSend = async () => {
    if (!inputText.trim() || sending || !selectedCustomer) return;
    const textToSend = inputText.trim();
    setInputText('');
    setSending(true);

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: DirectMessage = {
      id: tempId,
      senderType: 'FASHION_HOUSE',
      content: textToSend,
      createdAt: new Date().toISOString(),
      isRead: true,
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const result = await apiFetch<DirectMessage>(`/api/direct-messages/thread/${selectedCustomer.customerId}`, {
        method: 'POST',
        body: JSON.stringify({ content: textToSend }),
      });
      if (result && result.id) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? result : m)));
      }
    } catch (err) {
      console.error('Failed to send admin message:', err);
    } finally {
      setSending(false);
    }
  };

  const renderThreadItem = ({ item }: { item: ThreadSummary }) => {
    const timeStr = item.lastMessage
      ? new Date(item.lastMessage.createdAt).toLocaleDateString([], {
          month: 'short',
          day: 'numeric',
        })
      : '';

    return (
      <TouchableOpacity
        style={styles.threadCard}
        onPress={() => openThread(item)}
        activeOpacity={0.7}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.customerName ? item.customerName.charAt(0).toUpperCase() : 'C'}
          </Text>
        </View>
        <View style={styles.threadInfo}>
          <View style={styles.threadHeaderRow}>
            <Text style={styles.customerName}>{item.customerName}</Text>
            <Text style={styles.timeText}>{timeStr}</Text>
          </View>
          <Text style={styles.lastMsgText} numberOfLines={1}>
            {item.lastMessage ? item.lastMessage.content : 'No messages yet'}
          </Text>
        </View>
        {item.unreadCount > 0 ? (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  const renderTranscriptSection = () => {
    if (transcript.length === 0) return null;
    return (
      <View>
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerLabel}>AI CHAT HISTORY</Text>
          <View style={styles.dividerLine} />
        </View>
        {transcript.map((turn, idx) => {
          const isUser = turn.role === 'user';
          return (
            <View key={`t-${idx}`} style={[styles.msgWrapper, isUser ? styles.msgWrapperFH : styles.msgWrapperCust]}>
              {!isUser && (
                <Text style={styles.transcriptSenderLabel}>Booking Assistant</Text>
              )}
              <View style={[styles.bubble, isUser ? styles.bubbleTranscriptUser : styles.bubbleTranscript]}>
                <Text style={[styles.msgText, isUser ? styles.textFH : styles.textTranscript]}>
                  {turn.text}
                </Text>
              </View>
            </View>
          );
        })}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerLabel}>HUMAN SUPPORT</Text>
          <View style={styles.dividerLine} />
        </View>
      </View>
    );
  };

  const renderMessageItem = ({ item }: { item: DirectMessage }) => {
    const isFashionHouse = item.senderType === 'FASHION_HOUSE';
    const timeStr = new Date(item.createdAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <View style={[styles.msgWrapper, isFashionHouse ? styles.msgWrapperFH : styles.msgWrapperCust]}>
        <View style={[styles.bubble, isFashionHouse ? styles.bubbleFH : styles.bubbleCust]}>
          <Text style={[styles.msgText, isFashionHouse ? styles.textFH : styles.textCust]}>
            {item.content}
          </Text>
        </View>
        <Text style={styles.msgTime}>{timeStr}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F6F0" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: 36 + (insets.top || 0) }]}>
        {selectedCustomer ? (
          <TouchableOpacity style={styles.backBtn} onPress={() => setSelectedCustomer(null)}>
            <BackArrowIcon size={20} color="#1A1110" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <BackArrowIcon size={20} color="#1A1110" />
          </TouchableOpacity>
        )}

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>
            {selectedCustomer ? selectedCustomer.customerName : 'Customer Inquiries'}
          </Text>
          {selectedCustomer ? (
            <Text style={styles.headerSubtitle}>{selectedCustomer.customerEmail}</Text>
          ) : (
            <Text style={styles.headerSubtitle}>Direct messages with clients</Text>
          )}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {!selectedCustomer ? (
        // Threads List View
        loadingThreads && threads.length === 0 ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#4A080C" />
          </View>
        ) : threads.length === 0 ? (
          <View style={styles.centerContainer}>
            <Ionicons name="mail-open-outline" size={56} color="#C4BFC0" />
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptySubtitle}>
              Customer direct inquiries will appear here when clients reach out.
            </Text>
          </View>
        ) : (
          <FlatList
            data={threads}
            keyExtractor={(item) => item.customerId}
            renderItem={renderThreadItem}
            contentContainerStyle={styles.threadsList}
          />
        )
      ) : (
        // Active Chat View
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {loadingMessages && messages.length === 0 ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#4A080C" />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessageItem}
              ListHeaderComponent={renderTranscriptSection}
              contentContainerStyle={styles.messagesList}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            />
          )}

          {/* Input Footer */}
          <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder={`Reply to ${selectedCustomer.customerName}...`}
              placeholderTextColor="#8C8583"
              multiline
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!inputText.trim() || sending) && styles.sendBtnDisabled,
              ]}
              onPress={handleSend}
              disabled={!inputText.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="send" size={18} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F6F0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#F8F6F0',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFECE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Fraunces-SemiBold',
    color: '#1A1110',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#77706E',
    marginTop: 2,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Fraunces-SemiBold',
    color: '#1A1110',
    marginTop: 12,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#77706E',
    textAlign: 'center',
  },
  threadsList: {
    paddingVertical: 12,
  },
  threadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECE4',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#4A080C',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Fraunces-Bold',
  },
  threadInfo: {
    flex: 1,
  },
  threadHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1110',
  },
  timeText: {
    fontSize: 11,
    color: '#8C8583',
  },
  lastMsgText: {
    fontSize: 13,
    color: '#66605E',
  },
  unreadBadge: {
    backgroundColor: '#4A080C',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 8,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  msgWrapper: {
    marginBottom: 12,
    maxWidth: '80%',
  },
  msgWrapperFH: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  msgWrapperCust: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleFH: {
    backgroundColor: '#4A080C',
    borderBottomRightRadius: 4,
  },
  bubbleCust: {
    backgroundColor: '#EFECE6',
    borderBottomLeftRadius: 4,
  },
  msgText: {
    fontSize: 14,
    lineHeight: 20,
  },
  textFH: {
    color: '#FFFFFF',
  },
  textCust: {
    color: '#1A1110',
  },
  bubbleTranscript: {
    backgroundColor: 'rgba(196, 167, 99, 0.15)',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(196, 167, 99, 0.3)',
  },
  bubbleTranscriptUser: {
    backgroundColor: 'rgba(74, 8, 12, 0.15)',
    borderBottomRightRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(74, 8, 12, 0.2)',
  },
  textTranscript: {
    color: '#4A080C',
    fontStyle: 'italic',
  },
  transcriptSenderLabel: {
    fontSize: 11,
    color: '#C4A763',
    fontWeight: '600',
    marginBottom: 3,
    letterSpacing: 0.3,
  },
  msgTime: {
    fontSize: 10,
    color: '#9E9795',
    marginTop: 4,
    marginHorizontal: 4,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    paddingHorizontal: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#C4A763',
    opacity: 0.5,
  },
  dividerLabel: {
    marginHorizontal: 12,
    fontSize: 10,
    fontWeight: '700',
    color: '#C4A763',
    letterSpacing: 2,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E2DA',
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#F8F6F0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1A1110',
    marginRight: 10,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4A080C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#B5A5A7',
  },
});

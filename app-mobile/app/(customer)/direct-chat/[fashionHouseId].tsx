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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiFetch } from '../../../src/shared/utils/apiClient';

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

export default function CustomerDirectChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { fashionHouseId, fashionHouseName } = useLocalSearchParams<{
    fashionHouseId: string;
    fashionHouseName?: string;
  }>();

  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const displayName = fashionHouseName || 'Fashion House';

  const fetchMessages = async (silent = false) => {
    if (!fashionHouseId) return;
    try {
      if (!silent) setLoading(true);
      const data = await apiFetch<{ messages: DirectMessage[]; transcript: TranscriptTurn[] }>(`/api/direct-messages/thread/${fashionHouseId}`);
      if (data && Array.isArray(data.messages)) {
        setMessages(data.messages);
      }
      if (data && Array.isArray(data.transcript)) {
        setTranscript(data.transcript.filter((t) => t.text && !t.text.includes('--- Chat Session Ended ---')));
      }
    } catch (err) {
      console.error('Error loading direct messages:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(() => {
      fetchMessages(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [fashionHouseId]);

  const handleSend = async () => {
    if (!inputText.trim() || sending || !fashionHouseId) return;
    const textToSend = inputText.trim();
    setInputText('');
    setSending(true);

    // Optimistic local add
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: DirectMessage = {
      id: tempId,
      senderType: 'CUSTOMER',
      content: textToSend,
      createdAt: new Date().toISOString(),
      isRead: false,
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const result = await apiFetch<DirectMessage>(`/api/direct-messages/thread/${fashionHouseId}`, {
        method: 'POST',
        body: JSON.stringify({ content: textToSend }),
      });
      if (result && result.id) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? result : m)));
      }
    } catch (err) {
      console.error('Failed to send direct message:', err);
    } finally {
      setSending(false);
    }
  };

  const renderTranscriptSection = () => {
    if (transcript.length === 0) return null;
    return (
      <View>
        {/* AI Chat History banner */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerLabel}>AI CHAT HISTORY</Text>
          <View style={styles.dividerLine} />
        </View>
        {transcript.map((turn, idx) => {
          const isUser = turn.role === 'user';
          return (
            <View key={`transcript-${idx}`} style={[styles.messageWrapper, isUser ? styles.msgWrapperCustomer : styles.msgWrapperFH]}>
              {!isUser && (
                <Text style={styles.transcriptSenderLabel}>Booking Assistant</Text>
              )}
              <View style={[styles.bubble, isUser ? styles.bubbleCustomer : styles.bubbleTranscript]}>
                <Text style={[styles.messageText, isUser ? styles.textCustomer : styles.textTranscript]}>
                  {turn.text}
                </Text>
              </View>
            </View>
          );
        })}
        {/* Human support started divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerLabel}>HUMAN SUPPORT</Text>
          <View style={styles.dividerLine} />
        </View>
      </View>
    );
  };

  const renderItem = ({ item }: { item: DirectMessage }) => {
    const isCustomer = item.senderType === 'CUSTOMER';
    const timeStr = new Date(item.createdAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <View style={[styles.messageWrapper, isCustomer ? styles.msgWrapperCustomer : styles.msgWrapperFH]}>
        <View style={[styles.bubble, isCustomer ? styles.bubbleCustomer : styles.bubbleFH]}>
          <Text style={[styles.messageText, isCustomer ? styles.textCustomer : styles.textFH]}>
            {item.content}
          </Text>
        </View>
        <Text style={styles.timeText}>{timeStr}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F6F0" />

      {/* Header Bar */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 36) }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1A1110" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{displayName}</Text>
          <View style={styles.onlineBadge}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>Direct Support Chat</Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {loading && messages.length === 0 ? (
          <View style={styles.loadingCenter}>
            <ActivityIndicator size="large" color="#4A080C" />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyCenter}>
            <Ionicons name="chatbubbles-outline" size={48} color="#C4BFC0" />
            <Text style={styles.emptyTitle}>Start a conversation</Text>
            <Text style={styles.emptySubtitle}>
              Message {displayName} directly regarding your orders, fittings, or design inquiries.
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            ListHeaderComponent={renderTranscriptSection}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        {/* Input Bar */}
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type your message..."
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
    borderBottomWidth: 1,
    borderBottomColor: '#E5E2DA',
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
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#27AE60',
    marginRight: 4,
  },
  onlineText: {
    fontSize: 11,
    color: '#6B6462',
    fontWeight: '500',
  },
  keyboardView: {
    flex: 1,
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
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
    lineHeight: 18,
  },
  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  messageWrapper: {
    marginBottom: 12,
    maxWidth: '80%',
  },
  msgWrapperCustomer: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  msgWrapperFH: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleCustomer: {
    backgroundColor: '#4A080C',
    borderBottomRightRadius: 4,
  },
  bubbleFH: {
    backgroundColor: '#EFECE6',
    borderBottomLeftRadius: 4,
  },
  bubbleTranscript: {
    backgroundColor: 'rgba(196, 167, 99, 0.15)',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(196, 167, 99, 0.3)',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  textCustomer: {
    color: '#FFFFFF',
  },
  textFH: {
    color: '#1A1110',
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
  timeText: {
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

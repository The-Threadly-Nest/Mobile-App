import React, { useState, useEffect, useRef } from 'react';
import { formatChatDate } from '@/shared/utils/formatters';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ActivityIndicator,
  StyleSheet,
  Image,
  AppState,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Paperclip,
  Camera,
  Smile,
  Send,
  MessageSquare,
  Check,
  CheckCheck,
  Mic,
  Play,
  Pause,
  Trash2,
} from 'lucide-react-native';
import { useAudioRecorder, AudioModule, RecordingPresets, createAudioPlayer } from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import BackArrowIcon from '@/shared/components/BackArrowIcon';
import { apiFetch } from '../../../src/shared/utils/apiClient';
import { createIdempotencyKey } from '@/shared/utils/idempotency';
import { uploadFile } from '@/shared/utils/upload';
import { useAppAlert } from '@/shared/hooks/useAppAlert';
import { useAuthStore } from '@/stores/useAuthStore';
import { StatusBar } from 'expo-status-bar';
import MessageDeleteMenu from '@/shared/components/MessageDeleteMenu';
import BottomAnchoredChatScrollView from '@/shared/components/BottomAnchoredChatScrollView';
import { appendDirectMessages, mergeDirectMessages } from '@/shared/utils/mergeDirectMessages';
import {
  createChatCacheOwner,
  readChatCache,
  writeChatCache,
} from '@/shared/services/chatCache';

interface DirectMessage {
  id: string;
  senderType?: 'CUSTOMER' | 'FASHION_HOUSE';
  senderRole?: 'customer' | 'admin' | 'CUSTOMER' | 'FASHION_HOUSE';
  senderId?: string;
  content?: string;
  text?: string;
  imageUrl?: string;
  audioUrl?: string;
  audioDuration?: number;
  createdAt: string;
  isRead?: boolean;
  deletedForEveryoneAt?: string | null;
}

interface TranscriptTurn {
  role: 'user' | 'model' | 'admin' | 'staff';
  text: string;
  createdAt?: string;
  timestamp?: string | number;
}

interface DirectChatCache {
  messages: DirectMessage[];
  transcript: TranscriptTurn[];
}

interface DirectMessagePageInfo {
  hasMoreOlder: boolean;
  hasMoreNewer: boolean;
  olderCursor: string | null;
  latestCursor: string | null;
  syncCursor: string;
}

interface DirectMessagePage {
  messages: DirectMessage[];
  transcript: TranscriptTurn[];
  pageInfo: DirectMessagePageInfo;
}

const EMOJIS = ['😊', '👍', '✂️', '👗', '✨', '🪡', '🧵', '❤️', '🙌', '🔥', '👌', '👏'];

function AnimatedWaveform({
  isAnimating,
  color,
  inactiveColor,
  barCount = 34,
  height = 14,
}: {
  isAnimating: boolean;
  color: string;
  inactiveColor?: string;
  barCount?: number;
  height?: number;
}) {
  const [bars, setBars] = useState<number[]>(() =>
    Array.from({ length: barCount }, () => 0.2)
  );

  useEffect(() => {
    if (!isAnimating) return;

    const interval = setInterval(() => {
      setBars((prev) => {
        const isLull = Math.random() < 0.15;
        const newSample = isLull
          ? 0.15 + Math.random() * 0.15
          : 0.25 + Math.random() * 0.6;

        return [...prev.slice(1), newSample];
      });
    }, 150);

    return () => clearInterval(interval);
  }, [isAnimating, barCount]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height, flex: 1 }}>
      {bars.map((amplitude, i) => {
        const barH = Math.max(2, amplitude * height);
        return (
          <View
            key={i}
            style={{
              width: 2.5,
              height: barH,
              borderRadius: 1.5,
              backgroundColor: isAnimating ? color : inactiveColor || color,
            }}
          />
        );
      })}
    </View>
  );
}

// WhatsApp-style message tail components
const SentTail = () => (
  <View
    style={{
      position: 'absolute',
      bottom: 0,
      right: -7,
      width: 0,
      height: 0,
      borderTopWidth: 9,
      borderTopColor: '#453332',
      borderLeftWidth: 9,
      borderLeftColor: 'transparent',
    }}
  />
);

const ReceivedTail = ({ color = 'rgba(74,8,12,0.12)' }: { color?: string }) => (
  <View
    style={{
      position: 'absolute',
      bottom: 0,
      left: -7,
      width: 0,
      height: 0,
      borderTopWidth: 9,
      borderTopColor: color,
      borderRightWidth: 9,
      borderRightColor: 'transparent',
    }}
  />
);

export default function CustomerDirectChatScreen() {
  const insets = useSafeAreaInsets();
  const { showAlert } = useAppAlert();
  const role = useAuthStore((s) => s.role);
  const email = useAuthStore((s) => s.email);
  const { fashionHouseId, fashionHouseName, fashionHouseLogo } = useLocalSearchParams<{
    fashionHouseId: string;
    fashionHouseName?: string;
    fashionHouseLogo?: string;
  }>();

  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [hasMoreEarlier, setHasMoreEarlier] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [selectedMessageForDeletion, setSelectedMessageForDeletion] = useState<{
    message: DirectMessage;
    isMine: boolean;
  } | null>(null);

  // Audio Recording & Playback
  const audioRecorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const timerRef = useRef<any>(null);
  const playerRef = useRef<any>(null);

  const activeConversationIdRef = useRef<string | null>(null);
  const hydratedConversationIdRef = useRef<string | null>(null);
  const olderCursorRef = useRef<string | null>(null);
  const latestCursorRef = useRef<string | null>(null);
  const syncCursorRef = useRef<string | null>(null);
  const requestInFlightRef = useRef(false);
  const appIsActiveRef = useRef(AppState.currentState === 'active');
  const failedTextSendRef = useRef<{ text: string; clientMessageId: string } | null>(null);
  const displayName = fashionHouseName || 'Fashion House';
  const [resolvedFashionHouseLogo, setResolvedFashionHouseLogo] = useState<string | null>(
    fashionHouseLogo || null
  );
  const cacheOwner = createChatCacheOwner(role, email);

  useEffect(() => {
    let active = true;
    if (fashionHouseLogo) {
      setResolvedFashionHouseLogo(fashionHouseLogo);
      return () => {
        active = false;
      };
    }

    setResolvedFashionHouseLogo(null);
    if (fashionHouseId) {
      void apiFetch<{ brandLogoUrl?: string | null }>(
        `/api/fashion-houses/${fashionHouseId}`,
        { silent: true }
      )
        .then((fashionHouse) => {
          if (active) setResolvedFashionHouseLogo(fashionHouse?.brandLogoUrl || null);
        })
        .catch(() => undefined);
    }

    return () => {
      active = false;
    };
  }, [fashionHouseId, fashionHouseLogo]);

  const fetchMessages = async (silent = false) => {
    if (!fashionHouseId || requestInFlightRef.current) return;
    const conversationId = fashionHouseId;
    requestInFlightRef.current = true;
    try {
      if (!silent) {
        hydratedConversationIdRef.current = null;
        olderCursorRef.current = null;
        latestCursorRef.current = null;
        syncCursorRef.current = null;
        setLoading(true);
        setMessages([]);
        setTranscript([]);
        const cached = await readChatCache<DirectChatCache>(
          cacheOwner,
          'customer-direct',
          conversationId
        );
        if (activeConversationIdRef.current !== conversationId) return;
        if (cached) {
          setMessages(Array.isArray(cached.messages) ? cached.messages : []);
          setTranscript(Array.isArray(cached.transcript) ? cached.transcript : []);
          hydratedConversationIdRef.current = conversationId;
          setLoading(false);
        }
      }
      const after = silent ? latestCursorRef.current : null;
      const since = syncCursorRef.current;
      const query = after
        ? `?limit=100&after=${encodeURIComponent(after)}${since ? `&since=${encodeURIComponent(since)}` : ''}`
        : '?limit=50';
      const data = await apiFetch<DirectMessagePage>(
        `/api/direct-messages/thread/${conversationId}${query}`,
        { silent }
      );
      if (activeConversationIdRef.current !== conversationId) return;
      const nextMessages = data && Array.isArray(data.messages) ? data.messages : [];
      if (after) {
        setMessages((current) => appendDirectMessages(current, nextMessages));
      } else {
        setMessages((current) => mergeDirectMessages(current, nextMessages));
        const nextTranscript = data && Array.isArray(data.transcript)
          ? data.transcript.filter((t) => t.text && !t.text.includes('--- Chat Session Ended ---'))
          : [];
        setTranscript(nextTranscript);
        olderCursorRef.current = data?.pageInfo?.olderCursor ?? nextMessages[0]?.id ?? null;
        setHasMoreEarlier(Boolean(data?.pageInfo?.hasMoreOlder));
      }
      latestCursorRef.current = data?.pageInfo?.latestCursor
        ?? nextMessages[nextMessages.length - 1]?.id
        ?? latestCursorRef.current;
      syncCursorRef.current = data?.pageInfo?.syncCursor ?? syncCursorRef.current;
      hydratedConversationIdRef.current = conversationId;
    } catch (err) {
      console.error('Error loading direct messages:', err);
    } finally {
      requestInFlightRef.current = false;
      if (!silent && activeConversationIdRef.current === conversationId) {
        hydratedConversationIdRef.current = conversationId;
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    activeConversationIdRef.current = fashionHouseId;
    void fetchMessages();
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      const becameActive = nextState === 'active' && !appIsActiveRef.current;
      appIsActiveRef.current = nextState === 'active';
      if (becameActive) void fetchMessages(true);
    });
    const interval = setInterval(() => {
      if (appIsActiveRef.current) void fetchMessages(true);
    }, 12000);
    return () => {
      clearInterval(interval);
      appStateSubscription.remove();
      if (activeConversationIdRef.current === fashionHouseId) {
        activeConversationIdRef.current = null;
      }
    };
  }, [fashionHouseId, cacheOwner]);

  const loadEarlierMessages = async () => {
    const cursor = olderCursorRef.current;
    if (!fashionHouseId || !cursor || loadingEarlier || requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    setLoadingEarlier(true);
    try {
      const data = await apiFetch<DirectMessagePage>(
        `/api/direct-messages/thread/${fashionHouseId}?limit=50&cursor=${encodeURIComponent(cursor)}`,
        { silent: true }
      );
      if (activeConversationIdRef.current !== fashionHouseId) return;
      const earlierMessages = Array.isArray(data?.messages) ? data.messages : [];
      setMessages((current) => appendDirectMessages(current, earlierMessages));
      olderCursorRef.current = data?.pageInfo?.olderCursor ?? earlierMessages[0]?.id ?? cursor;
      setHasMoreEarlier(Boolean(data?.pageInfo?.hasMoreOlder));
    } catch (err) {
      console.error('Error loading earlier direct messages:', err);
    } finally {
      requestInFlightRef.current = false;
      setLoadingEarlier(false);
    }
  };

  useEffect(() => {
    if (
      loading ||
      !fashionHouseId ||
      hydratedConversationIdRef.current !== fashionHouseId
    ) return;
    void writeChatCache<DirectChatCache>(cacheOwner, 'customer-direct', fashionHouseId, {
      messages,
      transcript,
    });
  }, [cacheOwner, fashionHouseId, loading, messages, transcript]);

  const openMessageDeleteMenu = (message: DirectMessage, isMine: boolean) => {
    if (message.id.startsWith('temp-')) return;
    setSelectedMessageForDeletion({ message, isMine });
  };

  const canDeleteSelectedForEveryone = (() => {
    if (!selectedMessageForDeletion?.isMine) return false;
    const { message } = selectedMessageForDeletion;
    if (message.deletedForEveryoneAt) return false;
    const sentAt = new Date(message.createdAt).getTime();
    return Number.isFinite(sentAt) && Date.now() - sentAt <= 10 * 60 * 1000;
  })();

  const handleDeleteSelectedForEveryone = async () => {
    if (!selectedMessageForDeletion || !canDeleteSelectedForEveryone) return;
    const { message } = selectedMessageForDeletion;
    setDeletingMessageId(message.id);
    try {
      const deleted = await apiFetch<DirectMessage>(
        `/api/direct-messages/messages/${message.id}`,
        { method: 'DELETE' }
      );
      setMessages((current) => current.map((item) => (item.id === message.id ? deleted : item)));
    } catch {
      showAlert("Couldn't delete message", 'Please try again.');
    } finally {
      setDeletingMessageId(null);
      setSelectedMessageForDeletion(null);
    }
  };

  const handleDeleteSelectedForMe = async () => {
    if (!selectedMessageForDeletion) return;
    const { message } = selectedMessageForDeletion;
    setDeletingMessageId(message.id);
    try {
      await apiFetch(`/api/direct-messages/messages/${message.id}/me`, { method: 'DELETE' });
      setMessages((current) => current.filter((item) => item.id !== message.id));
    } catch {
      showAlert("Couldn't delete message", 'Please try again.');
    } finally {
      setDeletingMessageId(null);
      setSelectedMessageForDeletion(null);
    }
  };

  const handleSend = async () => {
    const textToSend = inputText.trim();
    if (!textToSend || sending || !fashionHouseId) return;
    setInputText('');
    setSending(true);

    const retryAttempt = failedTextSendRef.current?.text === textToSend
      ? failedTextSendRef.current
      : null;
    const clientMessageId = retryAttempt?.clientMessageId || createIdempotencyKey('dm');
    failedTextSendRef.current = null;
    const tempId = `temp-${clientMessageId}`;
    const optimisticMsg: DirectMessage = {
      id: tempId,
      senderType: 'CUSTOMER',
      text: textToSend,
      content: textToSend,
      createdAt: new Date().toISOString(),
      isRead: false,
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const result = await apiFetch<DirectMessage>(`/api/direct-messages/thread/${fashionHouseId}`, {
        method: 'POST',
        body: JSON.stringify({ text: textToSend, clientMessageId }),
      });
      if (result && result.id) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? result : m)));
      }
    } catch (err) {
      failedTextSendRef.current = { text: textToSend, clientMessageId };
      console.error('Failed to send message:', err);
      setMessages((current) => current.filter((message) => message.id !== tempId));
      setInputText((current) => current || textToSend);
      showAlert("Couldn't send message", 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handlePickImage = async (source: 'library' | 'camera' = 'library') => {
    try {
      const permission = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showAlert(
          'Permission Required',
          source === 'camera'
            ? 'Please allow camera access to take a photo.'
            : 'Please allow access to your photos to attach an image.'
        );
        return;
      }

      const result = await (source === 'camera'
        ? ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
          })
        : ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
          }));

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        setUploadingImage(true);
        const filename = asset.fileName || `chat_${Date.now()}.jpg`;
        const contentType = asset.mimeType || 'image/jpeg';

        try {
          const uploaded = await uploadFile(asset.uri, filename, contentType);
          const tempMsg: DirectMessage = {
            id: `temp-${Date.now()}`,
            senderType: 'CUSTOMER',
            imageUrl: uploaded.fileUrl || asset.uri,
            createdAt: new Date().toISOString(),
            isRead: false,
          };
          setMessages((prev) => [...prev, tempMsg]);

          await apiFetch(`/api/direct-messages/thread/${fashionHouseId}`, {
            method: 'POST',
            body: JSON.stringify({ imageUrl: uploaded.fileUrl, clientMessageId: createIdempotencyKey('dm-image') }),
          });
          fetchMessages(true);
        } catch (err: any) {
          showAlert('Upload Error', err.message || 'Failed to upload image.');
        } finally {
          setUploadingImage(false);
        }
      }
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to pick image.');
    }
  };

  // Audio Recording Handlers
  const startRecording = async () => {
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        showAlert('Permission Denied', 'Microphone permission is required to record voice notes.');
        return;
      }
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setIsRecording(true);
      setIsPaused(false);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      showAlert('Recording Error', err.message || 'Failed to start recording.');
    }
  };

  const cancelRecording = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      await audioRecorder.stop();
    } catch {}
    setIsRecording(false);
    setIsPaused(false);
    setRecordingDuration(0);
  };

  const togglePauseRecording = async () => {
    if (!isRecording) return;
    try {
      if (isPaused) {
        audioRecorder.record();
        setIsPaused(false);
        timerRef.current = setInterval(() => {
          setRecordingDuration((prev) => prev + 1);
        }, 1000);
      } else {
        if (timerRef.current) clearInterval(timerRef.current);
        audioRecorder.pause();
        setIsPaused(true);
      }
    } catch (err: any) {
      console.warn('Failed to toggle pause recording', err);
    }
  };

  const stopAndSendRecording = async () => {
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      await audioRecorder.stop();
      await new Promise((resolve) => setTimeout(resolve, 250));
      const uri = audioRecorder.uri;
      const finalDuration = recordingDuration;
      setIsRecording(false);
      setIsPaused(false);
      setRecordingDuration(0);

      if (!uri) return;

      setSending(true);
      const uploaded = await uploadFile(uri, `voice_${Date.now()}.m4a`, 'audio/m4a');
      const finalAudioUrl = uploaded.fileUrl || uri;

      const tempMsg: DirectMessage = {
        id: `temp-${Date.now()}`,
        senderType: 'CUSTOMER',
        audioUrl: finalAudioUrl,
        audioDuration: finalDuration,
        createdAt: new Date().toISOString(),
        isRead: false,
      };
      setMessages((prev) => [...prev, tempMsg]);

      await apiFetch(`/api/direct-messages/thread/${fashionHouseId}`, {
        method: 'POST',
        body: JSON.stringify({ audioUrl: finalAudioUrl, audioDuration: finalDuration, clientMessageId: createIdempotencyKey('dm-audio') }),
      });
      fetchMessages(true);
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to send voice note.');
    } finally {
      setSending(false);
    }
  };

  const togglePlayAudio = async (audioUrl: string, msgId: string) => {
    try {
      if (playerRef.current) {
        playerRef.current.pause();
        playerRef.current = null;
      }

      if (playingAudioId === msgId) {
        setPlayingAudioId(null);
        return;
      }

      const player = createAudioPlayer(audioUrl);
      playerRef.current = player;
      setPlayingAudioId(msgId);
      player.play();

      player.addListener('playbackStatusUpdate', (status: any) => {
        if (status.didJustFinish) {
          setPlayingAudioId(null);
        }
      });
    } catch (err: any) {
      showAlert('Playback Error', err.message || 'Failed to play audio.');
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const formatDateHeader = (dateInput?: string | Date): string => {
    if (!dateInput) return 'Today';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return 'Today';

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (msgDate.getTime() === today.getTime()) {
      return `Today, ${timeStr}`;
    } else if (msgDate.getTime() === yesterday.getTime()) {
      return `Yesterday, ${timeStr}`;
    } else {
      const formattedDate = formatChatDate(date);
      return `${formattedDate}, ${timeStr}`;
    }
  };

  const renderTranscriptSection = () => {
    const visibleTranscript = transcript.filter(
      (turn) => turn.text && !turn.text.includes('--- Chat Session Ended ---')
    );
    if (visibleTranscript.length === 0) return null;
    return (
      <View style={styles.historySection}>
        <View style={styles.historyHeader}>
          <View style={styles.historyIcon}>
            <MessageSquare size={18} color="#453332" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.historyTitle}>Booking Assistant History</Text>
            <Text style={styles.historySubtitle}>Previous conversation shared for context</Text>
          </View>
        </View>
        {visibleTranscript.map((turn, idx) => {
          const isUser = turn.role === 'user';
          const timeStr = turn.createdAt
            ? new Date(turn.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : turn.timestamp
            ? new Date(turn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '';

          return (
            <View key={`transcript-${idx}`} style={styles.messageBlock}>
              <Text style={[styles.senderNameText, isUser && styles.userSenderName]}>
                {isUser ? 'You' : 'Booking Assistant'}
              </Text>
              <View style={[styles.bubbleBase, isUser ? styles.sentBubble : styles.receivedBubble]}>
                <Text style={[styles.bubbleText, isUser ? styles.sentText : styles.receivedText]}>
                  {turn.text}
                </Text>
              </View>
              {timeStr ? (
                <View style={styles.statusRow}>
                  <Text style={styles.statusText}>{timeStr}</Text>
                </View>
              ) : null}
            </View>
          );
        })}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerLabel}>HUMAN SUPPORT STARTS HERE</Text>
          <View style={styles.dividerLine} />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(customer)/(tabs)/browse' as any);
          }}
          style={({ pressed }) => [styles.headerBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <BackArrowIcon size={20} color="#453332" />
        </Pressable>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          {resolvedFashionHouseLogo ? (
            <Image
              source={{ uri: resolvedFashionHouseLogo }}
              style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: 'rgba(74,8,12,0.15)' }}
              resizeMode="cover"
            />
          ) : (
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: '#453332',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontFamily: 'HedvigLettersSerif-Regular', fontSize: 16, color: '#FFFFFF' }}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.headerInfoCol}>
            <Text style={styles.headerNameText}>{displayName}</Text>
            <Text style={styles.headerSubtitleText}>Direct Support Chat</Text>
          </View>
        </View>
      </View>

      {/* Main Chat Area */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <BottomAnchoredChatScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="small" color="#453332" />
            </View>
          ) : (
            <View>
              {renderTranscriptSection()}
              {hasMoreEarlier ? (
                <Pressable
                  onPress={() => void loadEarlierMessages()}
                  disabled={loadingEarlier}
                  style={styles.loadEarlierButton}
                >
                  {loadingEarlier ? (
                    <ActivityIndicator size="small" color="#453332" />
                  ) : (
                    <Text style={styles.loadEarlierText}>Load earlier messages</Text>
                  )}
                </Pressable>
              ) : null}
              {messages.length === 0 && transcript.length === 0 ? (
                <View style={styles.centerContainer}>
                  <View style={styles.emptyIconCircle}>
                    <MessageSquare size={24} color="#8A7550" />
                  </View>
                  <Text style={styles.emptyTitleText}>No messages yet</Text>
                  <Text style={styles.emptySubtext}>
                    Message {displayName} directly regarding your orders & fittings.
                  </Text>
                </View>
              ) : (
                messages.map((msg, index) => {
                  const isFirstMessage = index === 0;
                  const prevMsg = messages[index - 1];
                  const isDifferentDay =
                    prevMsg &&
                    new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();
                  const showDateHeader = isFirstMessage || isDifferentDay;

                  const isMe =
                    msg.senderRole === 'customer' ||
                    msg.senderType === 'CUSTOMER' ||
                    (msg.senderRole !== 'admin' && msg.senderType !== 'FASHION_HOUSE');
                  const isDeleted = Boolean(msg.deletedForEveryoneAt);
                  const msgBody = isDeleted ? 'This message was deleted' : msg.text || msg.content;
                  const timeStr = new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <React.Fragment key={msg.id}>
                      {showDateHeader && (
                        <View style={styles.timeHeaderContainer}>
                          <Text style={styles.timeHeaderText}>{formatDateHeader(msg.createdAt)}</Text>
                        </View>
                      )}
                      <View style={[
                        styles.messageBlock,
                        index === messages.length - 1 && styles.lastMessageBlock,
                      ]}>
                      {!isMe && (
                        <Text style={styles.senderNameText}>{displayName}</Text>
                      )}

                      {/* Bubble + tail wrapper */}
                      <Pressable
                        onLongPress={() => openMessageDeleteMenu(msg, isMe)}
                        delayLongPress={400}
                        disabled={msg.id.startsWith('temp-') || deletingMessageId === msg.id}
                        style={{ position: 'relative', alignSelf: isMe ? 'flex-end' : 'flex-start' }}
                      >
                        <View
                          style={[
                            styles.bubbleBase,
                            isMe ? styles.sentBubble : styles.receivedBubble,
                            !isDeleted && msg.imageUrl ? { padding: 4 } : null,
                          ]}
                        >
                          {!isDeleted && msg.imageUrl ? (
                            <Image
                              source={{ uri: msg.imageUrl }}
                              style={{
                                width: 220,
                                height: 180,
                                borderRadius: 14,
                              }}
                              resizeMode="cover"
                            />
                          ) : null}
                          {msgBody ? (
                            <Text style={[styles.bubbleText, isMe ? styles.sentText : styles.receivedText, isDeleted && { fontStyle: 'italic' }]}>
                              {msgBody}
                            </Text>
                          ) : null}
                          {!isDeleted && msg.audioUrl ? (
                            <Pressable
                              onPress={() => togglePlayAudio(msg.audioUrl!, msg.id)}
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, minWidth: 180 }}
                            >
                              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: isMe ? 'rgba(255,255,255,0.25)' : 'rgba(74,8,12,0.15)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {playingAudioId === msg.id ? (
                                  <Pause size={16} color={isMe ? '#FFFFFF' : '#453332'} />
                                ) : (
                                  <Play size={16} color={isMe ? '#FFFFFF' : '#453332'} style={{ marginLeft: 2 }} />
                                )}
                              </View>
                              <View style={{ flex: 1, justifyContent: 'center' }}>
                                <AnimatedWaveform
                                  isAnimating={playingAudioId === msg.id}
                                  color={isMe ? '#FFFFFF' : '#453332'}
                                  inactiveColor={isMe ? 'rgba(255,255,255,0.4)' : 'rgba(74,8,12,0.4)'}
                                  barCount={16}
                                  height={24}
                                />
                              </View>
                              <Text style={{ fontFamily: 'InstrumentSans-Medium', fontSize: 12, color: isMe ? 'rgba(255,255,255,0.85)' : '#8A7550', flexShrink: 0 }}>
                                {formatDuration(msg.audioDuration || 0)}
                              </Text>
                            </Pressable>
                          ) : null}
                        </View>
                        {isMe ? <SentTail /> : <ReceivedTail />}
                      </Pressable>

                      {/* Timestamp row — shown for both sent and received */}
                      <View style={[styles.statusRow, !isMe && { alignSelf: 'flex-start' }]}>
                        <Text style={styles.statusText}>{timeStr}</Text>
                        {isMe && (
                          msg.id.startsWith('temp-') ? (
                            <Check size={14} color="#8A7550" />
                          ) : msg.isRead ? (
                            <CheckCheck size={14} color="#453332" />
                          ) : (
                            <Check size={14} color="#8A7550" />
                          )
                        )}
                      </View>
                    </View>
                  </React.Fragment>
                );
              })
              )}
            </View>
          )}

          {uploadingImage && (
            <View style={styles.sendingIndicatorContainer}>
              <ActivityIndicator size="small" color="#453332" />
            </View>
          )}
        </BottomAnchoredChatScrollView>

        {/* Emoji Picker Popup */}
        {showEmojiPicker && (
          <View style={[styles.emojiPickerBar, { bottom: 64 + Math.max(insets.bottom, 12) }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {EMOJIS.map((emoji) => (
                <Pressable
                  key={emoji}
                  onPress={() => setInputText((prev) => prev + emoji)}
                  style={styles.emojiChip}
                >
                  <Text style={{ fontSize: 20 }}>{emoji}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Bottom Input Toolbar */}
        <View
          style={[
            styles.inputToolbarContainer,
            {
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          {isRecording ? (
            <View style={styles.recordingContainer}>
              <View style={styles.recordingTopRow}>
                <Text style={styles.recordingTimerText}>{formatDuration(recordingDuration)}</Text>
                <View style={{ flex: 1, marginLeft: 12, justifyContent: 'center' }}>
                  <AnimatedWaveform
                    isAnimating={!isPaused}
                    color="#453332"
                    inactiveColor="rgba(74, 8, 12, 0.2)"
                    barCount={34}
                    height={14}
                  />
                </View>
              </View>

              <View style={styles.recordingBottomRow}>
                <Pressable onPress={cancelRecording} style={styles.trashCircleBtn}>
                  <Trash2 size={20} color="#B91C1C" />
                </Pressable>

                <Pressable onPress={togglePauseRecording} style={styles.pausePillBtn}>
                  {isPaused ? (
                    <>
                      <Mic size={16} color="#3A2E1A" />
                      <Text style={styles.pausePillText}>Resume</Text>
                    </>
                  ) : (
                    <>
                      <Pause size={16} color="#3A2E1A" />
                      <Text style={styles.pausePillText}>Pause</Text>
                    </>
                  )}
                </Pressable>

                <Pressable onPress={stopAndSendRecording} style={styles.sendCircleBtn}>
                  <Send size={20} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.textInputWrapper}>
                <Pressable
                  onPress={() => {
                    Keyboard.dismiss();
                    setShowEmojiPicker((prev) => !prev);
                  }}
                  style={styles.composerIconBtn}
                >
                  <Smile size={21} color={showEmojiPicker ? '#453332' : '#8A7550'} />
                </Pressable>
                <TextInput
                  style={styles.textInput}
                  value={inputText}
                  onChangeText={setInputText}
                  onFocus={() => setShowEmojiPicker(false)}
                  onSubmitEditing={handleSend}
                  submitBehavior="submit"
                  returnKeyType="send"
                  placeholder="Message"
                  placeholderTextColor="#8A7550"
                />
                <Pressable
                  onPress={() => void handlePickImage('library')}
                  disabled={uploadingImage}
                  style={styles.composerIconBtn}
                >
                  {uploadingImage ? (
                    <ActivityIndicator size="small" color="#8A7550" />
                  ) : (
                    <Paperclip size={20} color="#8A7550" />
                  )}
                </Pressable>
                <Pressable
                  onPress={() => void handlePickImage('camera')}
                  disabled={uploadingImage}
                  style={styles.composerIconBtn}
                >
                  <Camera size={20} color="#8A7550" />
                </Pressable>
              </View>

              {inputText.trim() ? (
                <Pressable
                  onPress={handleSend}
                  disabled={!inputText.trim() || sending}
                  style={({ pressed }) => [
                    styles.sendBtn,
                    (!inputText.trim() || sending) && styles.sendBtnDisabled,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Send size={20} color="#FFFFFF" />
                </Pressable>
              ) : (
                <Pressable
                  onPress={startRecording}
                  style={({ pressed }) => [
                    styles.sendBtn,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Mic size={20} color="#FFFFFF" />
                </Pressable>
              )}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
      <MessageDeleteMenu
        visible={selectedMessageForDeletion !== null}
        canDeleteForEveryone={canDeleteSelectedForEveryone}
        busy={deletingMessageId !== null}
        onDeleteForEveryone={handleDeleteSelectedForEveryone}
        onDeleteForMe={handleDeleteSelectedForMe}
        onCancel={() => setSelectedMessageForDeletion(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  timeHeaderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    marginBottom: 14,
  },
  timeHeaderText: {
    fontFamily: 'InstrumentSans-Medium',
    fontSize: 13,
    color: '#8A7550',
    textAlign: 'center',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 36,
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E4D5B7',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfoCol: {
    flex: 1,
    alignItems: 'flex-start',
  },
  headerNameText: {
    fontFamily: 'HedvigLettersSerif-Regular',
    fontSize: 18,
    color: '#453332',
  },
  headerSubtitleText: {
    fontFamily: 'InstrumentSans-Regular',
    fontSize: 12,
    color: '#8A7550',
    marginTop: 2,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 6,
  },
  loadEarlierButton: {
    alignSelf: 'center',
    minHeight: 36,
    paddingHorizontal: 16,
    justifyContent: 'center',
    marginBottom: 12,
  },
  loadEarlierText: {
    color: '#453332',
    fontFamily: 'InstrumentSans-SemiBold',
    fontSize: 13,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(228, 213, 183, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitleText: {
    fontFamily: 'HedvigLettersSerif-Regular',
    fontSize: 18,
    color: '#453332',
    marginBottom: 6,
  },
  emptySubtext: {
    fontFamily: 'InstrumentSans-Regular',
    fontSize: 13,
    color: '#8A7550',
    textAlign: 'center',
    lineHeight: 18,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 4,
  },
  historySection: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(196, 167, 99, 0.38)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 14,
    marginBottom: 10,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 14,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(196, 167, 99, 0.32)',
  },
  historyIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F3E9DE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyTitle: {
    fontFamily: 'HedvigLettersSerif-Regular',
    fontSize: 15,
    color: '#453332',
  },
  historySubtitle: {
    fontFamily: 'InstrumentSans-Regular',
    fontSize: 11,
    color: '#8A7550',
    marginTop: 2,
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
    fontFamily: 'InstrumentSans-SemiBold',
    color: '#C4A763',
    letterSpacing: 2,
  },
  messageBlock: {
    marginBottom: 16,
  },
  lastMessageBlock: {
    marginBottom: 2,
  },
  senderNameText: {
    fontFamily: 'InstrumentSans-SemiBold',
    fontSize: 12,
    color: '#3A2E1A',
    marginLeft: 4,
    marginBottom: 4,
  },
  userSenderName: {
    alignSelf: 'flex-end',
    marginRight: 4,
  },
  bubbleBase: {
    maxWidth: '82%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    overflow: 'visible',
  },
  sentBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#453332',
    borderBottomRightRadius: 4,
  },
  receivedBubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(74, 8, 12, 0.25)',
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontFamily: 'InstrumentSans-Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  sentText: {
    color: '#FFFFFF',
  },
  receivedText: {
    color: '#453332',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-end',
    marginTop: 4,
    marginRight: 2,
  },
  statusText: {
    fontFamily: 'InstrumentSans-Regular',
    fontSize: 10,
    color: '#8A7550',
  },
  sendingIndicatorContainer: {
    alignSelf: 'flex-start',
    marginLeft: 12,
    marginBottom: 12,
  },
  inputToolbarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  recordingContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E4D5B7',
    gap: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  recordingTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recordingTimerText: {
    fontFamily: 'InstrumentSans-SemiBold',
    fontSize: 16,
    color: '#3A2E1A',
    minWidth: 42,
  },
  recordingBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trashCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(185, 28, 28, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pausePillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(58, 46, 26, 0.08)',
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 22,
  },
  pausePillText: {
    fontFamily: 'InstrumentSans-SemiBold',
    fontSize: 14,
    color: '#3A2E1A',
  },
  sendCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#453332',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E4D5B7',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInputWrapper: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E4D5B7',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  textInput: {
    flex: 1,
    fontFamily: 'InstrumentSans-Regular',
    fontSize: 14,
    color: '#3A2E1A',
    height: '100%',
    paddingHorizontal: 8,
  },
  composerIconBtn: {
    width: 32,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiBtn: {
    padding: 4,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#453332',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  emojiPickerBar: {
    position: 'absolute',
    bottom: 74,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E4D5B7',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 10,
  },
  emojiChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4D5B7',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

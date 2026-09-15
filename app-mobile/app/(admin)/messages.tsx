import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Pressable,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ActivityIndicator,
  Image,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Paperclip,
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
import { apiFetch } from '../../src/shared/utils/apiClient';
import BackArrowIcon from '@/shared/components/BackArrowIcon';
import { uploadFile } from '@/shared/utils/upload';
import { useAppAlert } from '@/shared/hooks/useAppAlert';
import { useAuthStore } from '@/stores/useAuthStore';

interface ThreadSummary {
  customerId: string;
  customerName: string;
  customerEmail: string;
  unreadCount: number;
  latestMessage?: string;
  latestAt?: string | null;
}

interface DirectMessage {
  id: string;
  senderType?: 'CUSTOMER' | 'FASHION_HOUSE';
  senderRole?: 'customer' | 'admin' | 'CUSTOMER' | 'FASHION_HOUSE';
  senderId?: string;
  sender?: { id: string; name?: string; role: string };
  content?: string;
  text?: string;
  imageUrl?: string;
  audioUrl?: string;
  audioDuration?: number;
  createdAt: string;
  isRead?: boolean;
}

interface TranscriptTurn {
  role: 'user' | 'model' | 'admin' | 'staff';
  text: string;
  createdAt?: string;
  timestamp?: string | number;
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

export default function AdminMessagesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ customerId?: string; customerName?: string; activeTab?: string; staffId?: string }>();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAppAlert();
  const role = useAuthStore((s) => s.role);

  const [activeTab, setActiveTab] = useState<'customers' | 'staff'>(
    params.activeTab === 'staff' ? 'staff' : 'customers'
  );
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<ThreadSummary | null>(null);

  const [staffList, setStaffList] = useState<any[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);

  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Audio Recording & Playback
  const audioRecorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const timerRef = useRef<any>(null);
  const playerRef = useRef<any>(null);

  const flatListRef = useRef<FlatList>(null);
  const initialOpenedRef = useRef(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const fetchThreads = async (silent = false) => {
    try {
      if (!silent) setLoadingThreads(true);
      const data = await apiFetch<ThreadSummary[]>('/api/direct-messages/threads');
      if (Array.isArray(data)) {
        setThreads(data);

        if (params.customerId && !initialOpenedRef.current) {
          initialOpenedRef.current = true;
          const match = data.find((t) => t.customerId === params.customerId);
          if (match) {
            openThread(match);
          } else {
            const draft: ThreadSummary = {
              customerId: params.customerId,
              customerName: params.customerName || 'Customer',
              customerEmail: '',
              unreadCount: 0,
            };
            openThread(draft);
          }
        }
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

  const fetchStaffList = async () => {
    try {
      setLoadingStaff(true);
      const data = await apiFetch<any[]>('/api/staff');
      if (Array.isArray(data)) {
        setStaffList(data);
      }
    } catch (err) {
      console.error('Error fetching staff list:', err);
    } finally {
      setLoadingStaff(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'staff') {
      fetchStaffList();
    }
  }, [activeTab]);

  const openThread = async (thread: ThreadSummary) => {
    setSelectedCustomer(thread);
    setLoadingMessages(true);
    try {
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
    const textToSend = inputText.trim();
    if (!textToSend || sending || !selectedCustomer) return;
    setInputText('');
    setSending(true);

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: DirectMessage = {
      id: tempId,
      senderType: 'FASHION_HOUSE',
      text: textToSend,
      content: textToSend,
      createdAt: new Date().toISOString(),
      isRead: true,
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const result = await apiFetch<DirectMessage>(`/api/direct-messages/thread/${selectedCustomer.customerId}`, {
        method: 'POST',
        body: JSON.stringify({ text: textToSend, content: textToSend }),
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

  const handlePickImage = async () => {
    if (!selectedCustomer) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showAlert('Permission Required', 'Please allow access to photos to upload images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        setUploadingImage(true);
        const filename = asset.fileName || `chat_${Date.now()}.jpg`;
        const contentType = asset.mimeType || 'image/jpeg';

        try {
          const uploaded = await uploadFile(asset.uri, filename, contentType);
          await apiFetch(`/api/direct-messages/thread/${selectedCustomer.customerId}`, {
            method: 'POST',
            body: JSON.stringify({ imageUrl: uploaded.fileUrl }),
          });
          const data = await apiFetch<{ messages: DirectMessage[] }>(`/api/direct-messages/thread/${selectedCustomer.customerId}`);
          if (data && Array.isArray(data.messages)) setMessages(data.messages);
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
    if (!selectedCustomer) return;
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

      await apiFetch(`/api/direct-messages/thread/${selectedCustomer.customerId}`, {
        method: 'POST',
        body: JSON.stringify({ audioUrl: finalAudioUrl, audioDuration: finalDuration }),
      });
      const data = await apiFetch<{ messages: DirectMessage[] }>(`/api/direct-messages/thread/${selectedCustomer.customerId}`);
      if (data && Array.isArray(data.messages)) setMessages(data.messages);
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
      const formattedDate = date.toLocaleDateString([], { day: 'numeric', month: 'short' });
      return `${formattedDate}, ${timeStr}`;
    }
  };

  const renderThreadItem = ({ item }: { item: ThreadSummary }) => {
    const timeStr = item.latestAt
      ? new Date(item.latestAt).toLocaleDateString([], {
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
            {item.latestMessage || 'No messages yet'}
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
          const timeStr = turn.createdAt
            ? new Date(turn.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : turn.timestamp
            ? new Date(turn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '';

          return (
            <View key={`t-${idx}`} style={styles.messageBlock}>
              {!isUser && (
                <Text style={styles.senderNameText}>Booking Assistant</Text>
              )}
              <View style={[styles.bubbleBase, isUser ? styles.receivedBubble : styles.sentBubble]}>
                <Text style={[styles.bubbleText, isUser ? styles.receivedText : styles.sentText]}>
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
          <Text style={styles.dividerLabel}>DIRECT SUPPORT</Text>
          <View style={styles.dividerLine} />
        </View>
      </View>
    );
  };

  const renderMessageItem = ({ item, index }: { item: DirectMessage; index: number }) => {
    const isFirstMessage = index === 0;
    const prevMsg = messages[index - 1];
    const isDifferentDay =
      prevMsg &&
      new Date(item.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();
    const showDateHeader = isFirstMessage || isDifferentDay;

    const isFashionHouse =
      item.senderRole === 'admin' ||
      item.senderRole === 'FASHION_HOUSE' ||
      item.senderType === 'FASHION_HOUSE' ||
      (item.senderRole !== 'customer' && item.senderType !== 'CUSTOMER');
    const msgBody = item.text || item.content;
    const timeStr = new Date(item.createdAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <React.Fragment key={item.id}>
        {showDateHeader && (
          <View style={styles.timeHeaderContainer}>
            <Text style={styles.timeHeaderText}>{formatDateHeader(item.createdAt)}</Text>
          </View>
        )}
        <View style={styles.messageBlock}>
          {!isFashionHouse && selectedCustomer && (
            <Text style={styles.senderNameText}>
              {selectedCustomer.customerName || item.sender?.name || 'Customer'}
            </Text>
          )}
          <View
            style={[
              styles.bubbleBase,
              isFashionHouse ? styles.sentBubble : styles.receivedBubble,
              item.imageUrl ? { padding: 4 } : null,
            ]}
          >
            {item.imageUrl ? (
              <Image
                source={{ uri: item.imageUrl }}
                style={{
                  width: 220,
                  height: 180,
                  borderRadius: 14,
                }}
                resizeMode="cover"
              />
            ) : null}
            {msgBody ? (
              <Text style={[styles.bubbleText, isFashionHouse ? styles.sentText : styles.receivedText]}>
                {msgBody}
              </Text>
            ) : null}
            {item.audioUrl ? (
              <Pressable
                onPress={() => togglePlayAudio(item.audioUrl!, item.id)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, minWidth: 180 }}
              >
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: isFashionHouse ? 'rgba(255,255,255,0.25)' : 'rgba(74,8,12,0.15)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {playingAudioId === item.id ? (
                    <Pause size={16} color={isFashionHouse ? '#FFFFFF' : '#4A080C'} />
                  ) : (
                    <Play size={16} color={isFashionHouse ? '#FFFFFF' : '#4A080C'} style={{ marginLeft: 2 }} />
                  )}
                </View>
                <View style={{ flex: 1, justifyContent: 'center' }}>
                  <AnimatedWaveform
                    isAnimating={playingAudioId === item.id}
                    color={isFashionHouse ? '#FFFFFF' : '#4A080C'}
                    inactiveColor={isFashionHouse ? 'rgba(255,255,255,0.4)' : 'rgba(74,8,12,0.4)'}
                    barCount={16}
                    height={24}
                  />
                </View>
                <Text style={{ fontFamily: 'WorkSans_500Medium', fontSize: 12, color: isFashionHouse ? 'rgba(255,255,255,0.85)' : '#8A7550', flexShrink: 0 }}>
                  {formatDuration(item.audioDuration || 0)}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {isFashionHouse && (
            <View style={styles.statusRow}>
              <Text style={styles.statusText}>{timeStr}</Text>
              {item.id.startsWith('temp-') ? (
                <Check size={14} color="#8A7550" />
              ) : item.isRead ? (
                <CheckCheck size={14} color="#4A080C" />
              ) : (
                <CheckCheck size={14} color="#8A7550" />
              )}
            </View>
          )}
        </View>
      </React.Fragment>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.headerBar}>
        {selectedCustomer ? (
          <TouchableOpacity style={styles.headerBtn} onPress={() => setSelectedCustomer(null)}>
            <BackArrowIcon size={20} color="#4A080C" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
            <BackArrowIcon size={20} color="#4A080C" />
          </TouchableOpacity>
        )}

        <View style={styles.headerInfoCol}>
          <Text style={styles.headerNameText}>
            {selectedCustomer ? selectedCustomer.customerName : 'Chat'}
          </Text>
          {selectedCustomer && selectedCustomer.customerEmail ? (
            <Text style={styles.headerSubtitleText}>{selectedCustomer.customerEmail}</Text>
          ) : null}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {!selectedCustomer && (
        <View style={styles.segmentedContainer}>
          <Pressable
            onPress={() => setActiveTab('customers')}
            style={[styles.segmentedPill, activeTab === 'customers' && styles.segmentedPillActive]}
          >
            <Text style={[styles.segmentedText, activeTab === 'customers' && styles.segmentedTextActive]}>
              Customers
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab('staff')}
            style={[styles.segmentedPill, activeTab === 'staff' && styles.segmentedPillActive]}
          >
            <Text style={[styles.segmentedText, activeTab === 'staff' && styles.segmentedTextActive]}>
              Staff
            </Text>
          </Pressable>
        </View>
      )}

      {!selectedCustomer ? (
        activeTab === 'customers' ? (
          loadingThreads && threads.length === 0 ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="small" color="#4A080C" />
            </View>
          ) : threads.length === 0 ? (
            <View style={styles.centerContainer}>
              <View style={styles.emptyIconCircle}>
                <MessageSquare size={24} color="#8A7550" />
              </View>
              <Text style={styles.emptyTitleText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>
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
          loadingStaff && staffList.length === 0 ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="small" color="#4A080C" />
            </View>
          ) : staffList.length === 0 ? (
            <View style={styles.centerContainer}>
              <View style={styles.emptyIconCircle}>
                <MessageSquare size={24} color="#8A7550" />
              </View>
              <Text style={styles.emptyTitleText}>No staff messages yet</Text>
              <Text style={styles.emptySubtext}>
                Staff direct messages will appear here when team members reach out.
              </Text>
            </View>
          ) : (
            <FlatList
              data={staffList}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const initial = (item.name || item.email || 'S').charAt(0).toUpperCase();
                const name = item.name || (item.email ? item.email.split('@')[0] : 'Staff Member');
                return (
                  <Pressable
                    style={styles.threadCard}
                    onPress={() => router.push({ pathname: '/(admin)/chat', params: { staffId: item.id } })}
                  >
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{initial}</Text>
                    </View>
                    <View style={styles.threadInfo}>
                      <Text style={styles.customerName}>{name}</Text>
                      <Text style={styles.lastMsgText} numberOfLines={1}>
                        {item.lastMessage || item.email || 'Atelier Floor Staff'}
                      </Text>
                    </View>
                  </Pressable>
                );
              }}
              contentContainerStyle={styles.threadsList}
            />
          )
        )
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {loadingMessages && messages.length === 0 ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="small" color="#4A080C" />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessageItem}
              ListHeaderComponent={renderTranscriptSection}
              contentContainerStyle={styles.scrollContent}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            />
          )}

          {/* Emoji Picker Bar */}
          {showEmojiPicker && (
            <View style={[styles.emojiPickerBar, { bottom: 64 + (keyboardHeight > 0 ? keyboardHeight + 8 : Math.max(insets.bottom, 12)) }]}>
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

          {/* Input Footer */}
          <View
            style={[
              styles.inputToolbarContainer,
              {
                paddingBottom: keyboardHeight > 0 ? 12 : Math.max(insets.bottom, 12),
                marginBottom: keyboardHeight > 0 ? keyboardHeight + 8 : 0,
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
                      color="#4A080C"
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
                    <Send size={18} color="#FFFFFF" style={{ transform: [{ rotate: '45deg' }] }} />
                  </Pressable>
                </View>
              </View>
            ) : (
              <>
                <Pressable
                  onPress={handlePickImage}
                  disabled={uploadingImage}
                  style={({ pressed }) => [styles.toolCircleBtn, { opacity: pressed ? 0.8 : 1 }]}
                >
                  {uploadingImage ? (
                    <ActivityIndicator size="small" color="#4A080C" />
                  ) : (
                    <Paperclip size={18} color="#3A2E1A" />
                  )}
                </Pressable>

                <View style={styles.textInputWrapper}>
                  <TextInput
                    style={styles.textInput}
                    value={inputText}
                    onChangeText={setInputText}
                    onFocus={() => setShowEmojiPicker(false)}
                    onSubmitEditing={handleSend}
                    returnKeyType="send"
                  />
                  <Pressable
                    onPress={() => {
                      Keyboard.dismiss();
                      setShowEmojiPicker((prev) => !prev);
                    }}
                    style={styles.emojiBtn}
                  >
                    <Smile size={20} color={showEmojiPicker ? '#4A080C' : '#8A7550'} />
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
                    <Send size={18} color="#FFFFFF" style={{ transform: [{ rotate: '45deg' }] }} />
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
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBF7EF',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(228, 213, 183, 0.4)',
    backgroundColor: '#FBF7EF',
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
    fontFamily: 'Fraunces-Bold',
    fontSize: 18,
    color: '#4A080C',
  },
  headerSubtitleText: {
    fontFamily: 'WorkSans_400Regular',
    fontSize: 12,
    color: '#8A7550',
    marginTop: 2,
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
    fontFamily: 'Fraunces-Bold',
    fontSize: 18,
    color: '#4A080C',
    marginBottom: 6,
  },
  emptySubtext: {
    fontFamily: 'WorkSans_400Regular',
    fontSize: 13,
    color: '#8A7550',
    textAlign: 'center',
    lineHeight: 18,
  },
  timeHeaderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    marginBottom: 14,
  },
  timeHeaderText: {
    fontFamily: 'WorkSans_500Medium',
    fontSize: 13,
    color: '#8A7550',
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
    fontFamily: 'WorkSans_600SemiBold',
    fontSize: 15,
    color: '#3A2E1A',
  },
  timeText: {
    fontFamily: 'WorkSans_400Regular',
    fontSize: 11,
    color: '#8A7550',
  },
  lastMsgText: {
    fontFamily: 'WorkSans_400Regular',
    fontSize: 13,
    color: '#8A7550',
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
    fontFamily: 'WorkSans_600SemiBold',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
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
    fontFamily: 'WorkSans_600SemiBold',
    color: '#C4A763',
    letterSpacing: 2,
  },
  messageBlock: {
    marginBottom: 16,
  },
  senderNameText: {
    fontFamily: 'WorkSans_600SemiBold',
    fontSize: 12,
    color: '#3A2E1A',
    marginLeft: 4,
    marginBottom: 4,
  },
  bubbleBase: {
    maxWidth: '82%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
  },
  sentBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#4A080C',
    borderBottomRightRadius: 4,
  },
  receivedBubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(74, 8, 12, 0.25)',
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontFamily: 'WorkSans_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  sentText: {
    color: '#FFFFFF',
  },
  receivedText: {
    color: '#4A080C',
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
    fontFamily: 'WorkSans_400Regular',
    fontSize: 10,
    color: '#8A7550',
  },
  inputToolbarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FBF7EF',
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
    fontFamily: 'WorkSans_600SemiBold',
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
    fontFamily: 'WorkSans_600SemiBold',
    fontSize: 14,
    color: '#3A2E1A',
  },
  sendCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4A080C',
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
    paddingHorizontal: 16,
  },
  textInput: {
    flex: 1,
    fontFamily: 'WorkSans_400Regular',
    fontSize: 14,
    color: '#3A2E1A',
    height: '100%',
    paddingRight: 8,
  },
  emojiBtn: {
    padding: 4,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4A080C',
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
    backgroundColor: '#FBF7EF',
    borderWidth: 1,
    borderColor: '#E4D5B7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#EBE0D3',
    borderRadius: 32,
    padding: 3,
    marginHorizontal: 24,
    marginTop: 12,
    marginBottom: 8,
  },
  segmentedPill: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedPillActive: {
    backgroundColor: '#4A080C',
  },
  segmentedText: {
    fontFamily: 'WorkSans_600SemiBold',
    fontSize: 13,
    color: '#3A2E1A',
  },
  segmentedTextActive: {
    color: '#FFFFFF',
  },
});

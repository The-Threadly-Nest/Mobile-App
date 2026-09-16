import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
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
import BackArrowIcon from '@/shared/components/BackArrowIcon';
import { apiFetch } from '../../../src/shared/utils/apiClient';
import { uploadFile } from '@/shared/utils/upload';
import { useAppAlert } from '@/shared/hooks/useAppAlert';
import { useAuthStore } from '@/stores/useAuthStore';
import { StatusBar } from 'expo-status-bar';

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

export default function CustomerDirectChatScreen() {
  const insets = useSafeAreaInsets();
  const { showAlert } = useAppAlert();
  const role = useAuthStore((s) => s.role);
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
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Audio Recording & Playback
  const audioRecorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const timerRef = useRef<any>(null);
  const playerRef = useRef<any>(null);

  const scrollRef = useRef<ScrollView>(null);
  const hasInitialScrolled = useRef(false);
  const displayName = fashionHouseName || 'Fashion House';

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        setTimeout(() => {
          scrollRef.current?.scrollToEnd({ animated: true });
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

  // Scroll to bottom: instant on first load, smooth for each new message after
  useEffect(() => {
    if (messages.length === 0) return;
    if (!hasInitialScrolled.current) {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: false });
        hasInitialScrolled.current = true;
      }, 80);
    } else {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length]);

  const handleSend = async () => {
    const textToSend = inputText.trim();
    if (!textToSend || sending || !fashionHouseId) return;
    setInputText('');
    setSending(true);

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: DirectMessage = {
      id: tempId,
      senderType: 'CUSTOMER',
      text: textToSend,
      content: textToSend,
      createdAt: new Date().toISOString(),
      isRead: false,
    };
    setMessages((prev) => {
      const next = [...prev, optimisticMsg];
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
      return next;
    });

    try {
      const result = await apiFetch<DirectMessage>(`/api/direct-messages/thread/${fashionHouseId}`, {
        method: 'POST',
        body: JSON.stringify({ text: textToSend, content: textToSend }),
      });
      if (result && result.id) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? result : m)));
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const handlePickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showAlert('Permission Required', 'Please allow access to your photos to attach images.');
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
            body: JSON.stringify({ imageUrl: uploaded.fileUrl }),
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
        body: JSON.stringify({ audioUrl: finalAudioUrl, audioDuration: finalDuration }),
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
      const formattedDate = date.toLocaleDateString([], { day: 'numeric', month: 'short' });
      return `${formattedDate}, ${timeStr}`;
    }
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
            <View key={`transcript-${idx}`} style={styles.messageBlock}>
              {!isUser && (
                <Text style={styles.senderNameText}>Booking Assistant</Text>
              )}
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
          <Text style={styles.dividerLabel}>DIRECT SUPPORT</Text>
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
          <BackArrowIcon size={20} color="#4A080C" />
        </Pressable>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          {fashionHouseLogo ? (
            <Image
              source={{ uri: fashionHouseLogo }}
              style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: 'rgba(74,8,12,0.15)' }}
              resizeMode="cover"
            />
          ) : (
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: '#4A080C',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontFamily: 'Fraunces-Bold', fontSize: 16, color: '#FBF7EF' }}>
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
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.scrollContent, { flexGrow: 1, justifyContent: "flex-end" }]}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="small" color="#4A080C" />
            </View>
          ) : (
            <>
              {renderTranscriptSection()}
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
                  const msgBody = msg.text || msg.content;
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
                      <View style={styles.messageBlock}>
                      {!isMe && (
                        <Text style={styles.senderNameText}>{displayName}</Text>
                      )}

                      <View
                        style={[
                          styles.bubbleBase,
                          isMe ? styles.sentBubble : styles.receivedBubble,
                          msg.imageUrl ? { padding: 4 } : null,
                        ]}
                      >
                        {msg.imageUrl ? (
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
                          <Text style={[styles.bubbleText, isMe ? styles.sentText : styles.receivedText]}>
                            {msgBody}
                          </Text>
                        ) : null}
                        {msg.audioUrl ? (
                          <Pressable
                            onPress={() => togglePlayAudio(msg.audioUrl!, msg.id)}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, minWidth: 180 }}
                          >
                            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: isMe ? 'rgba(255,255,255,0.25)' : 'rgba(74,8,12,0.15)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {playingAudioId === msg.id ? (
                                <Pause size={16} color={isMe ? '#FFFFFF' : '#4A080C'} />
                              ) : (
                                <Play size={16} color={isMe ? '#FFFFFF' : '#4A080C'} style={{ marginLeft: 2 }} />
                              )}
                            </View>
                            <View style={{ flex: 1, justifyContent: 'center' }}>
                              <AnimatedWaveform
                                isAnimating={playingAudioId === msg.id}
                                color={isMe ? '#FFFFFF' : '#4A080C'}
                                inactiveColor={isMe ? 'rgba(255,255,255,0.4)' : 'rgba(74,8,12,0.4)'}
                                barCount={16}
                                height={24}
                              />
                            </View>
                            <Text style={{ fontFamily: 'WorkSans_500Medium', fontSize: 12, color: isMe ? 'rgba(255,255,255,0.85)' : '#8A7550', flexShrink: 0 }}>
                              {formatDuration(msg.audioDuration || 0)}
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>

                      {isMe && (
                        <View style={styles.statusRow}>
                          <Text style={styles.statusText}>{timeStr}</Text>
                          {msg.id.startsWith('temp-') ? (
                            <Check size={14} color="#8A7550" />
                          ) : msg.isRead ? (
                            <CheckCheck size={14} color="#4A080C" />
                          ) : (
                            <CheckCheck size={14} color="#8A7550" />
                          )}
                        </View>
                      )}
                    </View>
                  </React.Fragment>
                );
              })
              )}
            </>
          )}

          {uploadingImage && (
            <View style={styles.sendingIndicatorContainer}>
              <ActivityIndicator size="small" color="#4A080C" />
            </View>
          )}
        </ScrollView>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBF7EF',
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
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 36,
    gap: 12,
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
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
});

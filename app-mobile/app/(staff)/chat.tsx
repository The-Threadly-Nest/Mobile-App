import React, { useState, useEffect, useRef } from "react";
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
  Animated,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
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
} from "lucide-react-native";
import { Audio } from "expo-av";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import * as ImagePicker from "expo-image-picker";
import { useAuthStore } from "@/stores/useAuthStore";
import { API_BASE_URL } from "@/api/config";
import { uploadFile } from "@/shared/utils/upload";
import { useAppAlert } from "@/shared/hooks/useAppAlert";

interface ChatMessage {
  id: string;
  sender: "me" | "other";
  senderName?: string;
  text?: string;
  imageUrl?: string;
  audioUrl?: string;
  audioDuration?: number;
  time?: string;
  status?: "Delivered" | "Read";
  timeHeader?: string;
}

const EMOJIS = ["😊", "👍", "✂️", "👗", "✨", "🪡", "🧵", "❤️", "🙌", "🔥", "👌", "👏"];

export default function StaffChatScreen() {
  const params = useLocalSearchParams<{ staffName?: string; fashionHouseName?: string; fashionHouseId?: string }>();
  const token = useAuthStore((s) => s.token);
  const { showAlert } = useAppAlert();

  const [staffName, setStaffName] = useState(params.staffName || "Staff");
  const [adminName, setAdminName] = useState("Fashion House Admin");
  const [fashionHouseName, setFashionHouseName] = useState(params.fashionHouseName || "Atelier");
  const [fashionHouseId, setFashionHouseId] = useState(params.fashionHouseId || "default");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Audio Recording & Playback state
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const timerRef = useRef<any>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardHeight(0)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Fetch logged in staff details & fashion house name
  useEffect(() => {
    (async () => {
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE_URL}/api/staff/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const body = await res.json();
          const fetchedStaffName = body.name || body.user?.name || (body.email ? body.email.split("@")[0] : null);
          const fetchedShopName = body.shopName || body.fashionHouse?.shopName || body.fashionHouse?.name;

          if (fetchedStaffName) {
            const formattedName = fetchedStaffName.charAt(0).toUpperCase() + fetchedStaffName.slice(1);
            setStaffName(formattedName);
          }
          if (body.adminName) {
            setAdminName(body.adminName);
          }
          if (fetchedShopName) {
            setFashionHouseName(fetchedShopName);
          }
          if (body.fashionHouseId) {
            setFashionHouseId(body.fashionHouseId);
          }
        }
      } catch (e) {
        console.warn("Failed to fetch staff details", e);
      }
    })();
  }, [token]);

  // Fetch session history from API
  useEffect(() => {
    (async () => {
      if (!token) return;
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/chat/session/${fashionHouseId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const body = await res.json();
          if (Array.isArray(body.history) && body.history.length > 0) {
            const formatted: ChatMessage[] = body.history.map((h: any, idx: number) => {
              const isMe = h.role === "staff" || h.role === "user";
              // Sent message is Read only if Admin has replied or marked read; otherwise Delivered
              const isRead = idx < body.history.length - 1 || h.read === true;
              return {
                id: `server-${idx}`,
                sender: isMe ? "me" : "other",
                senderName: isMe ? undefined : adminName,
                text: h.text,
                status: isMe ? (isRead ? "Read" : "Delivered") : undefined,
              };
            });
            setMessages(formatted);
          } else {
            setMessages([]);
          }
        }
      } catch (e) {
        console.error("Failed to load chat history", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [fashionHouseId, token, adminName]);

  const handleSend = async () => {
    const textToSend = inputText.trim();
    if (!textToSend || sending) return;

    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "me",
      text: textToSend,
      status: "Delivered",
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputText("");
    setSending(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      if (token) {
        await fetch(`${API_BASE_URL}/api/chat/message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ fashionHouseId, message: textToSend }),
        });
      }
    } catch (e) {
      console.error("Failed to send chat message", e);
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const handlePickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showAlert("Permission Required", "Please allow access to your photos to attach images.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setUploadingImage(true);
        const filename = asset.fileName || `chat-${Date.now()}.jpg`;
        const mimeType = asset.mimeType || "image/jpeg";

        try {
          const uploaded = await uploadFile(asset.uri, filename, mimeType);
          const imageMsg: ChatMessage = {
            id: Date.now().toString(),
            sender: "me",
            imageUrl: uploaded.fileUrl || asset.uri,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: "Delivered",
          };
          setMessages((prev) => [...prev, imageMsg]);
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
        } catch (e: any) {
          showAlert("Upload Error", e.message || "Failed to upload image.");
        } finally {
          setUploadingImage(false);
        }
      }
    } catch (e: any) {
      showAlert("Image Selection Error", e.message || "Failed to pick image.");
    }
  };

  // Audio Recording Handlers
  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        showAlert("Permission Denied", "Microphone permission is required to record voice notes.");
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(newRecording);
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      showAlert("Recording Error", err.message || "Failed to start recording.");
    }
  };

  const cancelRecording = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recording) {
      try {
        await recording.stopAndUnloadAsync();
      } catch {}
      setRecording(null);
    }
    setIsRecording(false);
    setRecordingDuration(0);
  };

  const stopAndSendRecording = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      const finalDuration = recordingDuration;
      setRecording(null);
      setIsRecording(false);
      setRecordingDuration(0);

      if (!uri) return;

      setSending(true);
      const uploaded = await uploadFile(uri, `voice-${Date.now()}.m4a`, "audio/m4a");
      const finalAudioUrl = uploaded.fileUrl || uri;

      const newMsg: ChatMessage = {
        id: Date.now().toString(),
        sender: "me",
        audioUrl: finalAudioUrl,
        audioDuration: finalDuration,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "Delivered",
      };

      setMessages((prev) => [...prev, newMsg]);

      if (token) {
        await fetch(`${API_BASE_URL}/api/chat/message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            fashionHouseId,
            message: "",
            audioUrl: finalAudioUrl,
            audioDuration: finalDuration,
          }),
        });
      }
    } catch (err: any) {
      showAlert("Error", err.message || "Failed to send voice note.");
    } finally {
      setSending(false);
    }
  };

  const togglePlayAudio = async (audioUrl: string, msgId: string) => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      if (playingAudioId === msgId) {
        setPlayingAudioId(null);
        return;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      setPlayingAudioId(msgId);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingAudioId(null);
        }
      });
    } catch (err: any) {
      showAlert("Playback Error", err.message || "Failed to play audio.");
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/(staff)/my-orders" as any);
          }}
          style={({ pressed }) => [styles.headerBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <BackArrowIcon size={20} color="#4A080C" />
        </Pressable>

        <View style={styles.headerInfoCol}>
          <View style={styles.headerNameRow}>
            <Text style={styles.headerNameText}>{staffName}</Text>
          </View>
          <Text style={styles.headerSubtitleText}>{fashionHouseName}</Text>
        </View>
      </View>

      {/* Main Chat Area */}
      <View style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="small" color="#4A080C" />
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.centerContainer}>
              <View style={styles.emptyIconCircle}>
                <MessageSquare size={24} color="#8A7550" />
              </View>
              <Text style={styles.emptyTitleText}>No messages yet</Text>
            </View>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender === "me";

              return (
                <View key={msg.id} style={styles.messageBlock}>
                  {/* Optional Timestamp Banner */}
                  {msg.timeHeader && (
                    <View style={styles.timeHeaderContainer}>
                      <Text style={styles.timeHeaderText}>{msg.timeHeader}</Text>
                    </View>
                  )}

                  {/* Received Sender Name */}
                  {!isMe && msg.senderName && (
                    <Text style={styles.senderNameText}>{msg.senderName}</Text>
                  )}

                  {/* Message Bubble Container */}
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
                    {msg.text ? (
                      <Text style={[styles.bubbleText, isMe ? styles.sentText : styles.receivedText]}>
                        {msg.text}
                      </Text>
                    ) : null}
                    {msg.audioUrl ? (
                      <Pressable
                        onPress={() => togglePlayAudio(msg.audioUrl!, msg.id)}
                        style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6, minWidth: 180 }}
                      >
                        {/* Play / Pause button */}
                        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: isMe ? "rgba(255,255,255,0.25)" : "rgba(74,8,12,0.15)", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {playingAudioId === msg.id ? (
                            <Pause size={16} color={isMe ? "#FFFFFF" : "#4A080C"} />
                          ) : (
                            <Play size={16} color={isMe ? "#FFFFFF" : "#4A080C"} style={{ marginLeft: 2 }} />
                          )}
                        </View>
                        {/* Waveform bars */}
                        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 2, height: 28 }}>
                          {[0.4, 0.7, 0.5, 1.0, 0.6, 0.85, 0.45, 0.9, 0.55, 0.75, 0.4, 0.65, 0.8, 0.5, 0.7, 0.45, 0.9, 0.6, 0.5, 0.7].map((h, i) => (
                            <View
                              key={i}
                              style={{
                                width: 3,
                                height: `${h * 100}%` as any,
                                borderRadius: 2,
                                backgroundColor:
                                  playingAudioId === msg.id
                                    ? (isMe ? "rgba(255,255,255,0.9)" : "#4A080C")
                                    : (isMe ? "rgba(255,255,255,0.5)" : "rgba(74,8,12,0.4)"),
                              }}
                            />
                          ))}
                        </View>
                        {/* Duration */}
                        <Text style={{ fontFamily: "WorkSans_500Medium", fontSize: 12, color: isMe ? "rgba(255,255,255,0.85)" : "#8A7550", flexShrink: 0 }}>
                          {formatDuration(msg.audioDuration || 0)}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>

                  {/* Sent Status Row (Read / Delivered) */}
                  {isMe && (
                    <View style={styles.statusRow}>
                      {msg.status === "Read" ? (
                        <>
                          <CheckCheck size={13} color="#2E7D32" />
                          <Text style={[styles.statusText, { color: "#2E7D32" }]}>Read</Text>
                        </>
                      ) : (
                        <>
                          <Check size={13} color="#8A7550" />
                          <Text style={styles.statusText}>Delivered</Text>
                        </>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}

          {uploadingImage && (
            <View style={styles.sendingIndicatorContainer}>
              <ActivityIndicator size="small" color="#4A080C" />
            </View>
          )}
        </ScrollView>

        {/* Emoji Bar Popup */}
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

        {/* Bottom Input Toolbar */}
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
            <View style={styles.recordingBar}>
              <Pressable onPress={cancelRecording} style={styles.trashBtn}>
                <Trash2 size={20} color="#DC2626" />
              </Pressable>
              <View style={styles.recordingTimerCol}>
                <View style={styles.redPulseDot} />
                <Text style={styles.recordingTimerText}>{formatDuration(recordingDuration)}</Text>
              </View>
              <Pressable onPress={stopAndSendRecording} style={styles.sendBtn}>
                <Send size={18} color="#FFFFFF" style={{ transform: [{ rotate: "45deg" }] }} />
              </Pressable>
            </View>
          ) : (
            <>
              {/* Attachment / Paperclip Button */}
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

              {/* Text Input Container */}
              <View style={styles.textInputWrapper}>
                <TextInput
                  style={styles.textInput}
                  value={inputText}
                  onChangeText={setInputText}
                  onFocus={() => setShowEmojiPicker(false)}
                  placeholder="Type a message..."
                  placeholderTextColor="#8A7550"
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
                  <Smile size={20} color={showEmojiPicker ? "#4A080C" : "#8A7550"} />
                </Pressable>
              </View>

              {/* Dynamic WhatsApp Mic vs Send Switcher */}
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
                  <Send size={18} color="#FFFFFF" style={{ transform: [{ rotate: "45deg" }] }} />
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FBF7EF",
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(228, 213, 183, 0.4)",
    backgroundColor: "#FBF7EF",
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E4D5B7",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  headerInfoCol: {
    flex: 1,
    alignItems: "flex-start",
  },
  headerNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerNameText: {
    fontFamily: "Fraunces-Bold",
    fontSize: 18,
    color: "#4A080C",
  },
  headerSubtitleText: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 12,
    color: "#8A7550",
    marginTop: 2,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(228, 213, 183, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitleText: {
    fontFamily: "Fraunces-Bold",
    fontSize: 18,
    color: "#4A080C",
    marginBottom: 6,
  },
  emptySubtext: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 13,
    color: "#8A7550",
    textAlign: "center",
    lineHeight: 18,
  },
  messageBlock: {
    marginBottom: 16,
  },
  timeHeaderContainer: {
    alignItems: "center",
    marginVertical: 12,
  },
  timeHeaderText: {
    fontFamily: "WorkSans_500Medium",
    fontSize: 11,
    color: "#8A7550",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  senderNameText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 12,
    color: "#3A2E1A",
    marginLeft: 4,
    marginBottom: 4,
  },
  bubbleBase: {
    maxWidth: "82%",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
  },
  sentBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#4A080C",
    borderBottomRightRadius: 4,
  },
  receivedBubble: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(74, 8, 12, 0.25)",
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 14,
    lineHeight: 20,
  },
  sentText: {
    color: "#FFFFFF",
  },
  receivedText: {
    color: "#4A080C",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    alignSelf: "flex-end",
    marginTop: 4,
    marginRight: 2,
  },
  statusText: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 10,
    color: "#8A7550",
  },
  sendingIndicatorContainer: {
    alignSelf: "flex-start",
    marginLeft: 12,
    marginBottom: 12,
  },
  inputToolbarContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FBF7EF",
  },
  recordingBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#E4D5B7",
  },
  trashBtn: {
    padding: 8,
  },
  recordingTimerCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  redPulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#DC2626",
  },
  recordingTimerText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 15,
    color: "#3A2E1A",
  },
  toolCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E4D5B7",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  textInputWrapper: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E4D5B7",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  textInput: {
    flex: 1,
    fontFamily: "WorkSans_400Regular",
    fontSize: 14,
    color: "#3A2E1A",
    height: "100%",
    paddingRight: 8,
  },
  emojiBtn: {
    padding: 4,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#4A080C",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  emojiPickerBar: {
    position: "absolute",
    bottom: 74,
    left: 16,
    right: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#E4D5B7",
    shadowColor: "#000000",
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
    backgroundColor: "#FBF7EF",
    borderWidth: 1,
    borderColor: "#E4D5B7",
    alignItems: "center",
    justifyContent: "center",
  },
});

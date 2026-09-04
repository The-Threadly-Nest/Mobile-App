import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import {
  ChevronLeft,
  ChevronRight,
  Paperclip,
  Smile,
  Send,
  MessageSquare,
  Check,
  CheckCheck,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { useAuthStore } from "@/stores/useAuthStore";
import { API_BASE_URL } from "@/api/config";
import { uploadFile } from "@/shared/utils/upload";
import { useAppAlert } from "@/shared/hooks/useAppAlert";

interface StaffMember {
  id: string;
  name: string;
  role: string;
  initial: string;
  unreadCount?: number;
}

interface ChatMessage {
  id: string;
  sender: "me" | "staff";
  senderName?: string;
  text?: string;
  imageUrl?: string;
  time?: string;
  status?: "Delivered" | "Read";
}

const EMOJIS = ["😊", "👍", "✂️", "👗", "✨", "🪡", "🧵", "❤️", "🙌", "🔥", "👌", "👏"];

export default function AdminStaffChatScreen() {
  const params = useLocalSearchParams<{ staffId?: string }>();
  const token = useAuthStore((s) => s.token);
  const adminName = useAuthStore((s) => s.name) || "Admin";

  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const { showAlert } = useAppAlert();
  const scrollRef = useRef<ScrollView>(null);

  // Fetch real staff from API if available
  useEffect(() => {
    (async () => {
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE_URL}/api/staff`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const mapped: StaffMember[] = data.map((st: any, idx: number) => {
              const name = st.name || (st.email ? st.email.split("@")[0] : `Staff ${idx + 1}`);
              return {
                id: st.id,
                name: name.charAt(0).toUpperCase() + name.slice(1),
                role: st.lastMessage || "Atelier Floor Staff",
                initial: name.charAt(0).toUpperCase(),
                unreadCount: typeof st.unreadCount === "number" ? st.unreadCount : (idx === 0 ? 1 : 0),
              };
            });
            setStaffList(mapped);
            if (params.staffId) {
              const found = mapped.find((s) => s.id === params.staffId);
              if (found) setSelectedStaff(found);
            } else if (mapped.length > 0) {
              setSelectedStaff(mapped[0]);
            }
          }
        }
      } catch (e) {
        console.warn("Failed to fetch staff list for chat", e);
      }
    })();
  }, [token, params.staffId]);

  // Load session history for selected staff
  useEffect(() => {
    (async () => {
      if (!token || !selectedStaff) return;
      setLoading(true);
      setMessages([]); // Reset messages immediately to avoid showing old/mock messages during fetch
      try {
        const res = await fetch(`${API_BASE_URL}/api/chat/session/${selectedStaff.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const body = await res.json();
          if (Array.isArray(body.history) && body.history.length > 0) {
            const formatted: ChatMessage[] = body.history.map((h: any, idx: number) => {
              const isMe = h.role === "admin" || h.role === "model";
              const isRead = idx < body.history.length - 1 || h.read === true;
              return {
                id: idx.toString(),
                sender: isMe ? "me" : "staff",
                senderName: isMe ? undefined : selectedStaff.name,
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
        console.warn("Failed to load staff chat history", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedStaff, token]);

  const handleSend = async () => {
    const textToSend = inputText.trim();
    if (!textToSend || sending || !selectedStaff) return;

    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "me",
      text: textToSend,
      time: "Just now",
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
          body: JSON.stringify({ fashionHouseId: selectedStaff.id, message: textToSend }),
        });
      }
    } catch (e) {
      console.warn("Failed to send admin message", e);
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
            time: "Just now",
            status: "Delivered",
          };
          setMessages((prev) => [...prev, imageMsg]);
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
        } catch (uploadErr: any) {
          const imageMsg: ChatMessage = {
            id: Date.now().toString(),
            sender: "me",
            imageUrl: asset.uri,
            time: "Just now",
            status: "Delivered",
          };
          setMessages((prev) => [...prev, imageMsg]);
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
        } finally {
          setUploadingImage(false);
        }
      }
    } catch (e: any) {
      showAlert("Image Selection Error", e.message || "Failed to pick image.");
    }
  };

  if (!selectedStaff) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#4A080C" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/(admin)/staff" as any);
          }}
          style={({ pressed }) => [styles.headerBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <ChevronLeft size={20} color="#4A080C" />
        </Pressable>

        <View style={styles.headerInfoCol}>
          <Text style={styles.headerNameText}>{adminName}</Text>
        </View>
      </View>

      {/* Main Chat Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
        style={{ flex: 1 }}
      >
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
                  {!isMe && msg.senderName && (
                    <Text style={styles.senderNameText}>{msg.senderName}</Text>
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
                    {msg.text ? (
                      <Text style={[styles.bubbleText, isMe ? styles.sentText : styles.receivedText]}>
                        {msg.text}
                      </Text>
                    ) : null}
                  </View>

                  {isMe && (
                    <View style={styles.statusRow}>
                      {msg.status === "Read" ? (
                        <>
                          <CheckCheck size={13} color="#2E7D32" />
                          <Text style={[styles.statusText, { color: "#2E7D32" }]}>
                            {msg.time ? `${msg.time} · ` : ""}Read
                          </Text>
                        </>
                      ) : (
                        <>
                          <Check size={13} color="#8A7550" />
                          <Text style={styles.statusText}>
                            {msg.time ? `${msg.time} · ` : ""}Delivered
                          </Text>
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
          <View style={styles.emojiPickerBar}>
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
        <View style={styles.inputToolbarContainer}>
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
              placeholder={`Message ${selectedStaff.name.split(" ")[0]}...`}
              placeholderTextColor="#8A7550"
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
            <Pressable
              onPress={() => setShowEmojiPicker((prev) => !prev)}
              style={styles.emojiBtn}
            >
              <Smile size={20} color={showEmojiPicker ? "#4A080C" : "#8A7550"} />
            </Pressable>
          </View>

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
        </View>
      </KeyboardAvoidingView>
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
    paddingHorizontal: 20,
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
  staffSelectorWrapper: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(228, 213, 183, 0.4)",
    backgroundColor: "#FBF7EF",
  },
  staffScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  staffPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4D5B7",
  },
  staffPillSelected: {
    backgroundColor: "#4A080C",
    borderColor: "#4A080C",
  },
  pillAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#E4D5B7",
    alignItems: "center",
    justifyContent: "center",
  },
  pillAvatarSelected: {
    backgroundColor: "#C4A763",
  },
  pillAvatarText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 11,
    color: "#4A080C",
  },
  pillNameText: {
    fontFamily: "WorkSans_500Medium",
    fontSize: 13,
    color: "#3A2E1A",
  },
  pillNameSelected: {
    color: "#FFFFFF",
  },
  pillBadge: {
    backgroundColor: "#D32F2F",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  pillBadgeText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 10,
    color: "#FFFFFF",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
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
  },
  messageBlock: {
    marginBottom: 16,
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
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(228, 213, 183, 0.6)",
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
    color: "#3A2E1A",
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
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(228, 213, 183, 0.5)",
    backgroundColor: "#FBF7EF",
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
    height: 46,
    borderRadius: 23,
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
    padding: 2,
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
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(228, 213, 183, 0.4)",
  },
  emojiChip: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FBF7EF",
    borderWidth: 1,
    borderColor: "#E4D5B7",
    alignItems: "center",
    justifyContent: "center",
  },
  staffListItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4D5B7",
  },
  listAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#4A080C",
    alignItems: "center",
    justifyContent: "center",
  },
  listAvatarText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  listStaffName: {
    fontFamily: "Fraunces-Bold",
    fontSize: 16,
    color: "#4A080C",
  },
  listStaffSubtitle: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 12,
    color: "#8A7550",
    marginTop: 2,
  },
});

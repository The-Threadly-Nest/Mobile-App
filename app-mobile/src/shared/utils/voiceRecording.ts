import { Platform } from "react-native";
import { RecordingPresets } from "expo-audio";

// LOW_QUALITY uses AMR/3GP on Android, which must not be uploaded as M4A.
export const VOICE_RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  sampleRate: 24000,
  bitRate: 32000,
  web: { ...RecordingPresets.HIGH_QUALITY.web, bitsPerSecond: 32000 },
  isMeteringEnabled: true,
};

export function voiceAttachment(prefix = "voice") {
  return Platform.OS === "web"
    ? { filename: `${prefix}_${Date.now()}.webm`, contentType: "audio/webm" }
    : { filename: `${prefix}_${Date.now()}.m4a`, contentType: "audio/mp4" };
}

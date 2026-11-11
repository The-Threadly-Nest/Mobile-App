import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { useAppAlert } from "./useAppAlert";

type Entry = { player: ReturnType<typeof createAudioPlayer>; subscription: { remove: () => void }; finished: boolean };

/** Retain a few buffered notes for replay; release native resources on leaving. */
export function useVoicePlayback() {
  const { showAlert } = useAppAlert();
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const players = useRef(new Map<string, Entry>());
  const active = useRef<{ id: string; entry: Entry } | null>(null);
  const revision = useRef(0);
  const stopPlayback = () => {
    revision.current++;
    active.current?.entry.player.pause();
    active.current = null;
    setPlayingAudioId(null);
  };
  useFocusEffect(useCallback(() => {
    setPlayingAudioId(null);
    return () => {
      revision.current++;
      active.current = null;
      for (const entry of players.current.values()) { entry.subscription.remove(); entry.player.remove(); }
      players.current.clear();
    };
  }, []));
  const togglePlayAudio = async (url: string, id: string) => {
    const request = ++revision.current;
    const previous = active.current;
    previous?.entry.player.pause();
    active.current = null;
    setPlayingAudioId(null);
    if (previous?.id === id) return;
    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (revision.current !== request) return;
      let entry = players.current.get(url);
      if (!entry) {
        const player = createAudioPlayer(url, { downloadFirst: false, updateInterval: 100 });
        const created: Entry = { player, subscription: { remove() {} }, finished: false };
        created.subscription = player.addListener("playbackStatusUpdate", status => {
          if (status.didJustFinish) {
            created.finished = true;
            if (active.current?.entry === created) { active.current = null; setPlayingAudioId(null); }
          }
        });
        entry = created;
        players.current.set(url, entry);
      } else {
        players.current.delete(url); players.current.set(url, entry);
      }
      while (players.current.size > 4) {
        const key = players.current.keys().next().value!;
        const oldest = players.current.get(key)!;
        oldest.subscription.remove(); oldest.player.remove(); players.current.delete(key);
      }
      if (entry.finished) { await entry.player.seekTo(0); entry.finished = false; }
      if (revision.current !== request) return;
      entry.player.setPlaybackRate(1);
      active.current = { id, entry };
      setPlayingAudioId(id);
      entry.player.play();
    } catch (error) {
      if (revision.current !== request) return;
      active.current = null; setPlayingAudioId(null);
      showAlert("Couldn't play voice note", error instanceof Error ? error.message : "Please try again.");
    }
  };
  return { playingAudioId, togglePlayAudio, stopPlayback };
}

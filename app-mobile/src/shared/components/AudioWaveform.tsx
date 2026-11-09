import React, { useEffect, useRef, useState } from "react";
import { Animated, View } from "react-native";
import { meterAmplitude } from "../utils/audioMetering";

export default function AudioWaveform({ isAnimating, color, inactiveColor, barCount = 34, height = 14, live = false, metering }: {
  isAnimating: boolean; color: string; inactiveColor?: string; barCount?: number; height?: number; live?: boolean; metering?: number;
}) {
  const [bars, setBars] = useState(() => Array.from({ length: barCount }, () => 0.08));
  const sample = useRef(metering);
  sample.current = metering;
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!live || !isAnimating) return;
    const timer = setInterval(() => setBars(previous => [...previous.slice(-(barCount - 1)), meterAmplitude(sample.current)]), 100);
    return () => clearInterval(timer);
  }, [live, isAnimating, barCount]);
  useEffect(() => {
    if (live || !isAnimating) { pulse.setValue(1); return; }
    // Stored messages have no waveform samples in the API: indicate playback,
    // rather than pretending random values are the original recording's levels.
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.5, duration: 500, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [live, isAnimating, pulse]);
  return <Animated.View accessibilityLabel={live ? "Microphone level" : "Audio playback indicator"} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", height, flex: 1, opacity: pulse }}>
    {(live ? bars : Array.from({ length: barCount }, (_, i) => 0.25 + (i % 5) * 0.14)).map((level, i) => <View key={i} style={{ width: 2.5, height: Math.max(2, level * height), borderRadius: 1.5, backgroundColor: isAnimating ? color : inactiveColor || color }} />)}
  </Animated.View>;
}

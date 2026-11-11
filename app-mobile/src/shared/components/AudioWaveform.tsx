import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing } from "react-native";
import { meterAmplitude, waveScale } from "../utils/audioMetering";

export default function AudioWaveform({ isAnimating, color, inactiveColor, barCount = 34, height = 14, live = false, metering }: {
  isAnimating: boolean; color: string; inactiveColor?: string; barCount?: number; height?: number; live?: boolean; metering?: number;
}) {
  const phase = useRef(new Animated.Value(0)).current;
  const loudness = useRef(new Animated.Value(0.3)).current;
  const inputRange = useMemo(() => Array.from({ length: 25 }, (_, i) => i / 24), []);
  const waves = useMemo(() => Array.from({ length: barCount }, (_, index) => phase.interpolate({
    inputRange, outputRange: inputRange.map(value => waveScale(value, index)),
  })), [barCount, phase, inputRange]);
  useEffect(() => {
    const animation = Animated.timing(loudness, {
      toValue: live ? 0.3 + meterAmplitude(metering) * 0.7 : 1,
      duration: 90, useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [live, metering, loudness]);
  useEffect(() => {
    if (!isAnimating) return;
    phase.setValue(0);
    // Continuous native-driver movement between microphone readings.
    const animation = Animated.loop(Animated.timing(phase, {
      toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true,
    }));
    animation.start();
    return () => animation.stop();
  }, [isAnimating, phase]);
  return <Animated.View accessibilityLabel={live ? "Live recording waveform" : "Audio playback indicator"} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", height, flex: 1 }}>
    {waves.map((wave, index) => <Animated.View key={index} style={{ width: 2.5, height, borderRadius: 1.5, backgroundColor: isAnimating ? color : inactiveColor || color, transform: [{ scaleY: Animated.multiply(wave, loudness) }] }} />)}
  </Animated.View>;
}

import React, { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, StyleSheet, View } from "react-native";
import { Text } from "@/shared/components/Typography";
import { StatusBar } from "expo-status-bar";
import Svg, { Path } from "react-native-svg";

const MARK_HEIGHT = 48;
const MARK_WIDTH = MARK_HEIGHT * 3485 / 3976;
// The supplied PNG has transparent margins. Align its visible artwork with
// the animated vector without stretching or changing the original asset.
const ASSET_SCALE = MARK_HEIGHT / 3976;

// Exact vector paths from Figma node 295:4412, in their original viewBox.
const paths = [
  "M1142.09 537.07C1134.45 523.902 1124.53 512.196 1112.8 502.503L693.027 158.309C660.758 133.674 621.285 120.33 580.687 120.33C540.089 120.33 500.617 133.674 468.348 158.309L46.8197 504.262C36.1359 512.586 26.7567 522.459 18.9918 533.555C4.49213 509.351 -0.537665 480.637 4.87085 452.946C10.2794 425.254 25.7435 400.541 48.2849 383.571L469.812 38.2076C502.021 13.4325 541.517 0 582.152 0C622.787 0 662.282 13.4325 694.491 38.2076L1114.26 382.402C1137.99 399.59 1154.14 425.295 1159.32 454.129C1164.51 482.964 1158.34 512.69 1142.09 537.07Z",
  "M92.5209 605.028L49.7523 639.885C40.2599 647.577 31.8802 656.549 24.8529 666.543C9.84299 648.174 1.16474 625.451 0.109145 601.753C-0.946454 578.054 5.67754 554.648 18.9948 535.017C26.728 548.032 36.636 559.626 48.288 569.291L92.5209 605.028Z",
  "M998.256 663.613L1069.73 722.199L690.678 1032.71C658.449 1057.43 618.962 1070.84 578.339 1070.84C537.717 1070.84 498.229 1057.43 466 1032.71L89.5835 723.958L163.695 663.32L468.929 913.484C501.158 938.212 540.646 951.613 581.269 951.613C621.891 951.613 661.379 938.212 693.608 913.484L998.256 663.613Z",
  "M1137.12 660.087C1130.84 651.984 1123.66 644.614 1115.73 638.117L1072.38 602.674L1115.15 567.813C1125.76 559.412 1135.13 549.55 1142.98 538.52C1154.24 557.054 1159.71 578.535 1158.66 600.199C1157.62 621.864 1150.11 642.722 1137.12 660.087Z",
  "M46.2475 688.517L89.6017 723.964L46.8331 759.115C36.2781 767.579 26.9176 777.433 19.0052 788.408C7.57531 769.663 2.02434 747.922 3.06861 725.992C4.11288 704.062 11.704 682.952 24.8632 665.378C30.9945 673.957 38.179 681.729 46.2475 688.517Z",
  "M1072.37 602.683L998.263 663.318L693.029 413.153C660.8 388.425 621.312 375.024 580.689 375.024C540.067 375.024 500.579 388.425 468.35 413.153L163.702 663.611L92.52 605.025L471.28 294.518C503.448 269.649 542.958 256.157 583.619 256.157C624.279 256.157 663.79 269.649 695.958 294.518L1072.37 602.683Z",
  "M1142.09 791.916C1134.45 778.747 1124.54 767.041 1112.8 757.348L1069.74 721.905L1112.21 686.754C1121.77 679.136 1130.16 670.154 1137.11 660.096C1152.01 678.608 1160.55 701.432 1161.45 725.18C1162.34 748.928 1155.55 772.332 1142.09 791.916Z",
  "M1112.8 941.61L691.27 1287.27C659.001 1311.91 619.529 1325.25 578.931 1325.25C538.333 1325.25 498.861 1311.91 466.592 1287.27L46.8213 943.076C23.4514 925.874 7.59048 900.342 2.51952 871.771C-2.55144 843.199 3.55594 813.774 19.5789 789.58C27.3893 802.54 37.2869 814.118 48.872 823.851L468.35 1168.34C500.559 1193.11 540.054 1206.55 580.689 1206.55C621.324 1206.55 660.82 1193.11 693.028 1168.34L1114.56 822.971C1125.34 814.196 1134.73 803.826 1142.38 792.216C1156.82 816.364 1161.78 845.004 1156.31 872.6C1150.85 900.196 1135.34 924.785 1112.8 941.61Z"
];

export default function AnimatedBrandSplash({ onComplete, ready }: { onComplete: () => void; ready: boolean }) {
  const pieces = useRef(paths.map(() => new Animated.Value(0))).current;
  const name = useRef(new Animated.Value(0)).current;
  const complete = useRef(onComplete);
  complete.current = onComplete;

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    let animation: Animated.CompositeAnimation | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const start = async () => {
      const reducedMotion = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
      if (cancelled) return;
      if (reducedMotion) {
        pieces.forEach(piece => piece.setValue(1));
        name.setValue(1);
        timer = setTimeout(() => complete.current(), 450);
        return;
      }
      animation = Animated.sequence([
        Animated.stagger(260, pieces.map(piece => Animated.timing(piece, {
          toValue: 1, duration: 500, useNativeDriver: true,
        }))),
        Animated.timing(name, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.delay(650),
      ]);
      animation.start(({ finished }) => {
        if (finished && !cancelled) complete.current();
      });
    };
    void start();
    return () => {
      cancelled = true;
      animation?.stop();
      if (timer) clearTimeout(timer);
    };
  }, [pieces, name, ready]);

  return (
    <View style={styles.screen} accessibilityLabel="Owuja" accessibilityRole="image">
      <StatusBar style="light" />
      <View style={styles.brand} importantForAccessibility="no-hide-descendants">
        <View style={styles.mark}>
          {paths.map((d, index) => (
            <Animated.View key={index} style={[StyleSheet.absoluteFill, {
              opacity: Animated.multiply(pieces[index], name.interpolate({ inputRange: [0, 1], outputRange: [1, 0] })),
              transform: [{ translateY: pieces[index].interpolate({ inputRange: [0, 1], outputRange: [5, 0] }) }],
            }]}>
              <Svg width={MARK_WIDTH} height={MARK_HEIGHT} viewBox="0 0 1161.52 1325.25" fill="none">
                <Path d={d} fill="#FFFFFF" />
              </Svg>
            </Animated.View>
          ))}
          <Animated.Image
            source={require("../../../assets/splash-icon-white.png")}
            resizeMode="contain"
            style={[styles.finalMark, { opacity: name }]}
          />
        </View>
        <Animated.View style={[styles.namePosition, { opacity: name }]}>
          <Text style={styles.name}>Owuja</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, width: "100%", backgroundColor: "#F96951", alignItems: "center", justifyContent: "center" },
  // Keep the complete logo-and-name lockup centred throughout the animation.
  brand: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  mark: { width: MARK_WIDTH, height: MARK_HEIGHT, overflow: "hidden" },
  finalMark: { position: "absolute", width: 4389 * ASSET_SCALE, height: 4389 * ASSET_SCALE, left: -452 * ASSET_SCALE, top: -208 * ASSET_SCALE },
  namePosition: { height: MARK_HEIGHT, justifyContent: "center" },
  name: { fontFamily: "InstrumentSans-Medium", fontSize: 40, lineHeight: MARK_HEIGHT, includeFontPadding: false, color: "#FFFFFF" },
});


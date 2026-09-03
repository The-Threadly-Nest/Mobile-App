import React, { useState, useRef } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  PanResponder,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import Svg, { Path, Rect, Circle, G } from "react-native-svg";
import { X, Undo2, RotateCcw, Check, Paintbrush, Eraser, User, Grid } from "lucide-react-native";
import { Input } from "./Input";
import { Button } from "./Button";

interface PathData {
  color: string;
  strokeWidth: number;
  d: string;
}

interface DrawingCanvasModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (svgDataUri: string, title: string) => Promise<void>;
}

const COLORS = [
  "#4A080C", // Oxblood
  "#C4A763", // Gold
  "#3A2E1A", // Ink
  "#292D32", // Charcoal
  "#D32F2F", // Red
  "#1E88E5", // Blue
  "#43A047", // Green
  "#FBF7EF", // Eraser (Background cream)
];

const STROKE_WIDTHS = [
  { label: "Fine", value: 2 },
  { label: "Medium", value: 5 },
  { label: "Thick", value: 10 },
];

const SKETCH_CHIPS = [
  "Corset Detail",
  "A-Line Silhouette",
  "Sleeve Detail",
  "Bespoke Jacket",
  "Agbada Embroidery",
  "Draft Pattern",
];

export default function DrawingCanvasModal({
  visible,
  onClose,
  onSave,
}: DrawingCanvasModalProps) {
  const [paths, setPaths] = useState<PathData[]>([]);
  const [currentPath, setCurrentPath] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("#4A080C");
  const [selectedWidth, setSelectedWidth] = useState<number>(5);
  const [bgGuide, setBgGuide] = useState<"blank" | "croquis" | "grid">("croquis");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedColorRef = useRef(selectedColor);
  selectedColorRef.current = selectedColor;

  const selectedWidthRef = useRef(selectedWidth);
  selectedWidthRef.current = selectedWidth;

  const currentPathRef = useRef<string>("");

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const startPoint = `M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
        currentPathRef.current = startPoint;
        setCurrentPath(startPoint);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const nextPoint = ` L ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
        currentPathRef.current += nextPoint;
        setCurrentPath(currentPathRef.current);
      },
      onPanResponderRelease: () => {
        if (currentPathRef.current) {
          setPaths((prev) => [
            ...prev,
            {
              color: selectedColorRef.current,
              strokeWidth: selectedWidthRef.current,
              d: currentPathRef.current,
            },
          ]);
          currentPathRef.current = "";
          setCurrentPath("");
        }
      },
    })
  ).current;

  const handleUndo = () => {
    setPaths((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPaths([]);
    setCurrentPath("");
    currentPathRef.current = "";
  };

  const handleSave = async () => {
    if (paths.length === 0) {
      setError("Please draw something before saving.");
      return;
    }
    if (!title.trim()) {
      setError("Please enter a title for your drawing.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      // Build SVG String
      const width = 340;
      const height = 340;
      const pathElements = paths
        .map(
          (p) =>
            `<path d="${p.d}" stroke="${p.color}" stroke-width="${p.strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round" />`
        )
        .join("\n");

      const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="100%" height="100%" fill="#FBF7EF" />
${pathElements}
</svg>`;

      const encodedSvg = encodeURIComponent(svgString);
      const dataUri = `data:image/svg+xml;utf8,${encodedSvg}`;

      await onSave(dataUri, title.trim());
      handleClear();
      setTitle("");
      onClose();
    } catch (e: any) {
      setError(e.message ?? "Failed to save drawing.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleRow}>
              <Paintbrush size={20} color="#4A080C" />
              <Text style={styles.headerTitle}>Fashion Sketchpad</Text>
            </View>

            {/* Guide Mode Selector */}
            <View style={styles.guideToggleRow}>
              <Pressable
                onPress={() => setBgGuide("croquis")}
                style={[
                  styles.guideBtn,
                  bgGuide === "croquis" && styles.guideBtnActive,
                ]}
              >
                <User size={13} color={bgGuide === "croquis" ? "#FFFFFF" : "#4A080C"} />
              </Pressable>
              <Pressable
                onPress={() => setBgGuide("grid")}
                style={[styles.guideBtn, bgGuide === "grid" && styles.guideBtnActive]}
              >
                <Grid size={13} color={bgGuide === "grid" ? "#FFFFFF" : "#4A080C"} />
              </Pressable>
              <Pressable
                onPress={() => setBgGuide("blank")}
                style={[styles.guideBtn, bgGuide === "blank" && styles.guideBtnActive]}
              >
                <Text
                  style={[
                    styles.guideBtnText,
                    bgGuide === "blank" && { color: "#FFFFFF" },
                  ]}
                >
                  Clear
                </Text>
              </Pressable>
            </View>

            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#4A080C" />
            </Pressable>
          </View>

          {/* Canvas Area */}
          <View style={styles.canvasContainer} {...panResponder.panHandlers}>
            <Svg width={340} height={340} viewBox="0 0 340 340">
              <Rect width="100%" height="100%" fill="#FBF7EF" />

              {/* Background Guide: Fashion Croquis (Mannequin Silhouette) */}
              {bgGuide === "croquis" && (
                <G opacity={0.35}>
                  {/* Head & Neck */}
                  <Circle cx={170} cy={55} r={18} stroke="#8A7550" strokeWidth="1.2" fill="none" />
                  <Path d="M 166 73 L 166 88 M 174 73 L 174 88" stroke="#8A7550" strokeWidth="1.2" />

                  {/* Shoulders & Bust */}
                  <Path d="M 125 102 C 145 92, 195 92, 215 102" stroke="#8A7550" strokeWidth="1.4" fill="none" />
                  <Path d="M 125 102 C 122 135, 140 160, 152 175" stroke="#8A7550" strokeWidth="1.2" fill="none" />
                  <Path d="M 215 102 C 218 135, 200 160, 188 175" stroke="#8A7550" strokeWidth="1.2" fill="none" />

                  {/* Waist & Hips */}
                  <Path d="M 152 175 C 160 178, 180 178, 188 175" stroke="#8A7550" strokeWidth="1.4" fill="none" />
                  <Path d="M 152 175 C 142 205, 138 240, 148 290" stroke="#8A7550" strokeWidth="1.2" fill="none" />
                  <Path d="M 188 175 C 198 205, 202 240, 192 290" stroke="#8A7550" strokeWidth="1.2" fill="none" />

                  {/* Center Balance Line */}
                  <Path d="M 170 40 L 170 310" stroke="#C4A763" strokeWidth="0.8" strokeDasharray="4 4" />
                </G>
              )}

              {/* Background Guide: Dot Grid Matrix */}
              {bgGuide === "grid" && (
                <G opacity={0.25}>
                  {[40, 90, 140, 190, 240, 290].map((x) =>
                    [40, 90, 140, 190, 240, 290].map((y) => (
                      <Circle key={`${x}-${y}`} cx={x} cy={y} r={1.5} fill="#8A7550" />
                    ))
                  )}
                </G>
              )}

              {/* User Drawn Paths */}
              {paths.map((p, idx) => (
                <Path
                  key={idx}
                  d={p.d}
                  stroke={p.color}
                  strokeWidth={p.strokeWidth}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              {currentPath ? (
                <Path
                  d={currentPath}
                  stroke={selectedColor}
                  strokeWidth={selectedWidth}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}
            </Svg>
          </View>

          {/* Quick Sketch Title Suggestion Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingBottom: 8 }}
          >
            {SKETCH_CHIPS.map((chip) => (
              <Pressable
                key={chip}
                onPress={() => setTitle(chip)}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 12,
                  backgroundColor: title === chip ? "#4A080C" : "#E4D5B7",
                }}
              >
                <Text
                  style={{
                    fontFamily: "WorkSans_600SemiBold",
                    fontSize: 11,
                    color: title === chip ? "#FFFFFF" : "#3A2E1A",
                  }}
                >
                  + {chip}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Tools Toolbar */}
          <View style={styles.toolbarRow}>
            {/* Action Buttons: Undo & Clear */}
            <View style={styles.actionsRow}>
              <Pressable
                onPress={handleUndo}
                disabled={paths.length === 0}
                style={[styles.toolIconBtn, paths.length === 0 && styles.disabledBtn]}
              >
                <Undo2 size={16} color={paths.length > 0 ? "#4A080C" : "#A6926B"} />
              </Pressable>
              <Pressable
                onPress={handleClear}
                disabled={paths.length === 0}
                style={[styles.toolIconBtn, paths.length === 0 && styles.disabledBtn]}
              >
                <RotateCcw size={16} color={paths.length > 0 ? "#4A080C" : "#A6926B"} />
              </Pressable>
            </View>

            {/* Stroke Width Selector */}
            <View style={styles.widthSelectorRow}>
              {STROKE_WIDTHS.map((w) => (
                <Pressable
                  key={w.value}
                  onPress={() => setSelectedWidth(w.value)}
                  style={[
                    styles.widthBtn,
                    selectedWidth === w.value && styles.widthBtnActive,
                  ]}
                >
                  <View
                    style={{
                      width: w.value * 1.5 + 4,
                      height: w.value * 1.5 + 4,
                      borderRadius: 10,
                      backgroundColor: selectedWidth === w.value ? "#FFFFFF" : "#4A080C",
                    }}
                  />
                </Pressable>
              ))}
            </View>
          </View>

          {/* Color Palette */}
          <View style={styles.colorPaletteRow}>
            {COLORS.map((c) => {
              const isEraser = c === "#FBF7EF";
              const isSelected = selectedColor === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => setSelectedColor(c)}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: c },
                    isSelected && styles.colorSwatchSelected,
                  ]}
                >
                  {isEraser ? (
                    <Eraser size={14} color="#4A080C" />
                  ) : isSelected ? (
                    <Check
                      size={14}
                      color={c === "#FBF7EF" || c === "#C4A763" ? "#4A080C" : "#FFFFFF"}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          {/* Title Input & Save */}
          <View style={styles.footerContainer}>
            <Input
              placeholder="Sketch Title (e.g. Corset Detail)"
              value={title}
              onChangeText={setTitle}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={{ marginTop: 8 }}>
              <Button
                label={saving ? "Saving..." : "Save & Add to Moodboard"}
                onPress={handleSave}
                loading={saving}
                disabled={paths.length === 0 || !title.trim() || saving}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FBF7EF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: "92%",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontFamily: "Fraunces-Bold",
    fontSize: 18,
    color: "#4A080C",
  },
  guideToggleRow: {
    flexDirection: "row",
    gap: 4,
    backgroundColor: "#E4D5B7",
    padding: 3,
    borderRadius: 14,
  },
  guideBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  guideBtnActive: {
    backgroundColor: "#4A080C",
  },
  guideBtnText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 10,
    color: "#4A080C",
  },
  closeBtn: {
    padding: 4,
  },
  canvasContainer: {
    width: 340,
    height: 340,
    alignSelf: "center",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#E4D5B7",
    backgroundColor: "#FBF7EF",
    marginBottom: 12,
  },
  toolbarRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  toolIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E4D5B7",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  disabledBtn: {
    opacity: 0.5,
  },
  widthSelectorRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  widthBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E4D5B7",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  widthBtnActive: {
    backgroundColor: "#4A080C",
    borderColor: "#4A080C",
  },
  colorPaletteRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E4D5B7",
    alignItems: "center",
    justifyContent: "center",
  },
  colorSwatchSelected: {
    borderWidth: 2.5,
    borderColor: "#4A080C",
    transform: [{ scale: 1.1 }],
  },
  footerContainer: {
    marginTop: 4,
  },
  errorText: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 12,
    color: "#D32F2F",
    marginTop: 4,
    marginBottom: 4,
  },
});

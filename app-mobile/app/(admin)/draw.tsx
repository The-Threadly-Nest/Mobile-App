import React, { useState, useRef, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  PanResponder,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import Svg, { Path, Rect, Circle, G } from "react-native-svg";
import { ArrowLeft, Undo2, RotateCcw, Check, User, Grid, Eraser, Pen } from "lucide-react-native";
import { Input } from "@/shared/components/Input";
import { Button } from "@/shared/components/Button";
import { useAuthStore } from "@/stores/useAuthStore";
import { uploadFile } from "@/shared/utils/upload";
import { API_BASE_URL } from "@/api/config";
import { useAppAlert } from "@/shared/hooks/useAppAlert";
import * as FileSystem from "expo-file-system/legacy";

interface PathData {
  color: string;
  strokeWidth: number;
  d: string;
}

const COLORS = [
  "#4A080C",
  "#C4A763",
  "#3A2E1A",
  "#292D32",
  "#D32F2F",
  "#1E88E5",
  "#43A047",
  "#FBF7EF",
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

const VIRTUAL_CANVAS_HEIGHT = 1000;
const VIRTUAL_CENTER_X = 1000;
const FLOAT_TOOLBAR_BOTTOM = 14; // distance from screen bottom for the floating toolbar

// Helper to compute bounding box of all strokes in virtual coordinates
function getDrawingBounds(paths: PathData[]) {
  let minX = 500;
  let maxX = 1500;
  let minY = 0;
  let maxY = 1000;

  for (const p of paths) {
    const nums = p.d.match(/-?\d+(\.\d+)?/g);
    if (nums) {
      for (let i = 0; i < nums.length; i += 2) {
        const x = parseFloat(nums[i]);
        const y = parseFloat(nums[i + 1]);
        if (!isNaN(x)) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
        }
        if (!isNaN(y)) {
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
  }
  return { minX, maxX, minY, maxY };
}

export default function AdminDrawScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isLandscape = width > height;

  const { showAlert } = useAppAlert();
  const token = useAuthStore((s) => s.token);

  const [paths, setPaths] = useState<PathData[]>([]);
  const [currentPath, setCurrentPath] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("#4A080C");
  const [selectedWidth, setSelectedWidth] = useState<number>(5);
  const [bgGuide, setBgGuide] = useState<"croquis" | "grid" | "blank">("croquis");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [activePanel, setActivePanel] = useState<null | "color" | "width" | "guide">(null);

  // Portrait: tall 4:5 fashion ratio (360x450) so full-length gowns fit
  // Landscape: large panoramic pad filling the full available screen beside the toolbar
  const canvasWidth = isLandscape
    ? width - (Math.max(insets.left, 12) + 64) - Math.max(insets.right, 16)
    : Math.min(width - 32, 400);

  const canvasHeight = isLandscape
    ? height - Math.max(insets.top, 8) - Math.max(insets.bottom, 8) - 16
    : Math.min(Math.round(canvasWidth * 1.25), Math.round(height * 0.52));

  // Compute stroke bounds
  const { minX, maxX, minY, maxY } = useMemo(() => getDrawingBounds(paths), [paths]);

  let virtualViewBoxX: number;
  let virtualViewBoxY: number;
  let virtualWidth: number;
  let virtualHeight: number;

  const aspect = canvasWidth / (canvasHeight || 1);

  if (isLandscape) {
    // Landscape: expansive wide view, height locked around 1000 (or expands if user drew longer)
    const baseH = Math.max(maxY, VIRTUAL_CANVAS_HEIGHT);
    const startY = Math.min(minY, 0);
    virtualHeight = baseH - startY;
    virtualViewBoxY = startY;
    virtualWidth = Math.max(aspect * virtualHeight, (maxX - minX) + 100);
    virtualViewBoxX = VIRTUAL_CENTER_X - virtualWidth / 2;
  } else {
    // Portrait: locks vertical height around 1000 so dress length is 100% preserved
    const baseH = Math.max(maxY, VIRTUAL_CANVAS_HEIGHT);
    const startY = Math.min(minY, 0);
    const contentH = baseH - startY;
    const requiredW = Math.max((maxX - minX) + 80, 500 * 2);

    if (requiredW > aspect * contentH) {
      virtualWidth = requiredW;
      virtualHeight = virtualWidth / aspect;
      virtualViewBoxY = startY - (virtualHeight - contentH) / 2;
    } else {
      virtualHeight = contentH;
      virtualWidth = aspect * contentH;
      virtualViewBoxY = startY;
    }
    virtualViewBoxX = VIRTUAL_CENTER_X - virtualWidth / 2;
  }

  const canvasWidthRef = useRef(canvasWidth);
  canvasWidthRef.current = canvasWidth;
  const canvasHeightRef = useRef(canvasHeight);
  canvasHeightRef.current = canvasHeight;

  const virtualViewBoxRef = useRef({
    x: virtualViewBoxX,
    y: virtualViewBoxY,
    w: virtualWidth,
    h: virtualHeight,
  });
  virtualViewBoxRef.current = {
    x: virtualViewBoxX,
    y: virtualViewBoxY,
    w: virtualWidth,
    h: virtualHeight,
  };

  const selectedColorRef = useRef(selectedColor);
  selectedColorRef.current = selectedColor;

  const selectedWidthRef = useRef(selectedWidth);
  selectedWidthRef.current = selectedWidth;

  const currentPathRef = useRef<string>("");
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const startXRef = useRef(0);
  const startYRef = useRef(0);

  const commitPath = () => {
    // Capture ref values BEFORE clearing — setPaths updater runs async
    const pathData = currentPathRef.current;
    const color = selectedColorRef.current;
    const strokeWidth = selectedWidthRef.current;

    currentPathRef.current = "";
    setCurrentPath("");
    setScrollEnabled(true);

    if (pathData) {
      setPaths((prev) => [
        ...prev,
        { color, strokeWidth, d: pathData },
      ]);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (evt) => {
        setScrollEnabled(false);
        setActivePanel(null); // close any open panel when drawing starts
        const { locationX, locationY } = evt.nativeEvent;
        startXRef.current = locationX;
        startYRef.current = locationY;

        // Map touch location to center-anchored virtual space
        const { x: vx0, y: vy0, w: vw, h: vh } = virtualViewBoxRef.current;
        const vx = (vx0 + (locationX / (canvasWidthRef.current || 1)) * vw).toFixed(1);
        const vy = (vy0 + (locationY / (canvasHeightRef.current || 1)) * vh).toFixed(1);

        const startPoint = `M ${vx} ${vy} L ${vx} ${vy}`;
        currentPathRef.current = startPoint;
        setCurrentPath(startPoint);
      },
      onPanResponderMove: (evt, gestureState) => {
        const rawX = startXRef.current + gestureState.dx;
        const rawY = startYRef.current + gestureState.dy;

        const { x: vx0, y: vy0, w: vw, h: vh } = virtualViewBoxRef.current;
        const vx = (vx0 + (rawX / (canvasWidthRef.current || 1)) * vw).toFixed(1);
        const vy = (vy0 + (rawY / (canvasHeightRef.current || 1)) * vh).toFixed(1);

        const nextPoint = ` L ${vx} ${vy}`;
        currentPathRef.current += nextPoint;
        setCurrentPath(currentPathRef.current);
      },
      onPanResponderRelease: () => {
        commitPath();
      },
      onPanResponderTerminate: () => {
        commitPath();
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
      const pathElements = paths
        .map(
          (p) =>
            `<path d="${p.d}" stroke="${p.color}" stroke-width="${(p.strokeWidth / 360) * VIRTUAL_CANVAS_HEIGHT}" fill="none" stroke-linecap="round" stroke-linejoin="round" />`
        )
        .join("\n");

      const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${virtualWidth.toFixed(0)}" height="${virtualHeight.toFixed(0)}" viewBox="${virtualViewBoxX.toFixed(1)} ${virtualViewBoxY.toFixed(1)} ${virtualWidth.toFixed(1)} ${virtualHeight.toFixed(1)}">
<rect x="${virtualViewBoxX.toFixed(1)}" y="${virtualViewBoxY.toFixed(1)}" width="${virtualWidth.toFixed(1)}" height="${virtualHeight.toFixed(1)}" fill="#FBF7EF" />
${pathElements}
</svg>`;

      const filename = `sketch-${Date.now()}.svg`;
      const tempFileUri = `${FileSystem.cacheDirectory}${filename}`;

      // Write SVG string to genuine local file on the device
      await FileSystem.writeAsStringAsync(tempFileUri, svgString, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Upload genuine file:/// URI directly to Cloudflare R2
      let uploadResult;
      try {
        uploadResult = await uploadFile(tempFileUri, filename, "image/svg+xml");
      } finally {
        FileSystem.deleteAsync(tempFileUri, { idempotent: true }).catch(() => {});
      }

      const res = await fetch(`${API_BASE_URL}/api/moodboard`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          imageUrl: uploadResult.fileUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to save sketch to database.");
      }

      showAlert("Saved!", `"${title.trim()}" has been saved to your moodboard.`);
      router.back();
    } catch (e: any) {
      const msg = e.message ?? "Failed to save drawing.";
      setError(msg);
      showAlert("Save Error", msg);
    } finally {
      setSaving(false);
    }
  };

  // ─── Shared canvas JSX ─────────────────────────────────────────────────────
  const canvasJSX = (
    <View
      style={[
        styles.canvasContainer,
        { width: canvasWidth, height: canvasHeight },
      ]}
    >
      {/* Render Layer */}
      <Svg
        width={canvasWidth}
        height={canvasHeight}
        viewBox={`${virtualViewBoxX.toFixed(1)} ${virtualViewBoxY.toFixed(1)} ${virtualWidth.toFixed(1)} ${virtualHeight.toFixed(1)}`}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <Rect
          x={virtualViewBoxX.toFixed(1)}
          y={virtualViewBoxY.toFixed(1)}
          width={virtualWidth.toFixed(1)}
          height={virtualHeight.toFixed(1)}
          fill="#FBF7EF"
        />

        {/* Croquis Silhouette Guide centered at x = 1000 */}
        {bgGuide === "croquis" && (
          <G opacity={0.35}>
            <Circle cx={1000} cy={140} r={44} stroke="#8A7550" strokeWidth="3" fill="none" />
            <Path d="M 990 190 L 990 240 M 1010 190 L 1010 240" stroke="#8A7550" strokeWidth="3" />
            <Path d="M 870 270 C 930 240, 1070 240, 1130 270" stroke="#8A7550" strokeWidth="3.5" fill="none" />
            <Path d="M 870 270 C 850 370, 920 460, 950 510" stroke="#8A7550" strokeWidth="3" fill="none" />
            <Path d="M 1130 270 C 1150 370, 1080 460, 1050 510" stroke="#8A7550" strokeWidth="3" fill="none" />
            <Path d="M 950 510 C 980 520, 1020 520, 1050 510" stroke="#8A7550" strokeWidth="3.5" fill="none" />
            <Path d="M 950 510 C 920 630, 910 750, 940 920" stroke="#8A7550" strokeWidth="3" fill="none" />
            <Path d="M 1050 510 C 1080 630, 1090 750, 1060 920" stroke="#8A7550" strokeWidth="3" fill="none" />
            <Path d="M 1000 80 L 1000 950" stroke="#C4A763" strokeWidth="2" strokeDasharray="10 10" />
          </G>
        )}

        {/* Dot Grid Guide in virtual space */}
        {bgGuide === "grid" && (
          <G opacity={0.25}>
            {Array.from(
              { length: Math.ceil(virtualWidth / 100) + 2 },
              (_, i) => Math.floor(virtualViewBoxX / 100) * 100 + i * 100
            ).map((x) =>
              [100, 200, 300, 400, 500, 600, 700, 800, 900].map((y) => (
                <Circle key={`${x}-${y}`} cx={x} cy={y} r={4} fill="#8A7550" />
              ))
            )}
          </G>
        )}

        {/* Saved Paths */}
        {paths.map((p, idx) => (
          <Path
            key={idx}
            d={p.d}
            stroke={p.color}
            strokeWidth={(p.strokeWidth / 360) * VIRTUAL_CANVAS_HEIGHT}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {/* In-Progress Stroke */}
        {currentPath ? (
          <Path
            d={currentPath}
            stroke={selectedColor}
            strokeWidth={(selectedWidth / 360) * VIRTUAL_CANVAS_HEIGHT}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
      </Svg>

      {/* Touch Layer — immune to SVG re-renders */}
      <View
        collapsable={false}
        {...panResponder.panHandlers}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: canvasWidth,
          height: canvasHeight,
          backgroundColor: "transparent",
        }}
      />
    </View>
  );

  // ─── LANDSCAPE — full-screen canvas + left vertical pill toolbar ────────
  if (isLandscape) {
    const pillLeft = Math.max(insets.left, 12);
    const panelLeft = pillLeft + 54; // panels open to the right of the pill

    const togglePanel = (p: "color" | "width" | "guide") =>
      setActivePanel((prev) => (prev === p ? null : p));

    return (
      <View style={styles.landscapeRoot}>
        {/* Centered pad in landscape */}
        <View style={styles.landscapeCanvasWrapper}>
          {canvasJSX}
        </View>

        {/* Error banner in landscape */}
        {error ? (
          <View style={[styles.landscapeErrorBanner, { top: Math.max(insets.top, 12) }]}>
            <Text style={styles.landscapeErrorText} numberOfLines={2}>
              {error}
            </Text>
          </View>
        ) : null}

        {/* Dismiss panels on canvas tap */}
        {activePanel !== null && (
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setActivePanel(null)}
          />
        )}

        {/* ── Pop-up Panels (open to the right of the pill) ── */}

        {activePanel === "color" && (
          <View style={[styles.floatPanel, { left: panelLeft }]}>
            <View style={styles.floatPanelCol}>
              {COLORS.map((c) => {
                const isEraser = c === "#FBF7EF";
                const isSelected = selectedColor === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => { setSelectedColor(c); setActivePanel(null); }}
                    style={[
                      styles.panelColorSwatch,
                      { backgroundColor: c },
                      isSelected && styles.panelColorSwatchSelected,
                    ]}
                  >
                    {isEraser ? (
                      <Eraser size={12} color="#4A080C" />
                    ) : isSelected ? (
                      <Check size={12} color={c === "#C4A763" ? "#4A080C" : "#FFF"} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {activePanel === "width" && (
          <View style={[styles.floatPanel, { left: panelLeft }]}>
            <View style={styles.floatPanelCol}>
              {STROKE_WIDTHS.map((w) => {
                const penSize = w.value === 2 ? 12 : w.value === 5 ? 16 : 22;
                const isActive = selectedWidth === w.value;
                return (
                  <Pressable
                    key={w.value}
                    onPress={() => { setSelectedWidth(w.value); setActivePanel(null); }}
                    style={[styles.panelBtn, isActive && styles.panelBtnActive]}
                  >
                    <Pen size={penSize} color={isActive ? "#FFF" : "#4A080C"} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {activePanel === "guide" && (
          <View style={[styles.floatPanel, { left: panelLeft }]}>
            <View style={styles.floatPanelCol}>
              {([
                { key: "croquis" as const, icon: <User size={15} color={bgGuide === "croquis" ? "#FFF" : "#4A080C"} /> },
                { key: "grid" as const, icon: <Grid size={15} color={bgGuide === "grid" ? "#FFF" : "#4A080C"} /> },
                { key: "blank" as const, icon: <Text style={[styles.panelBtnLabel, bgGuide === "blank" && { color: "#FFF" }]}>—</Text> },
              ]).map(({ key, icon }) => (
                <Pressable
                  key={key}
                  onPress={() => { setBgGuide(key); setActivePanel(null); }}
                  style={[styles.panelBtn, bgGuide === key && styles.panelBtnActive]}
                >
                  {icon}
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* ── Left vertical pill — centered on the left edge ── */}
        {/* Centering wrapper: absolute full-height column on the left */}
        <View
          style={[
            styles.pillCenterWrapper,
            { left: pillLeft, paddingTop: Math.max(insets.top, 8), paddingBottom: Math.max(insets.bottom, 8) },
          ]}
        >
          <View style={styles.floatingToolbarPill}>
            {/* Back */}
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.floatBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <ArrowLeft size={16} color="#4A080C" />
            </Pressable>

            <View style={styles.floatDivider} />

            {/* Color — filled with current color */}
            <Pressable
              onPress={() => togglePanel("color")}
              style={[
                styles.floatBtn,
                { backgroundColor: selectedColor === "#FBF7EF" ? "#E4D5B7" : selectedColor },
                activePanel === "color" && styles.floatBtnRing,
              ]}
            >
              {selectedColor === "#FBF7EF" ? (
                <Eraser size={13} color="#4A080C" />
              ) : (
                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.55)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.9)" }} />
              )}
            </Pressable>

            {/* Pen size */}
            <Pressable
              onPress={() => togglePanel("width")}
              style={[styles.floatBtn, activePanel === "width" && styles.floatBtnActive]}
            >
              <Pen
                size={selectedWidth === 2 ? 12 : selectedWidth === 5 ? 16 : 20}
                color={activePanel === "width" ? "#FFF" : "#4A080C"}
              />
            </Pressable>

            {/* Guide */}
            <Pressable
              onPress={() => togglePanel("guide")}
              style={[styles.floatBtn, activePanel === "guide" && styles.floatBtnActive]}
            >
              {bgGuide === "croquis" ? (
                <User size={14} color={activePanel === "guide" ? "#FFF" : "#4A080C"} />
              ) : bgGuide === "grid" ? (
                <Grid size={14} color={activePanel === "guide" ? "#FFF" : "#4A080C"} />
              ) : (
                <Text style={[styles.panelBtnLabel, activePanel === "guide" && { color: "#FFF" }]}>—</Text>
              )}
            </Pressable>

            <View style={styles.floatDivider} />

            {/* Undo */}
            <Pressable
              onPress={handleUndo}
              disabled={paths.length === 0}
              style={[styles.floatBtn, paths.length === 0 && styles.disabledBtn]}
            >
              <Undo2 size={14} color={paths.length > 0 ? "#4A080C" : "#C4A763"} />
            </Pressable>

            {/* Clear */}
            <Pressable
              onPress={handleClear}
              disabled={paths.length === 0}
              style={[styles.floatBtn, paths.length === 0 && styles.disabledBtn]}
            >
              <RotateCcw size={14} color={paths.length > 0 ? "#4A080C" : "#C4A763"} />
            </Pressable>

            <View style={styles.floatDivider} />

            {/* Save */}
            <Pressable
              onPress={handleSave}
              disabled={paths.length === 0 || saving}
              style={[styles.floatBtn, styles.floatBtnSave, (paths.length === 0 || saving) && styles.disabledBtn]}
            >
              <Check size={14} color="#FFF" />
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // ─── PORTRAIT ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.headerBar}>
        <View style={styles.headerLeft}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <ArrowLeft size={20} color="#000000" />
          </Pressable>
          <Text style={styles.headerTitle}>Sketchpad</Text>
        </View>

        <View style={styles.guideToggleRow}>
          <Pressable
            onPress={() => setBgGuide("croquis")}
            style={[styles.guideBtn, bgGuide === "croquis" && styles.guideBtnActive]}
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
            <Text style={[styles.guideBtnText, bgGuide === "blank" && { color: "#FFFFFF" }]}>
              Blank
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Canvas */}
      <View style={styles.portraitCanvasWrapper}>
        {canvasJSX}
      </View>

      {/* Tools */}
      <ScrollView
        scrollEnabled={scrollEnabled}
        showsVerticalScrollIndicator={false}
        style={styles.portraitToolsScroll}
        contentContainerStyle={styles.toolsContent}
      >
        {/* Actions & Stroke Width Row */}
        <View style={styles.toolbarRow}>
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

          <View style={styles.widthSelectorRow}>
            {STROKE_WIDTHS.map((w) => {
              const penSize = w.value === 2 ? 11 : w.value === 5 ? 15 : 20;
              const isActive = selectedWidth === w.value;
              return (
                <Pressable
                  key={w.value}
                  onPress={() => setSelectedWidth(w.value)}
                  style={[styles.toolIconBtn, isActive && styles.widthBtnActive]}
                >
                  <Pen size={penSize} color={isActive ? "#FFFFFF" : "#4A080C"} />
                </Pressable>
              );
            })}
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

        {/* Title Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingBottom: 10 }}
        >
          {SKETCH_CHIPS.map((chip) => (
            <Pressable
              key={chip}
              onPress={() => setTitle(chip)}
              style={[styles.chip, title === chip ? styles.chipActive : styles.chipInactive]}
            >
              <Text
                style={[styles.chipText, title === chip ? { color: "#FFFFFF" } : { color: "#3A2E1A" }]}
              >
                + {chip}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Input
          placeholder="Sketch Title (e.g. Corset Detail)"
          value={title}
          onChangeText={setTitle}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={{ marginTop: 10, marginBottom: 16 }}>
          <Button
            label={saving ? "Saving..." : "Save to Moodboard"}
            onPress={handleSave}
            loading={saving}
            disabled={paths.length === 0 || !title.trim() || saving}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ── Portrait ────────────────────────────────────────────────────────────────────
  safeArea: { flex: 1, backgroundColor: "#FBF7EF" },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.15)",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontFamily: "Fraunces-Bold", fontSize: 22, color: "#1A1110" },
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
  guideBtnActive: { backgroundColor: "#4A080C" },
  guideBtnText: { fontFamily: "WorkSans_600SemiBold", fontSize: 10, color: "#4A080C" },
  portraitCanvasWrapper: { alignItems: "center", paddingTop: 8 },
  portraitToolsScroll: { flex: 1, paddingHorizontal: 16 },
  toolsContent: { paddingBottom: 20 },
  toolbarRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    marginTop: 10,
  },
  actionsRow: { flexDirection: "row", gap: 8 },
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
  disabledBtn: { opacity: 0.4 },
  widthSelectorRow: { flexDirection: "row", gap: 8, alignItems: "center" },
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
  widthBtnActive: { backgroundColor: "#4A080C", borderColor: "#4A080C" },
  colorPaletteRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E4D5B7",
    alignItems: "center",
    justifyContent: "center",
  },
  colorSwatchSelected: {
    borderWidth: 2.5,
    borderColor: "#4A080C",
    transform: [{ scale: 1.15 }],
  },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  chipActive: { backgroundColor: "#4A080C" },
  chipInactive: { backgroundColor: "#E4D5B7" },
  chipText: { fontFamily: "WorkSans_600SemiBold", fontSize: 11 },
  errorText: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 12,
    color: "#D32F2F",
    marginTop: 4,
    marginBottom: 4,
  },

  // ── Shared canvas ────────────────────────────────────────────────────────────────
  canvasContainer: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#E4D5B7",
    backgroundColor: "#FBF7EF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  landscapeCanvasWrapper: {
    flex: 1,
    paddingLeft: 60,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Landscape ─────────────────────────────────────────────────────────────────
  landscapeRoot: {
    flex: 1,
    flexDirection: "column",
    backgroundColor: "#FBF7EF",
  },
  landscapeErrorBanner: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#EF4444",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxWidth: "60%",
    zIndex: 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 6,
  },
  landscapeErrorText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 12,
    color: "#B91C1C",
    textAlign: "center",
  },
  landscapeBackBtn: {
    position: "absolute",
    zIndex: 30,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.10)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 5,
  },
  // Floating toolbar pill — vertical left side
  pillCenterWrapper: {
    position: "absolute",
    top: 0,
    bottom: 0,
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "flex-start",
    zIndex: 20,
  },
  floatingToolbarPill: {
    flexDirection: "column",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 28,
    paddingHorizontal: 6,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.07)",
  },
  floatBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F5EFE3",
    borderWidth: 1,
    borderColor: "#E4D5B7",
    alignItems: "center",
    justifyContent: "center",
  },
  floatBtnActive: {
    backgroundColor: "#4A080C",
    borderColor: "#4A080C",
  },
  floatBtnRing: {
    borderWidth: 2.5,
    borderColor: "#4A080C",
  },
  floatBtnSave: {
    backgroundColor: "#4A080C",
    borderColor: "#4A080C",
  },
  floatDivider: {
    width: 28,
    height: 1,
    backgroundColor: "#E4D5B7",
    marginVertical: 1,
  },
  // Pop-up panels — appear to the RIGHT of the pill
  floatPanel: {
    position: "absolute",
    top: "25%",
    backgroundColor: "rgba(255,255,255,0.97)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 10,
    zIndex: 25,
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.07)",
  },
  floatPanelRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  floatPanelCol: {
    flexDirection: "column",
    gap: 8,
    alignItems: "center",
  },
  panelBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#F5EFE3",
    borderWidth: 1,
    borderColor: "#E4D5B7",
    alignItems: "center",
    justifyContent: "center",
  },
  panelBtnActive: {
    backgroundColor: "#4A080C",
    borderColor: "#4A080C",
  },
  panelBtnLabel: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#4A080C",
  },
  panelColorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E4D5B7",
    alignItems: "center",
    justifyContent: "center",
  },
  panelColorSwatchSelected: {
    borderWidth: 2.5,
    borderColor: "#4A080C",
    transform: [{ scale: 1.15 }],
  },
});

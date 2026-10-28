const fs = require("node:fs");
const path = require("node:path");

const target = path.join(
  __dirname,
  "..",
  "node_modules",
  "react-native-css-interop",
  "dist",
  "runtime",
  "components.js",
);

if (!fs.existsSync(target)) {
  console.warn("[postinstall] react-native-css-interop is not installed; Pressable patch skipped.");
  process.exit(0);
}

const marker = "CompatiblePressableStyleFunction";
const original = '(0, api_1.cssInterop)(react_native_1.Pressable, { className: "style" });';
const replacement = `const react_1 = require("react");
const InteropPressable = (0, api_1.cssInterop)(react_native_1.Pressable, { className: "style" });
const CompatiblePressableStyleFunction = (0, react_1.forwardRef)((props, ref) => {
    const [pressed, setPressed] = (0, react_1.useState)(false);
    const { style, onPressIn, onPressOut, ...rest } = props;
    const resolvedStyle = typeof style === "function" ? style({ pressed }) : style;
    return (0, react_1.createElement)(InteropPressable, {
        ...rest,
        ref,
        style: resolvedStyle,
        onPressIn: (event) => {
            setPressed(true);
            onPressIn?.(event);
        },
        onPressOut: (event) => {
            setPressed(false);
            onPressOut?.(event);
        },
    });
});
CompatiblePressableStyleFunction.displayName = "CompatiblePressableStyleFunction";
api_1.interopComponents.set(react_native_1.Pressable, CompatiblePressableStyleFunction);`;

const source = fs.readFileSync(target, "utf8");

if (source.includes(marker)) {
  console.log("[postinstall] NativeWind Pressable compatibility patch already applied.");
  process.exit(0);
}

if (!source.includes(original)) {
  throw new Error(
    "Unable to apply the NativeWind Pressable compatibility patch: dependency layout changed.",
  );
}

fs.writeFileSync(target, source.replace(original, replacement), "utf8");
console.log("[postinstall] Applied NativeWind Pressable compatibility patch.");

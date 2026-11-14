import React, { forwardRef } from "react";
import {
  Text as NativeText,
  TextInput as NativeTextInput,
  StyleSheet,
  type TextProps,
  type TextInputProps,
  type StyleProp,
  type TextStyle,
} from "react-native";
import { cssInterop } from "nativewind";

function defaultFamily(style: StyleProp<TextStyle>) {
  const weight = StyleSheet.flatten(style)?.fontWeight;
  if (weight === "bold" || Number(weight) >= 700) return "InstrumentSans-Bold";
  if (Number(weight) >= 600) return "InstrumentSans-SemiBold";
  if (Number(weight) >= 500) return "InstrumentSans-Medium";
  return "InstrumentSans-Regular";
}

// Default every app-owned label/input to Instrument Sans, including unstyled ones.
// Explicit style and NativeWind font variants still take precedence.
export type Text = React.ComponentRef<typeof NativeText>;
export const Text = forwardRef<Text, TextProps>(({ style, ...props }, ref) => (
  <NativeText ref={ref} {...props} style={[{ fontFamily: defaultFamily(style), color: "#4A403B" }, style]} />
));
Text.displayName = "OwujaText";
cssInterop(Text, { className: "style" });

export type TextInput = React.ComponentRef<typeof NativeTextInput>;
export const TextInput = forwardRef<TextInput, TextInputProps>(({ style, ...props }, ref) => (
  <NativeTextInput ref={ref} {...props} style={[{ fontFamily: defaultFamily(style), color: "#4A403B" }, style]} />
));
TextInput.displayName = "OwujaTextInput";
cssInterop(TextInput, { className: "style" });

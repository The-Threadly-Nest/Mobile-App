import React, { useState } from "react";
import { TextInputProps, View, Pressable } from "react-native";
import { TextInput, Text } from "@/shared/components/Typography";
import { Eye, EyeOff } from "lucide-react-native";
import { typeScale } from "../utils/typeScale";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  variant?: "default" | "outlined";
}

export function Input({ label, error, secureTextEntry, variant = "default", ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isSecure = secureTextEntry && !showPassword;

  if (variant === "outlined") return (
    <View style={{ width: "100%", marginBottom: 24 }}>
      <View style={{ position: "relative", height: 56, borderWidth: 1, borderColor: error || focused ? "#F96951" : "rgba(69, 51, 50, 0.35)", borderRadius: 14, backgroundColor: "#FFFFFF", justifyContent: "center", paddingHorizontal: 14 }}>
        <View pointerEvents="none" style={{ position: "absolute", top: -10, left: 16, paddingHorizontal: 6, backgroundColor: "#FFFFFF", zIndex: 1 }}><Text style={{ ...typeScale.label, color: "#4A403B" }}>{label || rest.placeholder}</Text></View>
        <TextInput {...rest} placeholder={undefined} disableFullscreenUI secureTextEntry={isSecure} accessibilityLabel={rest.accessibilityLabel || label || rest.placeholder} style={[{ fontFamily: "InstrumentSans-Regular", fontSize: 15, color: "#4A403B", height: "100%", paddingRight: secureTextEntry ? 32 : 0 }, rest.style]} onFocus={event => { setFocused(true); rest.onFocus?.(event); }} onBlur={event => { setFocused(false); rest.onBlur?.(event); }} />
        {secureTextEntry && <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? "Hide password" : "Show password"} onPress={() => setShowPassword(value => !value)} hitSlop={8} style={{ position: "absolute", right: 14, top: 18 }}>{showPassword ? <EyeOff size={20} color="#453332" /> : <Eye size={20} color="#453332" />}</Pressable>}
      </View>
      {error && <Text style={{ ...typeScale.caption, color: "#F96951", marginTop: 6 }}>{error}</Text>}
    </View>
  );

  return (
    <View className="mb-3 w-full">
      {label ? (
        <Text className="font-body-medium text-xs text-black mb-1.5">{label}</Text>
      ) : null}
      <View className="relative justify-center">
        <TextInput
          disableFullscreenUI={true}
          className={`border rounded-lg px-4 py-3 font-body text-base text-black bg-white ${
            secureTextEntry ? "pr-12" : ""
          } ${
            error || focused ? "border-tomato" : "border-oxblood"
          }`}
          placeholderTextColor="#453332"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry={isSecure}
          {...rest}
        />
        {secureTextEntry ? (
          <Pressable
            onPress={() => setShowPassword((prev) => !prev)}
            className="absolute right-3.5"
            hitSlop={8}
          >
            {showPassword ? (
              <EyeOff size={20} color="#453332" />
            ) : (
              <Eye size={20} color="#453332" />
            )}
          </Pressable>
        ) : null}
      </View>
      {error ? <Text className="font-body text-tomato text-xs mt-1">{error}</Text> : null}
    </View>
  );
}

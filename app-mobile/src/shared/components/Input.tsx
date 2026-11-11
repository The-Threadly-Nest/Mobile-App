import React, { useState } from "react";
import { TextInputProps, View, Pressable } from "react-native";
import { TextInput, Text } from "@/shared/components/Typography";
import { Eye, EyeOff } from "lucide-react-native";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, secureTextEntry, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isSecure = secureTextEntry && !showPassword;

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

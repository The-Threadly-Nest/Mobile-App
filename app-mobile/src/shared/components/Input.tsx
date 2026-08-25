import React, { useState } from "react";
import { TextInput, TextInputProps, View, Text, Pressable } from "react-native";
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
        <Text className="font-body-medium text-xs text-grey700 mb-1.5">{label}</Text>
      ) : null}
      <View className="relative justify-center">
        <TextInput
          className={`border rounded-lg px-4 py-3 font-body text-base text-ink bg-white ${
            secureTextEntry ? "pr-12" : ""
          } ${
            error ? "border-red-500" : focused ? "border-oxblood" : "border-grey100"
          }`}
          placeholderTextColor="#A6926B"
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
              <EyeOff size={20} color="#4A080C" />
            ) : (
              <Eye size={20} color="#4A080C" />
            )}
          </Pressable>
        ) : null}
      </View>
      {error ? <Text className="font-body text-red-500 text-xs mt-1">{error}</Text> : null}
    </View>
  );
}

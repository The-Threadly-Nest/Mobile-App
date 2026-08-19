import React, { useState } from "react";
import { TextInput, TextInputProps, View, Text } from "react-native";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View className="mb-3 w-full">
      {label ? (
        <Text className="font-body-medium text-xs text-grey700 mb-1.5">{label}</Text>
      ) : null}
      <TextInput
        className={`border rounded-lg px-4 py-3 font-body text-base text-ink bg-white ${
          error ? "border-red-500" : focused ? "border-oxblood" : "border-grey100"
        }`}
        placeholderTextColor="#A6926B"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...rest}
      />
      {error ? <Text className="font-body text-red-500 text-xs mt-1">{error}</Text> : null}
    </View>
  );
}

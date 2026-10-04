import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled application render error", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, backgroundColor: "#FBF7EF" }}>
        <Text style={{ fontFamily: "Fraunces-Bold", fontSize: 24, color: "#4A080C", textAlign: "center" }}>
          Something went wrong
        </Text>
        <Text style={{ marginTop: 12, fontFamily: "WorkSans_400Regular", fontSize: 15, lineHeight: 22, color: "#3A2E1A", textAlign: "center" }}>
          We could not open this page. Please try again.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => this.setState({ error: null })}
          style={({ pressed }) => ({ marginTop: 24, minWidth: 140, alignItems: "center", borderRadius: 24, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: "#4A080C", opacity: pressed ? 0.8 : 1 })}
        >
          <Text style={{ fontFamily: "WorkSans_600SemiBold", fontSize: 15, color: "#FBF7EF" }}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

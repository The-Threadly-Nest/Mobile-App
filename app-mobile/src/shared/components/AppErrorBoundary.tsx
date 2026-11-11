import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/shared/components/Typography";

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
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, backgroundColor: "#F9E8D3" }}>
        <Text style={{ fontFamily: "InstrumentSans-Regular", fontSize: 24, color: "#4A403B", textAlign: "center" }}>
          Something went wrong
        </Text>
        <Text style={{ marginTop: 12, fontFamily: "InstrumentSans-Regular", fontSize: 15, lineHeight: 22, color: "#4A403B", textAlign: "center" }}>
          We could not open this page. Please try again.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => this.setState({ error: null })}
          style={({ pressed }) => ({ marginTop: 24, minWidth: 140, alignItems: "center", borderRadius: 24, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: "#F96951", opacity: pressed ? 0.8 : 1 })}
        >
          <Text style={{ fontFamily: "InstrumentSans-SemiBold", fontSize: 15, color: "#FFFDF9" }}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

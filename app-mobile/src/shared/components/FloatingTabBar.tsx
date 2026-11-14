import React from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { Text } from "@/shared/components/Typography";

type FloatingTabBarProps = {
  state: any;
  descriptors: any;
  emitter: { emit: (event: any) => any };
  navigateToTab: (routeKey: string) => void;
  bottomInset: number;
  allowedRoutes?: string[];
};

export function FloatingTabBar({ bottomInset, state, descriptors, emitter, navigateToTab, allowedRoutes }: FloatingTabBarProps) {
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.min(330, screenWidth - 36);
  const focusedRoute = state.routes[state.index];
  const focusedStyle = StyleSheet.flatten(descriptors[focusedRoute.key]?.options.tabBarStyle);

  if (focusedStyle?.display === "none") return null;

  // Conditionally hide tab bar if current active route is not in allowedRoutes
  if (allowedRoutes && !allowedRoutes.includes(focusedRoute?.name)) {
    return null;
  }

  const visibleRoutes = state.routes.filter((route: any) => {
    const options = descriptors[route.key]?.options ?? {};
    if (options.href === null) return false;
    if (options.tabBarStyle?.display === "none") return false;
    if (typeof options.tabBarButton === "function" && options.tabBarButton() === null) return false;
    if (!options.tabBarIcon) return false;
    return true;
  });

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: Math.max(12, bottomInset + 4),
        alignItems: "center",
      }}
    >
      <View
        style={{
          width,
          height: 56,
          borderRadius: 28,
          backgroundColor: "#F96951",
          flexDirection: "row",
          alignItems: "center",
          elevation: 6,
          shadowColor: "#2B2B2B",
          shadowOpacity: 0.25,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          overflow: "visible",
        }}
      >
        {visibleRoutes.map((route: any) => {
          const options = descriptors[route.key]?.options ?? {};
          const focused = state.routes[state.index]?.key === route.key;
          const icon = options.tabBarIcon?.({ focused, color: "#FFFDF9", size: 24 });
          const badge = options.tabBarBadge;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? options.title ?? route.name}
              android_ripple={undefined}
              onPress={() => {
                const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigateToTab(route.key);
              }}
              onLongPress={() => emitter.emit({ type: "tabLongPress", target: route.key })}
              style={({ pressed }) => [
                {
                  flex: 1,
                  height: 54,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              {icon}
              {badge != null ? (
                <View style={{ position: "absolute", top: 1, right: 8, minWidth: 24, height: 24, paddingHorizontal: 5, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#453332" }}>
                  <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "700" }}>{Number(badge) > 99 ? "99+" : String(badge)}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

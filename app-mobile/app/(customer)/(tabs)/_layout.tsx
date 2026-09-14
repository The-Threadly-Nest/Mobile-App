import React, { useEffect } from "react";
import { Tabs } from "expo-router";
import * as NavigationBar from "expo-navigation-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Circle } from "react-native-svg";

function DiscoverTabIcon({ color, focused }: { color: string; focused: boolean }) {
  if (focused) {
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path d="M12.7002 16.8801H13.4002C14.5502 16.8801 15.4902 15.9401 15.4902 14.7901V14.0901H12.7002V16.8801Z" fill={color} />
        <Path d="M8.50977 14.7901C8.50977 15.9401 9.44977 16.8801 10.5998 16.8801H11.2998V14.0901H8.50977V14.7901Z" fill={color} />
        <Path d="M8.50977 11.9999V12.6999H11.2998V9.90991H10.5998C9.44977 9.90991 8.50977 10.8499 8.50977 11.9999Z" fill={color} />
        <Path d="M20.03 6.81994L14.28 2.78994C12.71 1.68994 10.31 1.74994 8.8 2.91994L3.79 6.82994C2.78 7.60994 2 9.20994 2 10.4699V17.3699C2 19.9199 4.07 21.9999 6.61 21.9999H17.38C19.92 21.9999 21.99 19.9299 21.99 17.3799V10.5999C22 9.24994 21.13 7.58994 20.03 6.81994ZM16.88 14.7899C16.88 16.7099 15.31 18.2799 13.39 18.2799H10.6C8.68 18.2799 7.11 16.7199 7.11 14.7899V11.9999C7.11 10.0799 8.68 8.50994 10.6 8.50994H13.39C15.31 8.50994 16.88 10.0699 16.88 11.9999V14.7899Z" fill={color} />
        <Path d="M13.4002 9.90991H12.7002V12.6999H15.4902V11.9999C15.4902 10.8499 14.5502 9.90991 13.4002 9.90991Z" fill={color} />
      </Svg>
    );
  }

  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9.02 2.83992L3.63 7.03992C2.73 7.73992 2 9.22992 2 10.3599V17.7699C2 20.0899 3.89 21.9899 6.21 21.9899H17.79C20.11 21.9899 22 20.0899 22 17.7799V10.4999C22 9.28992 21.19 7.73992 20.2 7.04992L14.02 2.71992C12.62 1.73992 10.37 1.78992 9.02 2.83992Z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10.5 18H13.5C15.15 18 16.5 16.65 16.5 15V12C16.5 10.35 15.15 9 13.5 9H10.5C8.85 9 7.5 10.35 7.5 12V15C7.5 16.65 8.85 18 10.5 18Z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 9V18"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7.5 13.5H16.5"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function OrdersTabIcon({ color, focused }: { color: string; focused: boolean }) {
  const activeColor = focused ? "#4A080C" : "#000000";
  return (
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      {focused && (
        <Path
          d="M5.82 3.87L4.75 13.96C4.61 15.59 5.9 16.99 7.54 16.99H18.19C19.63 16.99 20.89 15.81 21 14.38L21.54 6.88C21.66 5.22 20.4 3.87 18.73 3.87H5.82Z"
          fill="#4A080C"
        />
      )}
      <Path
        d="M2 2H3.74001C4.82001 2 5.67 2.93 5.58 4L4.75 13.96C4.61 15.59 5.89999 16.99 7.53999 16.99H18.19C19.63 16.99 20.89 15.81 21 14.38L21.54 6.88C21.66 5.22 20.4 3.87 18.73 3.87H5.82001"
        stroke={activeColor}
        strokeWidth="1.8"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M16.25 22C16.9404 22 17.5 21.4404 17.5 20.75C17.5 20.0596 16.9404 19.5 16.25 19.5C15.5596 19.5 15 20.0596 15 20.75C15 21.4404 15.5596 22 16.25 22Z"
        stroke={activeColor}
        strokeWidth="1.8"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={focused ? activeColor : "none"}
      />
      <Path
        d="M8.25 22C8.94036 22 9.5 21.4404 9.5 20.75C9.5 20.0596 8.94036 19.5 8.25 19.5C7.55964 19.5 7 20.0596 7 20.75C7 21.4404 7.55964 22 8.25 22Z"
        stroke={activeColor}
        strokeWidth="1.8"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={focused ? activeColor : "none"}
      />
      <Path
        d="M9 8H21"
        stroke={focused ? "#FFFFFF" : activeColor}
        strokeWidth="1.8"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ProfileTabIcon({ color, focused }: { color: string; focused: boolean }) {
  if (focused) {
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={6.5} r={4.5} fill={color} />
        <Path
          d="M4.5 19.5C4.5 15.5 8 13 12 13C16 13 19.5 15.5 19.5 19.5"
          fill={color}
        />
      </Svg>
    );
  }

  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12.1601 10.87C12.0601 10.86 11.9401 10.86 11.8301 10.87C9.45006 10.79 7.56006 8.84 7.56006 6.44C7.56006 3.99 9.54006 2 12.0001 2C14.4501 2 16.4401 3.99 16.4401 6.44C16.4301 8.84 14.5401 10.79 12.1601 10.87Z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7.16021 14.56C4.74021 16.18 4.74021 18.82 7.16021 20.43C9.91021 22.27 14.4202 22.27 17.1702 20.43C19.5902 18.81 19.5902 16.17 17.1702 14.56C14.4302 12.73 9.92021 12.73 7.16021 14.56Z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const extraBottom = insets.bottom;

  useEffect(() => {
    // Match nav bar to tab bar background — blends seamlessly
    NavigationBar.setBackgroundColorAsync("#FBF7EF");
    NavigationBar.setButtonStyleAsync("dark");
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#4A080C",
        tabBarInactiveTintColor: "#000000",
        tabBarStyle: {
          backgroundColor: "#FBF7EF",
          borderTopColor: "rgba(74, 8, 12, 0.12)",
          borderTopWidth: 0.5,
          height: 58 + Math.max(14, extraBottom),
          paddingTop: 6,
          paddingBottom: Math.max(14, extraBottom),
        },
        tabBarLabelStyle: {
          fontFamily: "WorkSans_600SemiBold",
          fontSize: 12,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="browse"
        options={{
          title: "Discover",
          tabBarIcon: ({ color, focused }) => <DiscoverTabIcon color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "My Orders",
          tabBarIcon: ({ color, focused }) => <OrdersTabIcon color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => <ProfileTabIcon color={color} focused={focused} />,
        }}
      />
    </Tabs>
  );
}

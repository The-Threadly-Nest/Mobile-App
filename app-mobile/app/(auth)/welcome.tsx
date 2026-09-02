import React from "react";
import { View, Text, Image, Pressable, StyleSheet, useWindowDimensions, ScrollView } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function WelcomeScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  return (
    <View style={[styles.container, isLandscape && { flexDirection: "row" }]}>
      {/* Top / Left Hero Image */}
      <View
        style={[
          styles.imageContainer,
          isLandscape && {
            width: "42%",
            height: "100%",
            padding: 12,
          },
        ]}
      >
        <Image
          source={require("../../assets/welcome-hero.jpg")}
          style={[styles.image, isLandscape && { borderRadius: 20 }]}
          resizeMode="cover"
        />
      </View>

      {/* Bottom / Right Content Area */}
      <SafeAreaView
        edges={["bottom", "right"]}
        style={[styles.content, isLandscape && { flex: 1, paddingHorizontal: 24, paddingTop: 16, justifyContent: "center" }]}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[isLandscape && { flexGrow: 1, justifyContent: "center" }]}
        >
          {/* Text Section */}
          <View style={[styles.textSection, isLandscape && { marginVertical: 4 }]}>
            <Text style={[styles.title, isLandscape && { fontSize: 22, lineHeight: 28, marginBottom: 6 }]}>
              Welcome to The Threadly Nest
            </Text>
            <Text style={[styles.subtitle, isLandscape && { fontSize: 13, lineHeight: 18 }]}>
              Create an account to book, track, and save your measurements across
              every fashion house you work with.
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={[styles.buttonsContainer, isLandscape && { gap: 8, marginTop: 12 }]}>
            {/* Create Account - Solid Oxblood */}
            <Pressable
              onPress={() => router.push("/(auth)/role-select")}
              style={({ pressed }) => [
                styles.createAccountBtn,
                isLandscape && { height: 48, borderRadius: 24 },
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={styles.createAccountText}>Create Account</Text>
            </Pressable>

            {/* Log In - Outlined Oxblood */}
            <Pressable
              onPress={() => router.push("/(auth)/login")}
              style={({ pressed }) => [
                styles.logInBtn,
                isLandscape && { height: 48, borderRadius: 24 },
                { opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Text style={styles.logInText}>Log In</Text>
            </Pressable>

            {/* Disclaimer */}
            <Text style={styles.disclaimerText}>
              By continuing you agree to our Terms of Service and Privacy Policy.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FBF7EF",
  },
  imageContainer: {
    width: "100%",
    height: "48%",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
    justifyContent: "space-between",
  },
  textSection: {
    marginVertical: 12,
  },
  title: {
    fontFamily: "Fraunces-Bold",
    fontSize: 28,
    lineHeight: 36,
    color: "#3B0508",
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 15,
    lineHeight: 22,
    color: "rgba(74, 8, 12, 0.75)",
  },
  buttonsContainer: {
    gap: 12,
    width: "100%",
    alignItems: "center",
  },
  createAccountBtn: {
    width: "100%",
    height: 63,
    borderRadius: 31.5,
    backgroundColor: "#4A080C",
    alignItems: "center",
    justifyContent: "center",
  },
  createAccountText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  logInBtn: {
    width: "100%",
    height: 63,
    borderRadius: 31.5,
    borderWidth: 1.5,
    borderColor: "#4A080C",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  logInText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#4A080C",
    letterSpacing: 0.2,
  },
  disclaimerText: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 12,
    lineHeight: 16,
    color: "rgba(74, 8, 12, 0.60)",
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 16,
  },
});

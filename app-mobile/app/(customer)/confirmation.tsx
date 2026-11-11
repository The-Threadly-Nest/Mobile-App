import { useState, useEffect } from "react";
import { View, ScrollView, Pressable, Switch, BackHandler } from "react-native";
import { Text } from "@/shared/components/Typography";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Check } from "lucide-react-native";
import BackArrowIcon from "@/shared/components/BackArrowIcon";

export default function BookingConfirmationScreen() {
  const params = useLocalSearchParams<{
    bookingId?: string;
    fashionHouseName?: string;
    garment?: string;
    fittingDate?: string;
    estimate?: string;
  }>();

  const fashionHouseName = params.fashionHouseName || "Fashion House";
  const garment = params.garment || "Bespoke Fitting Session";
  const fittingDate = params.fittingDate || "Fitting time to be confirmed";
  const estimate = params.estimate || "Finalized at fitting";
  const hasSavedBooking = Boolean(params.bookingId?.trim());

  const [isFavourite, setIsFavourite] = useState(false);

  useEffect(() => {
    const handleGoHome = () => {
      router.replace("/(customer)/(tabs)/browse" as any);
      return true;
    };

    const backHandler = BackHandler.addEventListener("hardwareBackPress", handleGoHome);

    return () => backHandler.remove();
  }, []);

  if (!hasSavedBooking) {
    return (
      <SafeAreaView className="flex-1 bg-cream" edges={["top", "bottom"]}>
        <View className="flex-row items-center px-6 py-3 bg-cream">
          <Pressable
            onPress={() => router.replace("/(customer)/(tabs)/browse" as any)}
            className="w-10 h-10 rounded-full border border-[#FFFFFF] bg-cream items-center justify-center mr-4"
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          >
            <BackArrowIcon size={24} color="#453332" />
          </Pressable>
          <Text className="font-display text-[20px] font-bold text-black">
            Booking Request
          </Text>
        </View>

        <View className="flex-1 px-6 items-center justify-center">
          <Text className="font-display text-[24px] font-semibold text-black mb-3 text-center">
            We could not verify this request
          </Text>
          <Text className="font-body text-[14px] text-black text-center mb-8">
            No saved booking reference was found. Please return to the fashion house and try again.
          </Text>
          <Pressable
            onPress={() => router.replace("/(customer)/(tabs)/browse" as any)}
            className="w-full max-w-[376px] h-[56px] bg-tomato rounded-full items-center justify-center"
            style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
          >
            <Text className="font-body-semibold text-[16px] text-white">Return to Browse</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top", "bottom"]}>
      {/* Top Header */}
      <View className="flex-row items-center px-6 py-3 bg-cream">
        <Pressable
          onPress={() => router.replace("/(customer)/(tabs)/browse" as any)}
          className="w-10 h-10 rounded-full border border-[#FFFFFF] bg-cream items-center justify-center mr-4"
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
        >
          <BackArrowIcon size={24} color="#2B2B2B" />
        </Pressable>
        <Text className="font-display text-[20px] font-bold text-black">
          Confirmation
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ paddingVertical: 12, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Success Icon & Message */}
        <View className="items-center mt-0 mb-2">
          <View className="w-12 h-12 rounded-full bg-[#453332] items-center justify-center mb-3">
              <Check size={30} color="#FFFFFF" strokeWidth={3} />
          </View>
          <Text className="font-display text-[24px] font-semibold text-black mb-1.5 text-center">
            Booking Request Received
          </Text>
          <Text className="font-body text-[14px] font-normal text-[#4A403B] text-center">
            Your selected fitting time is held while {fashionHouseName} reviews your request.
          </Text>
        </View>

        {/* Card 1 — Booking Summary (376x184px SVG Spec) */}
        <View className="w-full max-w-[376px] h-[184px] self-center bg-white rounded-[24px] px-6 py-5 shadow-sm justify-between">
          <View className="flex-row items-center justify-between">
            <Text className="font-body text-[14px] text-[#4A403B]">
              Fashion House
            </Text>
            <Text className="font-body-semibold text-[14px] text-black">
              {fashionHouseName}
            </Text>
          </View>

          <View className="flex-row items-center justify-between">
            <Text className="font-body text-[14px] text-[#4A403B]">Garment</Text>
            <Text className="font-body-semibold text-[14px] text-black">
              {garment}
            </Text>
          </View>

          <View className="flex-row items-center justify-between">
            <Text className="font-body text-[14px] text-[#4A403B]">
              Fitting Date
            </Text>
            <Text className="font-body-semibold text-[14px] text-black">
              {fittingDate}
            </Text>
          </View>

          <View className="flex-row items-center justify-between">
            <Text className="font-body text-[14px] text-[#4A403B]">Estimate</Text>
            <Text className="font-body-semibold text-[14px] text-black">
              {estimate}
            </Text>
          </View>
        </View>

        {/* Card 2 — WHAT HAPPENS NEXT (376x245px SVG Spec) */}
        <View className="w-full max-w-[376px] h-[245px] self-center bg-white rounded-[24px] px-6 py-5 shadow-sm justify-between">
          <Text className="font-body-bold text-[12px] uppercase tracking-wider text-black mb-0.5">
            WHAT HAPPENS NEXT
          </Text>

          <View className="flex-row items-start gap-3.5">
            <View className="w-8 h-8 rounded-full bg-cream items-center justify-center">
              <Text className="font-body-bold text-[14px] text-black">1</Text>
            </View>
            <Text className="font-body text-[14px] text-black flex-1 leading-[20px] pt-1">
              The fashion house will review your request and confirm the fitting time.
            </Text>
          </View>

          <View className="flex-row items-start gap-3.5">
            <View className="w-8 h-8 rounded-full bg-cream items-center justify-center">
              <Text className="font-body-bold text-[14px] text-black">2</Text>
            </View>
            <Text className="font-body text-[14px] text-black flex-1 leading-[20px] pt-1">
              You'll get a status update as production begins.
            </Text>
          </View>

          <View className="flex-row items-start gap-3.5">
            <View className="w-8 h-8 rounded-full bg-cream items-center justify-center">
              <Text className="font-body-bold text-[14px] text-black">3</Text>
            </View>
            <Text className="font-body text-[14px] text-black flex-1 leading-[20px] pt-1">
              We'll notify you the moment it's ready for pickup.
            </Text>
          </View>
        </View>

        {/* Card 3 — Favourites Toggle (376x56px SVG Spec) */}
        <View className="w-full max-w-[376px] h-[56px] self-center bg-white rounded-[20px] px-6 flex-row items-center justify-between shadow-sm">
          <Text className="font-body text-[15px] text-black flex-1 mr-4">
            Save {fashionHouseName} to favourites
          </Text>
          <Switch
            value={isFavourite}
            onValueChange={setIsFavourite}
            trackColor={{ false: "#FFFFFF", true: "#453332" }}
            thumbColor={isFavourite ? "#FFFFFF" : "#FFFFFF"}
          />
        </View>

        {/* Primary Action Button (376x63px SVG Spec) */}
        <Pressable
          onPress={() => router.replace("/(customer)/(tabs)/orders")}
          className="w-full max-w-[376px] h-[63px] self-center bg-tomato rounded-full items-center justify-center mt-1"
          style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
        >
          <Text className="font-body-semibold text-[16px] text-white">
            View My Requests
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

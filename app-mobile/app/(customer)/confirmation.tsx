import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Check } from "lucide-react-native";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import { useOrdersStore } from "@/stores/useOrdersStore";
import { apiFetch } from "@/shared/utils/apiClient";

export default function BookingConfirmationScreen() {
  const params = useLocalSearchParams<{
    fashionHouseName?: string;
    garment?: string;
    fittingDate?: string;
    estimate?: string;
  }>();

  const fashionHouseName = params.fashionHouseName || "Adaeze Couture";
  const garment = params.garment || "Aso-Ebi";
  const fittingDate = params.fittingDate || "Sat, 6 Sep · 10:00 AM";
  const estimate = params.estimate || "₦850,000 – ₦1,000,000";

  const [isFavourite, setIsFavourite] = useState(false);
  const addOrder = useOrdersStore((s) => s.addOrder);

  useEffect(() => {
    if (fashionHouseName && garment) {
      const randomId = Math.floor(2300 + Math.random() * 900);
      addOrder({
        id: `booking-${Date.now()}`,
        atelierName: fashionHouseName,
        garmentType: garment,
        orderNumber: `#TFH-${randomId}`,
        estimatedReady: fittingDate ? `Fitting: ${fittingDate}` : "In 2 weeks",
        progressPercent: 15,
        imageUrl: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=300&q=80",
        status: "active",
      });

      apiFetch("/api/orders/my-orders", {
        method: "POST",
        body: JSON.stringify({ fashionHouseName, garment, fittingDate }),
        silent: true,
      }).catch(() => {});
    }
  }, [fashionHouseName, garment, fittingDate, addOrder]);

  return (
    <SafeAreaView className="flex-1 bg-[#FBF7EF]" edges={["top", "bottom"]}>
      {/* Top Header */}
      <View className="flex-row items-center px-6 py-3 bg-[#FBF7EF]">
        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/(customer)/(tabs)/home");
          }}
          className="w-10 h-10 rounded-full border border-[#D1D1D1] bg-white items-center justify-center mr-4"
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
        >
          <BackArrowIcon size={18} color="#000000" />
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
          <View className="w-12 h-12 rounded-full bg-[#4A080C] items-center justify-center mb-3">
            <Check size={30} color="#C4A763" strokeWidth={3} />
          </View>
          <Text className="font-display text-[24px] font-semibold text-[#4A080C] mb-1.5 text-center">
            Booking Confirmed!
          </Text>
          <Text className="font-body text-[14px] font-normal text-[#646464] text-center">
            Your fitting is reserved at {fashionHouseName}.
          </Text>
        </View>

        {/* Card 1 — Booking Summary (376x184px SVG Spec) */}
        <View className="w-full max-w-[376px] h-[184px] self-center bg-white rounded-[24px] px-6 py-5 shadow-sm justify-between">
          <View className="flex-row items-center justify-between">
            <Text className="font-body text-[14px] text-[#646464]">
              Fashion House
            </Text>
            <Text className="font-body-semibold text-[14px] text-[#4A080C]">
              {fashionHouseName}
            </Text>
          </View>

          <View className="flex-row items-center justify-between">
            <Text className="font-body text-[14px] text-[#646464]">Garment</Text>
            <Text className="font-body-semibold text-[14px] text-[#4A080C]">
              {garment}
            </Text>
          </View>

          <View className="flex-row items-center justify-between">
            <Text className="font-body text-[14px] text-[#646464]">
              Fitting Date
            </Text>
            <Text className="font-body-semibold text-[14px] text-[#4A080C]">
              {fittingDate}
            </Text>
          </View>

          <View className="flex-row items-center justify-between">
            <Text className="font-body text-[14px] text-[#646464]">Estimate</Text>
            <Text className="font-body-semibold text-[14px] text-[#4A080C]">
              {estimate}
            </Text>
          </View>
        </View>

        {/* Card 2 — WHAT HAPPENS NEXT (376x245px SVG Spec) */}
        <View className="w-full max-w-[376px] h-[245px] self-center bg-white rounded-[24px] px-6 py-5 shadow-sm justify-between">
          <Text className="font-body-bold text-[12px] uppercase tracking-wider text-[#4A080C] mb-0.5">
            WHAT HAPPENS NEXT
          </Text>

          <View className="flex-row items-start gap-3.5">
            <View className="w-8 h-8 rounded-full bg-[#D5C4C6] items-center justify-center">
              <Text className="font-body-bold text-[14px] text-[#4A080C]">1</Text>
            </View>
            <Text className="font-body text-[14px] text-ink flex-1 leading-[20px] pt-1">
              Your measurements will be taken at the fitting.
            </Text>
          </View>

          <View className="flex-row items-start gap-3.5">
            <View className="w-8 h-8 rounded-full bg-[#D5C4C6] items-center justify-center">
              <Text className="font-body-bold text-[14px] text-[#4A080C]">2</Text>
            </View>
            <Text className="font-body text-[14px] text-ink flex-1 leading-[20px] pt-1">
              You'll get a status update as production begins.
            </Text>
          </View>

          <View className="flex-row items-start gap-3.5">
            <View className="w-8 h-8 rounded-full bg-[#D5C4C6] items-center justify-center">
              <Text className="font-body-bold text-[14px] text-[#4A080C]">3</Text>
            </View>
            <Text className="font-body text-[14px] text-ink flex-1 leading-[20px] pt-1">
              We'll notify you the moment it's ready for pickup.
            </Text>
          </View>
        </View>

        {/* Card 3 — Favourites Toggle (376x56px SVG Spec) */}
        <View className="w-full max-w-[376px] h-[56px] self-center bg-white rounded-[20px] px-6 flex-row items-center justify-between shadow-sm">
          <Text className="font-body text-[15px] text-ink flex-1 mr-4">
            Save {fashionHouseName} to favourites
          </Text>
          <Switch
            value={isFavourite}
            onValueChange={setIsFavourite}
            trackColor={{ false: "#E4D5B7", true: "#4A080C" }}
            thumbColor={isFavourite ? "#FFFFFF" : "#F4F3F4"}
          />
        </View>

        {/* Primary Action Button (376x63px SVG Spec) */}
        <Pressable
          onPress={() => router.replace("/(customer)/(tabs)/orders")}
          className="w-full max-w-[376px] h-[63px] self-center bg-[#4A080C] rounded-full items-center justify-center mt-1"
          style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
        >
          <Text className="font-body-semibold text-[16px] text-white">
            View My Orders
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

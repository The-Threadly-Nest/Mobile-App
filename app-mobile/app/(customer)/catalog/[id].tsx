import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import {
  Store,
  Clock,
  Scissors,
  MessageSquare,
  ShieldCheck,
} from "lucide-react-native";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import CachedImage from "@/shared/components/CachedImage";
import { apiFetch } from "@/shared/utils/apiClient";

export default function CatalogItemDetailScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const {
    id,
    initialName,
    initialPrice,
    initialImage,
    initialVendorName,
    initialLocation,
    initialFashionHouseId,
    badge,
    categoryTag,
  } = useLocalSearchParams<{
    id: string;
    initialName?: string;
    initialPrice?: string;
    initialImage?: string;
    initialVendorName?: string;
    initialLocation?: string;
    initialFashionHouseId?: string;
    badge?: string;
    categoryTag?: string;
  }>();

  const [garmentData, setGarmentData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(!initialName);

  useEffect(() => {
    let mounted = true;
    if (id && id !== "m1" && id !== "m2" && id !== "m3" && id !== "m4") {
      apiFetch<any>(`/api/catalog/item/${id}`, { silent: true })
        .then((data) => {
          if (mounted && data) setGarmentData(data);
        })
        .catch(() => {})
        .finally(() => {
          if (mounted) setLoading(false);
        });
    } else {
      setLoading(false);
    }
    return () => {
      mounted = false;
    };
  }, [id]);

  const garmentName = garmentData?.name || initialName || "Bespoke Tailored Garment";
  const garmentPrice =
    typeof garmentData?.priceFrom === "number"
      ? `From ₦ ${(garmentData.priceFrom / 100).toLocaleString()}`
      : initialPrice || "From ₦ 150,000";

  const imageUrl =
    garmentData?.imageUrl ||
    initialImage ||
    "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800&q=80";
  const fashionHouseId =
    garmentData?.fashionHouseId || garmentData?.fashionHouse?.id || initialFashionHouseId || "1";
  const vendorName =
    garmentData?.fashionHouse?.shopName || initialVendorName || "Luxury Fashion House";
  const vendorLocation =
    garmentData?.fashionHouse?.location || initialLocation || "Lagos, Nigeria";
  const badgeLabel = badge || (categoryTag ? categoryTag.toUpperCase() : "BESPOKE GARMENT");

  const handleBookFitting = () => {
    router.push({
      pathname: `/(customer)/chat/${fashionHouseId}`,
      params: {
        fashionHouseName: vendorName,
        garmentName: garmentName,
        garmentPrice: garmentPrice,
      },
    });
  };

  const handleViewFashionHouse = () => {
    router.push({
      pathname: `/(customer)/fashion-house/${fashionHouseId}`,
      params: {
        initialName: vendorName,
        initialLocation: vendorLocation,
      },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header Bar */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <BackArrowIcon size={20} color="#3A2E1A" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Cloth Details
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isLandscape && { maxWidth: 900, alignSelf: "center", width: "100%" },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Cloth Image Card */}
        <View style={styles.imageCard}>
          <CachedImage
            source={{ uri: imageUrl }}
            style={[styles.heroImage, isLandscape && { height: 320 }]}
          />
          <View style={styles.badgePill}>
            <Text style={styles.badgeText}>{badgeLabel}</Text>
          </View>
        </View>

        {/* Cloth Title & Pricing */}
        <View style={styles.titleSection}>
          <Text style={styles.garmentTitle}>{garmentName}</Text>
          <Text style={styles.garmentPrice}>{garmentPrice}</Text>
          <Text style={styles.garmentSubtitle}>
            Handcrafted luxury garment custom fitted to your exact body measurements by our master tailors.
          </Text>
        </View>

        {/* Creator / Fashion House Card */}
        <Pressable
          style={({ pressed }) => [
            styles.vendorCard,
            { transform: [{ scale: pressed ? 0.99 : 1 }] },
          ]}
          onPress={handleViewFashionHouse}
        >
          <View style={styles.vendorIconCircle}>
            <Store size={22} color="#4A080C" />
          </View>
          <View style={styles.vendorInfo}>
            <Text style={styles.vendorLabel}>CRAFTED BY</Text>
            <Text style={styles.vendorName}>{vendorName}</Text>
            <Text style={styles.vendorLocation}>{vendorLocation} · 4.9 ★</Text>
          </View>
          <View style={styles.viewProfileBtn}>
            <Text style={styles.viewProfileText}>View House</Text>
          </View>
        </Pressable>

        {/* Garment Specifications & Details */}
        <View style={styles.specsContainer}>
          <Text style={styles.specsTitle}>GARMENT SPECIFICATIONS</Text>

          <View style={styles.specRow}>
            <Clock size={18} color="#C4A763" style={styles.specIcon} />
            <View style={styles.specTextCol}>
              <Text style={styles.specHeading}>Turnaround & Fitting</Text>
              <Text style={styles.specDetail}>2 - 4 weeks from measurement confirmation session</Text>
            </View>
          </View>

          <View style={styles.specRow}>
            <Scissors size={18} color="#C4A763" style={styles.specIcon} />
            <View style={styles.specTextCol}>
              <Text style={styles.specHeading}>Custom Tailoring & Fabric</Text>
              <Text style={styles.specDetail}>
                Custom fabric selection available. Crafted using premium imported silk, velvet, or handwoven lace.
              </Text>
            </View>
          </View>

          <View style={styles.specRow}>
            <ShieldCheck size={18} color="#C4A763" style={styles.specIcon} />
            <View style={styles.specTextCol}>
              <Text style={styles.specHeading}>Perfect Fit Guarantee</Text>
              <Text style={styles.specDetail}>
                Includes 1 complimentary alteration session after initial completion.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Sticky Action Bar */}
      <View style={styles.bottomBar}>
        <Pressable
          style={({ pressed }) => [styles.bookBtn, { opacity: pressed ? 0.9 : 1 }]}
          onPress={handleBookFitting}
        >
          <MessageSquare size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.bookBtnText}>Book Fitting & Custom Order</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FBF7EF",
  },
  header: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(58, 46, 26, 0.08)",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(58, 46, 26, 0.05)",
  },
  headerTitle: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#3A2E1A",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 90,
  },
  imageCard: {
    position: "relative",
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 16,
    backgroundColor: "#E4D5B7",
  },
  heroImage: {
    width: "100%",
    height: 280,
  },
  badgePill: {
    position: "absolute",
    top: 14,
    left: 14,
    backgroundColor: "#4A080C",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    fontFamily: "WorkSans_700Bold",
    fontSize: 11,
    color: "#FBF7EF",
    letterSpacing: 0.5,
  },
  titleSection: {
    marginBottom: 20,
  },
  garmentTitle: {
    fontFamily: "Fraunces_700Bold",
    fontSize: 22,
    color: "#4A080C",
    marginBottom: 6,
  },
  garmentPrice: {
    fontFamily: "WorkSans_700Bold",
    fontSize: 20,
    color: "#C4A763",
    marginBottom: 8,
  },
  garmentSubtitle: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 14,
    color: "#8A7550",
    lineHeight: 20,
  },
  vendorCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(58, 46, 26, 0.1)",
    marginBottom: 20,
  },
  vendorIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FBF7EF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#E4D5B7",
  },
  vendorInfo: {
    flex: 1,
  },
  vendorLabel: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 10,
    color: "#8A7550",
    letterSpacing: 0.5,
  },
  vendorName: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 15,
    color: "#3A2E1A",
  },
  vendorLocation: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 12,
    color: "#8A7550",
    marginTop: 2,
  },
  viewProfileBtn: {
    backgroundColor: "#FBF7EF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#C4A763",
  },
  viewProfileText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 12,
    color: "#4A080C",
  },
  specsContainer: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(58, 46, 26, 0.1)",
    marginBottom: 16,
  },
  specsTitle: {
    fontFamily: "WorkSans_700Bold",
    fontSize: 12,
    color: "#3A2E1A",
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  specRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  specIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  specTextCol: {
    flex: 1,
  },
  specHeading: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 14,
    color: "#3A2E1A",
  },
  specDetail: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 13,
    color: "#8A7550",
    marginTop: 2,
    lineHeight: 18,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(58, 46, 26, 0.1)",
  },
  bookBtn: {
    backgroundColor: "#4A080C",
    height: 50,
    borderRadius: 25,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  bookBtnText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 15,
    color: "#FFFFFF",
  },
});

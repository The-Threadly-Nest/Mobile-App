import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ImageSourcePropType,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Star, Calendar, Store } from "lucide-react-native";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import { MOCK_TAILORS } from "../(tabs)/browse";
import { apiFetch } from "@/shared/utils/apiClient";
import CachedImage from "@/shared/components/CachedImage";

const PORTFOLIO_IMAGES: Record<string, ImageSourcePropType[]> = {
  "1": [
    require("../../../assets/tailor-1.png"),
    require("../../../assets/tailor-2.png"),
    require("../../../assets/tailor-3.png"),
    require("../../../assets/tailor-4.png"),
  ],
  "2": [
    require("../../../assets/tailor-2.png"),
    require("../../../assets/tailor-1.png"),
    require("../../../assets/tailor-4.png"),
    require("../../../assets/tailor-3.png"),
  ],
  "3": [
    require("../../../assets/tailor-3.png"),
    require("../../../assets/tailor-4.png"),
    require("../../../assets/tailor-1.png"),
    require("../../../assets/tailor-2.png"),
  ],
  "4": [
    require("../../../assets/tailor-4.png"),
    require("../../../assets/tailor-3.png"),
    require("../../../assets/tailor-2.png"),
    require("../../../assets/tailor-1.png"),
  ],
};

const MOCK_REVIEWS: Record<string, { name: string; text: string; rating: number }[]> = {
  "1": [
    { name: "Folake A.", text: "Made my traditional wedding outfit in 10 days flat. Fitting was 100% on point.", rating: 5 },
    { name: "Kemi O.", text: "Beautiful beading work! Highly attentive to customer details.", rating: 5 },
  ],
  "2": [
    { name: "Tolu B.", text: "Best gele styling in Akure hands down. Stayed in place all through the event.", rating: 5 },
  ],
  "3": [
    { name: "Chuka E.", text: "The senator suit cut was crisp. Fits better than off-the-rack luxury brands.", rating: 4 },
  ],
  "4": [
    { name: "Segun M.", text: "Lightweight fabric, perfect stitching. Got so many compliments at the event.", rating: 5 },
  ],
};

function renderStars(rating: number) {
  return Array.from({ length: 5 }).map((_, i) => (
    <Star
      key={i}
      size={14}
      color="#E5A817"
      fill={i < Math.floor(rating) ? "#E5A817" : "transparent"}
      style={{ marginRight: 2 }}
    />
  ));
}

export default function FashionHouseScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const {
    fashionHouseId,
    initialName,
    initialLocation,
    initialImage,
    initialBio,
  } = useLocalSearchParams<{
    fashionHouseId: string;
    initialName?: string;
    initialLocation?: string;
    initialImage?: string;
    initialBio?: string;
  }>();

  const targetId = fashionHouseId || "1";
  const isMockId = ["1", "2", "3", "4"].includes(targetId);

  const [fhData, setFhData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    async function loadDetails() {
      try {
        const fetched = await apiFetch<any>(`/api/fashion-houses/${targetId}`, { silent: true }).catch(() => null);
        if (mounted && fetched && fetched.id) {
          setFhData(fetched);
        }
      } catch (e) {
        console.log("Could not load fashion house details:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadDetails();
    return () => {
      mounted = false;
    };
  }, [targetId]);

  // Only fallback to MOCK_TAILORS if it is explicitly a mock ID (1-4)
  const mockTailor = isMockId ? (MOCK_TAILORS.find((t) => t.id === targetId) || MOCK_TAILORS[0]) : null;

  const displayName = fhData?.shopName || initialName || mockTailor?.name || "Fashion House";
  const displayLocation = fhData?.location || initialLocation || mockTailor?.location || "Nigeria";
  const displayBio =
    fhData?.bio ||
    initialBio ||
    (mockTailor ? `Welcome to ${displayName}. Known for handcrafted bespoke attire, precision fittings, and elegant designs.` : "");

  const coverImage =
    fhData?.brandLogoUrl ||
    (fhData?.catalogItems && fhData.catalogItems.length > 0 ? fhData.catalogItems[0].imageUrl : null) ||
    initialImage ||
    (typeof mockTailor?.image === "string" ? mockTailor.image : null);

  const mockPortfolio = isMockId ? (PORTFOLIO_IMAGES[targetId] || PORTFOLIO_IMAGES["1"]) : [];
  const catalogItems = fhData?.catalogItems || [];

  const defaultMockReviews = [
    {
      name: "Chiamaka O.",
      text: "My bridal aso-ebi fit perfectly at the first try-on. Worth every naira.",
      rating: 5,
    },
    {
      name: "Blessing A.",
      text: "Delivered three days ahead of my wedding. Very calm communication throughout.",
      rating: 5,
    },
  ];

  const reviews =
    Array.isArray(fhData?.reviews) && fhData.reviews.length > 0
      ? fhData.reviews.map((r: any) => ({
          name: r.user?.name || r.name || "Customer",
          text: r.comment || r.text || "",
          rating: r.rating || 5,
        }))
      : isMockId && MOCK_REVIEWS[targetId]
      ? MOCK_REVIEWS[targetId]
      : defaultMockReviews;

  const rawOrdersCount = fhData?.ordersCount ?? fhData?._count?.orders ?? (isMockId ? 2100 : 0);

  const formatOrdersText = (count: number) => {
    if (count >= 1000) {
      const formatted = (count / 1000).toFixed(1).replace(/\.0$/, "");
      return `${formatted}k+`;
    }
    if (count > 0) {
      return `${count}+`;
    }
    return "2k+";
  };

  if (loading && !fhData && !initialName && !mockTailor) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: "center", alignItems: "center" }]} edges={["top"]}>
        <ActivityIndicator size="large" color="#4A080C" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 24, paddingBottom: Math.max(insets.bottom, 33) }}
      >
        {/* Hero Image */}
        <View style={[styles.heroContainer, isLandscape && { height: 180 }]}>
          {coverImage ? (
            <CachedImage source={{ uri: coverImage }} style={styles.heroImage} />
          ) : (
            <CachedImage source={require("../../../assets/tailor-1.png")} style={styles.heroImage} />
          )}

          {/* Dark Overlay for crisp text readability */}
          <View style={styles.heroOverlay} />

          {/* Back Button */}
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <BackArrowIcon size={18} color="#3A2E1A" />
          </Pressable>

          {/* Hero Title */}
          <View style={styles.heroTitle}>
            <Text style={[styles.heroName, isLandscape && { fontSize: 20 }]}>{displayName}</Text>
            <View style={styles.heroRatingRow}>
              {renderStars(4.9)}
              <Text style={styles.heroRatingText}>4.9 ({formatOrdersText(rawOrdersCount)})</Text>
            </View>
          </View>
        </View>

        {/* Stats Row - Moved down below hero photo */}
        <View style={[styles.statsCard, isLandscape && { maxWidth: 760, alignSelf: "center", width: "100%" }]}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>3 wks</Text>
            <Text style={styles.statLabel}>TURNAROUND</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>₦1.2M</Text>
            <Text style={styles.statLabel}>PRICE RANGE</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue} numberOfLines={1}>{displayLocation}</Text>
            <Text style={styles.statLabel}>LOCATION</Text>
          </View>
        </View>

        {/* About Section */}
        <View style={[styles.section, isLandscape && { maxWidth: 760, alignSelf: "center", width: "100%" }]}>
          <Text style={styles.sectionTitle}>ABOUT</Text>
          <Text style={styles.aboutText}>{displayBio}</Text>
        </View>

        {/* Portfolio Section */}
        <View style={[styles.section, isLandscape && { maxWidth: 760, alignSelf: "center", width: "100%" }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>PORTFOLIO</Text>
            <Pressable onPress={() => {}}>
              <Text style={styles.viewAllText}>View All</Text>
            </Pressable>
          </View>

          {catalogItems.length > 0 ? (
            <View style={styles.portfolioGrid}>
              {catalogItems.map((item: any) => {
                const formattedPrice =
                  typeof item.priceFrom === "number"
                    ? `From ₦ ${item.priceFrom.toLocaleString()}`
                    : item.priceFrom
                      ? `From ${item.priceFrom}`
                      : "Price on Request";

                return (
                  <Pressable
                    key={item.id}
                    style={styles.portfolioItemCard}
                    onPress={() => {
                      router.push({
                        pathname: `/(customer)/catalog/${item.id}`,
                        params: {
                          initialName: item.name,
                          initialPrice: formattedPrice,
                          initialImage: item.imageUrl,
                          initialVendorName: displayName,
                          initialLocation: displayLocation,
                          initialFashionHouseId: targetId,
                        },
                      });
                    }}
                  >
                    <CachedImage source={{ uri: item.imageUrl }} style={styles.portfolioImage} />
                  </Pressable>
                );
              })}
            </View>
          ) : fhData ? (
            <View style={styles.emptyCatalogCard}>
              <Store size={24} color="#8A7550" style={{ marginBottom: 6 }} />
              <Text style={styles.emptyCatalogTitle}>No catalog items listed yet</Text>
              <Text style={styles.emptyCatalogSubtext}>
                You can still book a fitting appointment directly with {displayName}!
              </Text>
            </View>
          ) : mockPortfolio.length > 0 ? (
            <View style={styles.portfolioGrid}>
              {mockPortfolio.map((img, i) => (
                <View key={i} style={styles.portfolioItemCard}>
                  <CachedImage source={img} style={styles.portfolioImage} />
                </View>
              ))}
            </View>
          ) : (
            <View style={{ paddingVertical: 20, alignItems: "center" }}>
              <ActivityIndicator size="small" color="#4A080C" />
            </View>
          )}
        </View>

        {/* Reviews Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>REVIEWS</Text>
          <View style={styles.reviewsCard}>
            {reviews.map((review: any, i: number) => (
              <View key={i}>
                <View style={styles.reviewItem}>
                  <View style={styles.reviewHeader}>
                    <Text style={styles.reviewName}>{review.name}</Text>
                    <View style={styles.reviewStars}>{renderStars(review.rating)}</View>
                  </View>
                  <Text style={styles.reviewText}>{review.text}</Text>
                </View>
                {i < reviews.length - 1 && <View style={styles.reviewDashedDivider} />}
              </View>
            ))}

            <Pressable
              style={styles.seeAllBtn}
              onPress={() => router.push(`/(customer)/reviews/${targetId}`)}
            >
              <Text style={styles.seeAllText}>See all reviews</Text>
            </Pressable>
          </View>
        </View>

        {/* Action Buttons - Below Reviews */}
        <View style={{ paddingHorizontal: 20, marginTop: 28, flexDirection: 'row', gap: 12 }}>
          <Pressable
            style={({ pressed }) => [
              styles.bookingBtn,
              { flex: 1, backgroundColor: '#EFECE6', opacity: pressed ? 0.9 : 1 },
            ]}
            onPress={() =>
              router.push({
                pathname: `/(customer)/direct-chat/${targetId}`,
                params: { fashionHouseName: displayName },
              })
            }
          >
            <Text style={[styles.bookingBtnText, { color: '#4A080C' }]}>Message</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.bookingBtn, { flex: 1.4, opacity: pressed ? 0.9 : 1 }]}
            onPress={() =>
              router.push({
                pathname: `/(customer)/chat/${targetId}`,
                params: { fashionHouseName: displayName },
              })
            }
          >
            <Text style={styles.bookingBtnText}>Start Booking</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FBF7EF",
  },
  heroContainer: {
    position: "relative",
    height: 280,
  },
  heroImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  heroOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  backBtn: {
    position: "absolute",
    top: 16,
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  heroTitle: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
  },
  heroName: {
    fontFamily: "Fraunces-Bold",
    fontSize: 26,
    color: "#FFFFFF",
    marginBottom: 4,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroRatingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  heroRatingText: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 13,
    color: "#FFFFFF",
    marginLeft: 4,
  },
  statsCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    marginTop: 36,
    borderRadius: 16,
    paddingVertical: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    zIndex: 10,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 4,
  },
  statValue: {
    fontFamily: "Fraunces-Bold",
    fontSize: 15,
    color: "#1A150E",
    marginBottom: 4,
  },
  statLabel: {
    fontFamily: "WorkSans_500Medium",
    fontSize: 10,
    color: "#6B5E4C",
    letterSpacing: 0.6,
  },
  statDivider: {
    width: 1,
    backgroundColor: "#E8E1D5",
    marginVertical: 4,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 13,
    color: "#4A080C",
    letterSpacing: 1.2,
  },
  viewAllText: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 14,
    color: "#3A2E1A",
  },
  aboutText: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 14,
    color: "#3A2E1A",
    lineHeight: 22,
  },
  portfolioGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },
  portfolioItemCard: {
    width: "31%",
  },
  portfolioImage: {
    width: "100%",
    height: 103,
    borderRadius: 16,
    resizeMode: "cover",
  },
  catalogCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: "#F0EBE1",
  },
  catalogImage: {
    width: "100%",
    height: 120,
    borderRadius: 10,
    marginBottom: 8,
  },
  catalogTitle: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 14,
    color: "#3A2E1A",
  },
  catalogPrice: {
    fontFamily: "WorkSans_500Medium",
    fontSize: 13,
    color: "#4A080C",
    marginTop: 2,
  },
  emptyCatalogCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EBE0D3",
  },
  emptyCatalogTitle: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 15,
    color: "#3A2E1A",
    marginBottom: 4,
  },
  emptyCatalogSubtext: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 13,
    color: "#8A7550",
    textAlign: "center",
  },
  reviewsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  reviewItem: {
    paddingVertical: 14,
  },
  reviewDashedDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#C8BFB0",
    borderStyle: "dashed",
    marginVertical: 2,
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  reviewName: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 14,
    color: "#1A150E",
  },
  reviewStars: {
    flexDirection: "row",
  },
  reviewText: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 13,
    color: "#4A4235",
    lineHeight: 20,
  },
  seeAllBtn: {
    marginTop: 8,
    paddingVertical: 14,
    backgroundColor: "#E8E1D5",
    borderRadius: 50,
    alignItems: "center",
  },
  seeAllText: {
    fontFamily: "WorkSans_500Medium",
    fontSize: 14,
    color: "#3A2E1A",
  },
  bookingBtn: {
    backgroundColor: "#4A080C",
    width: "100%",
    maxWidth: 376,
    height: 63,
    borderRadius: 31.5,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  bookingBtnText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
  },
});

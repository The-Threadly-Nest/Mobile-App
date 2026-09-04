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
import { SafeAreaView } from "react-native-safe-area-context";
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
  const reviews = isMockId ? (MOCK_REVIEWS[targetId] || MOCK_REVIEWS["1"]) : [];

  if (loading && !fhData && !initialName && !mockTailor) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: "center", alignItems: "center" }]} edges={["top"]}>
        <ActivityIndicator size="large" color="#4A080C" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero Image */}
        <View style={[styles.heroContainer, isLandscape && { height: 180 }]}>
          {coverImage ? (
            <CachedImage source={{ uri: coverImage }} style={styles.heroImage} />
          ) : (
            <CachedImage source={require("../../../assets/tailor-1.png")} style={styles.heroImage} />
          )}
          {/* Gradient overlay */}
          <View style={styles.heroOverlay} />

          {/* Back Button */}
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <BackArrowIcon size={20} color="#3A2E1A" />
          </Pressable>

          {/* Hero Title */}
          <View style={styles.heroTitle}>
            <Text style={[styles.heroName, isLandscape && { fontSize: 20 }]}>{displayName}</Text>
            <View style={styles.heroRatingRow}>
              {renderStars(5.0)}
              <Text style={styles.heroRatingText}>5.0 (Fashion House)</Text>
            </View>
          </View>
        </View>

        {/* Stats Row */}
        <View style={[styles.statsCard, isLandscape && { maxWidth: 760, alignSelf: "center", width: "100%" }]}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>2 wks</Text>
            <Text style={styles.statLabel}>TURNAROUND</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>Bespoke</Text>
            <Text style={styles.statLabel}>SERVICE</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue} numberOfLines={1}>{displayLocation}</Text>
            <Text style={styles.statLabel}>LOCATION</Text>
          </View>
        </View>

        {/* About Section */}
        <View style={[styles.section, isLandscape && { maxWidth: 760, alignSelf: "center", width: "100%" }]}>
          <Text style={styles.sectionTitle}>ABOUT THIS FASHION HOUSE</Text>
          <Text style={styles.aboutText}>{displayBio}</Text>
        </View>

        {/* Portfolio / Catalog Section */}
        <View style={[styles.section, isLandscape && { maxWidth: 760, alignSelf: "center", width: "100%" }]}>
          <Text style={styles.sectionTitle}>PORTFOLIO & CATALOG</Text>

          {catalogItems.length > 0 ? (
            <View style={styles.portfolioGrid}>
              {catalogItems.map((item: any) => (
                <Pressable
                  key={item.id}
                  style={styles.catalogCard}
                  onPress={() => {
                    router.push({
                      pathname: `/(customer)/chat/${targetId}`,
                      params: {
                        fashionHouseName: displayName,
                        garmentName: item.name,
                        garmentPrice: `From ₦ ${(item.priceFrom / 100).toLocaleString()}`,
                      },
                    });
                  }}
                >
                  <CachedImage source={{ uri: item.imageUrl }} style={styles.catalogImage} />
                  <Text style={styles.catalogTitle} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.catalogPrice}>
                    From ₦ {(item.priceFrom / 100).toLocaleString()}
                  </Text>
                </Pressable>
              ))}
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
                <CachedImage
                  key={i}
                  source={img}
                  style={[styles.portfolioImage, isLandscape && { width: "31%", height: 110 }]}
                />
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
            {reviews.map((review, i) => (
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

        {/* CTAs — Booking Button */}
        <View style={styles.ctaContainer}>
          <Pressable
            style={styles.bookingBtn}
            onPress={() =>
              router.push({
                pathname: `/(customer)/chat/${targetId}`,
                params: { fashionHouseName: displayName },
              })
            }
          >
            <Calendar size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.bookingBtnText}>Book Appointment</Text>
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
    bottom: 0,
    left: 0,
    right: 0,
    height: "60%",
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
    marginTop: -16,
    borderRadius: 16,
    paddingVertical: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
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
  sectionTitle: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 12,
    color: "#4A080C",
    letterSpacing: 1.2,
    marginBottom: 10,
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
    gap: 12,
  },
  portfolioImage: {
    width: "48%",
    height: 140,
    borderRadius: 12,
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
  ctaContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 36,
  },
  bookingBtn: {
    backgroundColor: "#4A080C",
    borderRadius: 50,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  bookingBtnText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
  },
});

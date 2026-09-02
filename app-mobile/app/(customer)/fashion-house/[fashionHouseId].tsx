import React from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  StyleSheet,
  ImageSourcePropType,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Star } from "lucide-react-native";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import { MOCK_TAILORS } from "../(tabs)/browse";

const PORTFOLIO_IMAGES: Record<string, ImageSourcePropType[]> = {
  "1": [
    require("../../../assets/tailor-1.png"),
    require("../../../assets/tailor-2.png"),
    require("../../../assets/tailor-3.png"),
    require("../../../assets/tailor-4.png"),
    require("../../../assets/tailor-1.png"),
    require("../../../assets/tailor-2.png"),
  ],
  "2": [
    require("../../../assets/tailor-2.png"),
    require("../../../assets/tailor-1.png"),
    require("../../../assets/tailor-4.png"),
    require("../../../assets/tailor-3.png"),
    require("../../../assets/tailor-2.png"),
    require("../../../assets/tailor-4.png"),
  ],
  "3": [
    require("../../../assets/tailor-3.png"),
    require("../../../assets/tailor-4.png"),
    require("../../../assets/tailor-1.png"),
    require("../../../assets/tailor-2.png"),
    require("../../../assets/tailor-3.png"),
    require("../../../assets/tailor-1.png"),
  ],
  "4": [
    require("../../../assets/tailor-4.png"),
    require("../../../assets/tailor-3.png"),
    require("../../../assets/tailor-2.png"),
    require("../../../assets/tailor-1.png"),
    require("../../../assets/tailor-4.png"),
    require("../../../assets/tailor-3.png"),
  ],
};

const ABOUT_TEXT: Record<string, string> = {
  "1": "Adaeze Couture has dressed brides across Lagos and Abuja for twelve years, known for hand-beaded aso-ebi and structured bridal gowns that hold their shape through a full owambe weekend.",
  "2": "The Gele Room is Akure's premier gele studio. Their master tyers transform yards of aso-oke into sculptural headpieces that complement any occasion, from owambe to intimate family ceremonies.",
  "3": "Iyanuade Atelier specialises in agbada and senator styles, blending traditional Nigerian silhouettes with contemporary tailoring for the modern Nigerian gentleman.",
  "4": "Kaftan & Co curates the finest native wear fabrics and brings them to life with skilled artisans, delivering bespoke kaftans that speak to culture and elegance.",
};

const MOCK_REVIEWS: Record<string, { name: string; text: string; rating: number }[]> = {
  "1": [
    { name: "Folake A.", text: "Made my traditional wedding outfit in 10 days flat. Fitting was 100% on point.", rating: 5 },
    { name: "Kemi O.", text: "Beautiful beading work! Adaeze is so attentive to customer details.", rating: 5 },
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

  const { fashionHouseId } = useLocalSearchParams<{ fashionHouseId: string }>();
  const tailor = MOCK_TAILORS.find((t) => t.id === fashionHouseId) ?? MOCK_TAILORS[0];
  const portfolioImages = PORTFOLIO_IMAGES[fashionHouseId ?? "1"] ?? PORTFOLIO_IMAGES["1"];
  const aboutText = ABOUT_TEXT[fashionHouseId ?? "1"] ?? ABOUT_TEXT["1"];
  const reviews = MOCK_REVIEWS[fashionHouseId ?? "1"] ?? MOCK_REVIEWS["1"];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero Image */}
        <View style={[styles.heroContainer, isLandscape && { height: 180 }]}>
          <Image
            source={typeof tailor.image === "string" ? { uri: tailor.image } : tailor.image}
            style={styles.heroImage}
          />
          {/* Gradient overlay */}
          <View style={styles.heroOverlay} />

          {/* Back Button */}
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <BackArrowIcon size={20} color="#3A2E1A" />
          </Pressable>

          {/* Hero Title */}
          <View style={styles.heroTitle}>
            <Text style={[styles.heroName, isLandscape && { fontSize: 20 }]}>{tailor.name}</Text>
            <View style={styles.heroRatingRow}>
              {renderStars(tailor.rating)}
              <Text style={styles.heroRatingText}>
                {tailor.rating} ({tailor.reviewsCount})
              </Text>
            </View>
          </View>
        </View>

        {/* Stats Row */}
        <View style={[styles.statsCard, isLandscape && { maxWidth: 760, alignSelf: "center", width: "100%" }]}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {tailor.turnaround.replace(" turnaround", "").replace("-week", " wks")}
            </Text>
            <Text style={styles.statLabel}>TURNAROUND</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{tailor.price.replace("₦ ", "₦")}</Text>
            <Text style={styles.statLabel}>PRICE RANGE</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{tailor.location}</Text>
            <Text style={styles.statLabel}>LOCATION</Text>
          </View>
        </View>

        {/* About Section */}
        <View style={[styles.section, isLandscape && { maxWidth: 760, alignSelf: "center", width: "100%" }]}>
          <Text style={styles.sectionTitle}>ABOUT</Text>
          <Text style={styles.aboutText}>{aboutText}</Text>
        </View>

        {/* Portfolio Section */}
        <View style={[styles.section, isLandscape && { maxWidth: 760, alignSelf: "center", width: "100%" }]}>
          <Text style={styles.sectionTitle}>PORTFOLIO</Text>
          <View style={styles.portfolioGrid}>
            {portfolioImages.map((img, i) => (
              <Image
                key={i}
                source={img}
                style={[styles.portfolioImage, isLandscape && { width: "31%", height: 110 }]}
              />
            ))}
          </View>
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

            {/* See all reviews */}
            <Pressable
              style={styles.seeAllBtn}
              onPress={() => router.push(`/(customer)/reviews/${fashionHouseId}`)}
            >
              <Text style={styles.seeAllText}>See all reviews</Text>
            </Pressable>
          </View>
        </View>

        {/* CTAs — inside scroll, below reviews */}
        <View style={styles.ctaContainer}>
          <Pressable
            style={styles.bookingBtn}
            onPress={() => router.push(`/(customer)/chat/${fashionHouseId}`)}
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
    height: 300,
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
    backgroundColor: "transparent",
    // gradient-like fade from transparent to semi-black
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
  },
  statValue: {
    fontFamily: "Fraunces-Bold",
    fontSize: 16,
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
    gap: 6,
  },
  portfolioImage: {
    width: "31.5%",
    aspectRatio: 1,
    borderRadius: 10,
    resizeMode: "cover",
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
    gap: 12,
  },
  checkFashionHouseBtn: {
    borderWidth: 1.5,
    borderColor: "#4A080C",
    borderRadius: 50,
    paddingVertical: 14,
    alignItems: "center",
  },
  checkFashionHouseBtnText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 15,
    color: "#4A080C",
  },
  bookingBtn: {
    backgroundColor: "#4A080C",
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: "center",
  },
  bookingBtnText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
  },
});

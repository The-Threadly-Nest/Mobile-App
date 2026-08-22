import React from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Star } from "lucide-react-native";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import { MOCK_TAILORS } from "../(tabs)/browse";

export interface FullReviewItem {
  id: string;
  name: string;
  tag: string;
  date: string;
  rating: number;
  text: string;
}

export const ALL_REVIEWS: Record<string, FullReviewItem[]> = {
  "1": [
    {
      id: "r1",
      name: "Chiamaka O.",
      tag: "Aso-Ebi",
      date: "18 Aug 2026",
      rating: 5,
      text: "My bridal aso-ebi fit perfectly at the first try-on. Worth every naira.",
    },
    {
      id: "r2",
      name: "Blessing A.",
      tag: "Bridal Gown",
      date: "04 Aug 2026",
      rating: 5,
      text: "Delivered three days ahead of my wedding. Very calm communication throughout.",
    },
    {
      id: "r3",
      name: "Tomi A.",
      tag: "Bridal Gown",
      date: "29 Jul 2026",
      rating: 4,
      text: "Great service from start to finish. My outfit was delivered on time and looked even better than I imagined.",
    },
    {
      id: "r4",
      name: "Ifeoma N.",
      tag: "Aso-Ebi",
      date: "22 Jul 2026",
      rating: 4,
      text: "Beautiful beadwork. Took a week longer than quoted, but they kept me informed the whole time.",
    },
    {
      id: "r5",
      name: "Adeola B.",
      tag: "Aso-Ebi",
      date: "08 Jul 2026",
      rating: 5,
      text: "The fit was perfect, and the finishing was beautiful. They really understood what I wanted.",
    },
  ],
  "2": [
    {
      id: "r21",
      name: "Temi F.",
      tag: "Gele",
      date: "15 Aug 2026",
      rating: 5,
      text: "The gele was absolutely stunning. Everyone was asking who tied it.",
    },
    {
      id: "r22",
      name: "Amaka N.",
      tag: "Accessories",
      date: "02 Aug 2026",
      rating: 4,
      text: "Professional service and beautiful results. Will definitely return.",
    },
    {
      id: "r23",
      name: "Yinka T.",
      tag: "Bridal Gele",
      date: "20 Jul 2026",
      rating: 5,
      text: "Flawless structure and lasted the entire day without shifting.",
    },
  ],
  "3": [
    {
      id: "r31",
      name: "Kunle B.",
      tag: "Agbada",
      date: "12 Aug 2026",
      rating: 5,
      text: "Best agbada I've ever owned. The embroidery work is exceptional.",
    },
    {
      id: "r32",
      name: "Tunde M.",
      tag: "Senator Style",
      date: "30 Jul 2026",
      rating: 5,
      text: "Ready before the promised date and fits like a glove.",
    },
    {
      id: "r33",
      name: "Bayo A.",
      tag: "Native Wear",
      date: "14 Jul 2026",
      rating: 4,
      text: "Top tier craftsmanship. Premium fabric and clean stitching.",
    },
  ],
  "4": [
    {
      id: "r41",
      name: "Chidi O.",
      tag: "Kaftan",
      date: "10 Aug 2026",
      rating: 5,
      text: "Beautiful fabrics and expert craftsmanship. The kaftan is stunning.",
    },
    {
      id: "r42",
      name: "Emeka P.",
      tag: "Native Set",
      date: "25 Jul 2026",
      rating: 4,
      text: "Ordered for Eid and it was delivered on time. Very satisfied.",
    },
  ],
};

function renderStars(rating: number) {
  return Array.from({ length: 5 }).map((_, i) => (
    <Star
      key={i}
      size={14}
      color="#E5A817"
      fill={i < rating ? "#E5A817" : "transparent"}
      style={{ marginRight: 2 }}
    />
  ));
}

export default function AllReviewsScreen() {
  const { fashionHouseId } = useLocalSearchParams<{ fashionHouseId: string }>();
  const tailor = MOCK_TAILORS.find((t) => t.id === fashionHouseId) ?? MOCK_TAILORS[0];
  const reviews = ALL_REVIEWS[fashionHouseId ?? "1"] ?? ALL_REVIEWS["1"];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header Bar */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <BackArrowIcon size={20} color="#3A2E1A" />
        </Pressable>
        <Text style={styles.headerTitle}>
          <Text style={styles.titleReviews}>Reviews</Text>
          <Text style={styles.titleDot}>  •  </Text>
          <Text style={styles.titleHouseName}>{tailor.name}</Text>
        </Text>
      </View>

      {/* Reviews List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {reviews.map((review) => (
          <View key={review.id} style={styles.reviewCard}>
            {/* Top Row: Name and Stars */}
            <View style={styles.cardHeader}>
              <Text style={styles.reviewerName}>{review.name}</Text>
              <View style={styles.starsRow}>{renderStars(review.rating)}</View>
            </View>

            {/* Sub-row: Category Tag and Date */}
            <Text style={styles.subtext}>
              {review.tag}  •  {review.date}
            </Text>

            {/* Review Comment Text */}
            <Text style={styles.reviewBody}>{review.text}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FBF7EF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    marginRight: 16,
    borderWidth: 0.5,
    borderColor: "#EAE3D2",
  },
  headerTitle: {
    flex: 1,
  },
  titleReviews: {
    fontFamily: "Fraunces-Bold",
    fontSize: 18,
    color: "#000000",
  },
  titleDot: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 16,
    color: "#6B5E4C",
  },
  titleHouseName: {
    fontFamily: "Fraunces-Bold",
    fontSize: 18,
    color: "#000000",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  reviewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F0EBE1",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  reviewerName: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#1A150E",
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  subtext: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 12,
    color: "#8A7550",
    marginBottom: 12,
  },
  reviewBody: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 14,
    color: "#3A2E1A",
    lineHeight: 21,
  },
});

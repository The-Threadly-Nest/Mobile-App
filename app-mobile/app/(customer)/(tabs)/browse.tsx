import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  FlatList,
  Pressable,
  Image,
  ImageSourcePropType,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { MapPin, Search, Star } from "lucide-react-native";
import * as Location from "expo-location";
import { useAuthStore } from "@/stores/useAuthStore";
import { apiFetch } from "@/shared/utils/apiClient";

export interface TailorItem {
  id: string;
  name: string;
  location: string;
  price: string;
  rating: number;
  reviewsCount: string;
  badge: string;
  turnaround: string;
  categoryTag: string;
  image: ImageSourcePropType | { uri: string };
  category: string;
}

export const MOCK_TAILORS: TailorItem[] = [
  {
    id: "1",
    name: "Adaeze Couture",
    location: "Lagos",
    price: "₦ 1,200,000",
    rating: 4.9,
    reviewsCount: "2k+",
    badge: "BRIDAL · ASO-EBI",
    turnaround: "4-week turnaround",
    categoryTag: "Bridal",
    image: require("../../../assets/tailor-1.png"),
    category: "Aso-ebi",
  },
  {
    id: "2",
    name: "The Gele Room",
    location: "Akure",
    price: "₦ 10,000",
    rating: 4.6,
    reviewsCount: "324",
    badge: "GELE · ACCESSORIES",
    turnaround: "1-week turnaround",
    categoryTag: "Accessories",
    image: require("../../../assets/tailor-2.png"),
    category: "Gele & Accessories",
  },
  {
    id: "3",
    name: "Iyanuade Atelier",
    location: "Abuja",
    price: "₦ 500,000",
    rating: 4.8,
    reviewsCount: "1.6k+",
    badge: "AGBADA · SENATOR",
    turnaround: "4-week turnaround",
    categoryTag: "Agbada",
    image: require("../../../assets/tailor-3.png"),
    category: "Agbada",
  },
  {
    id: "4",
    name: "Kaftan & Co",
    location: "Abuja",
    price: "₦ 300,000",
    rating: 4.7,
    reviewsCount: "1k+",
    badge: "NATIVE WEAR",
    turnaround: "2-week turnaround",
    categoryTag: "Kaftans",
    image: require("../../../assets/tailor-4.png"),
    category: "Kaftan",
  },
];

const CATEGORIES = ["Aso-ebi", "Agbada", "Kaftan", "Gele & Accessories"];

export default function BrowseScreen() {
  const [selectedCategory, setSelectedCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [tailorsList, setTailorsList] = useState<TailorItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const savedLocation = useAuthStore((s) => s.location);
  const setStoreLocation = useAuthStore((s) => s.setLocation);

  const [currentLocation, setCurrentLocation] = useState<string>(savedLocation || "Lagos, Nigeria");
  const [isFetchingLocation, setIsFetchingLocation] = useState<boolean>(false);

  const fetchFashionHouses = async () => {
    try {
      const fetched = await apiFetch<TailorItem[]>("/api/fashion-houses", { silent: true }).catch(() => []);
      if (Array.isArray(fetched) && fetched.length > 0) {
        // Merge real database records with fallback mock tailors preventing duplicate IDs
        const map = new Map<string, TailorItem>();
        fetched.forEach((item) => map.set(item.id, item));
        MOCK_TAILORS.forEach((item) => {
          if (!map.has(item.id)) map.set(item.id, item);
        });
        setTailorsList(Array.from(map.values()));
      } else {
        setTailorsList(MOCK_TAILORS);
      }
    } catch (err) {
      console.log("Could not fetch real fashion houses:", err);
      setTailorsList(MOCK_TAILORS);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchFashionHouses(), fetchCurrentLocation()]);
    setRefreshing(false);
  };

  const fetchCurrentLocation = async () => {
    try {
      setIsFetchingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setIsFetchingLocation(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      const geocode = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      if (geocode && geocode.length > 0) {
        const place = geocode[0];
        const city = place.city || place.subregion || place.region || "Lagos";
        const country = place.country || "Nigeria";
        const formatted = `${city}, ${country}`;
        setCurrentLocation(formatted);
        setStoreLocation(formatted);
      }
    } catch (err) {
      console.log("Could not auto-fetch location:", err);
    } finally {
      setIsFetchingLocation(false);
    }
  };

  useEffect(() => {
    fetchCurrentLocation();
    fetchFashionHouses();
  }, []);

  const filteredTailors = tailorsList.filter((item) => {
    const matchesCategory =
      !selectedCategory ||
      (item.category && item.category.toLowerCase().includes(selectedCategory.toLowerCase())) ||
      (item.badge && item.badge.toLowerCase().includes(selectedCategory.toLowerCase())) ||
      (item.categoryTag && item.categoryTag.toLowerCase().includes(selectedCategory.toLowerCase()));

    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.location.toLowerCase().includes(q) ||
      (item.badge && item.badge.toLowerCase().includes(q)) ||
      (item.categoryTag && item.categoryTag.toLowerCase().includes(q));

    return matchesCategory && matchesSearch;
  });

  const displayTailors = filteredTailors.length > 0 ? filteredTailors : tailorsList;

  const renderStarRating = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    for (let i = 0; i < 5; i++) {
      const isFilled = i < fullStars;
      stars.push(
        <Star
          key={i}
          size={13}
          color="#E5A817"
          fill={isFilled ? "#E5A817" : "transparent"}
          style={{ marginRight: 2 }}
        />
      );
    }
    return stars;
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header Area */}
      <View style={styles.header}>
        {/* Location Row */}
        <Pressable style={styles.locationRow} onPress={fetchCurrentLocation}>
          <MapPin size={16} color="#000000" style={{ marginRight: 6 }} />
          <Text style={styles.locationText}>
            {isFetchingLocation ? "Detecting location..." : currentLocation}
          </Text>
          {isFetchingLocation && (
            <ActivityIndicator size="small" color="#4A080C" style={{ marginLeft: 6 }} />
          )}
        </Pressable>

        {/* Title */}
        <Text style={styles.title}>Find your Fashion House</Text>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Search size={18} color="#404040" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search fashion house by name or location..."
            placeholderTextColor="#404040"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Horizontal Category Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScroll}
        >
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <Pressable
                key={cat}
                onPress={() =>
                  setSelectedCategory(isSelected ? "" : cat)
                }
                style={[
                  styles.categoryPill,
                  isSelected
                    ? styles.categoryPillSelected
                    : styles.categoryPillUnselected,
                ]}
              >
                <Text
                  style={[
                    styles.categoryText,
                    isSelected
                      ? styles.categoryTextSelected
                      : styles.categoryTextUnselected,
                  ]}
                >
                  {cat}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Tailor Cards List */}
      <FlatList
        data={displayTailors}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#4A080C" />
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.card,
              { transform: [{ scale: pressed ? 0.985 : 1 }] },
            ]}
            onPress={() => router.push(`/(customer)/fashion-house/${item.id}`)}
          >
            {/* Image Container with Badge */}
            <View style={styles.imageContainer}>
              <Image
                source={
                  typeof item.image === "string"
                    ? { uri: item.image }
                    : item.image
                }
                style={styles.cardImage}
              />
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.badge}</Text>
              </View>
            </View>

            {/* Content Container */}
            <View style={styles.cardContent}>
              {/* Row 1: Name and Price */}
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardPrice}>{item.price}</Text>
              </View>

              {/* Row 2: Location and Rating */}
              <View style={styles.ratingRow}>
                <Text style={styles.locationSub}>{item.location} · </Text>
                <View style={styles.starsContainer}>
                  {renderStarRating(item.rating)}
                </View>
                <Text style={styles.ratingText}>
                  {item.rating} ({item.reviewsCount})
                </Text>
              </View>

              {/* Row 3: Tags */}
              <View style={styles.tagsRow}>
                <View style={styles.tagPill}>
                  <Text style={styles.tagText}>{item.turnaround}</Text>
                </View>
                <View style={styles.tagPill}>
                  <Text style={styles.tagText}>{item.categoryTag}</Text>
                </View>
              </View>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FBF7EF",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  locationText: {
    fontFamily: "WorkSans_500Medium",
    fontSize: 14,
    color: "#3A2E1A",
  },
  title: {
    fontFamily: "Fraunces-Bold",
    fontSize: 28,
    color: "#4A080C",
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 25,
    borderWidth: 0.5,
    borderColor: "#404040",
    paddingHorizontal: 16,
    height: 50,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontFamily: "WorkSans_400Regular",
    fontSize: 14,
    color: "#3A2E1A",
  },
  categoriesScroll: {
    paddingRight: 20,
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 9999,
    borderWidth: 1,
  },
  categoryPillSelected: {
    backgroundColor: "#4A080C",
    borderColor: "#4A080C",
  },
  categoryPillUnselected: {
    backgroundColor: "transparent",
    borderColor: "#4A080C",
  },
  categoryText: {
    fontFamily: "WorkSans_500Medium",
    fontSize: 14,
  },
  categoryTextSelected: {
    color: "#FFFFFF",
  },
  categoryTextUnselected: {
    color: "#4A080C",
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 20,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F0EBE1",
  },
  imageContainer: {
    position: "relative",
    width: "100%",
    height: 200,
  },
  cardImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  badge: {
    position: "absolute",
    bottom: 12,
    left: 12,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 11,
  },
  badgeText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 11,
    color: "#FFFFFF",
    letterSpacing: 0.8,
  },
  cardContent: {
    padding: 16,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  cardTitle: {
    fontFamily: "Fraunces-Bold",
    fontSize: 18,
    color: "#000000",
  },
  cardPrice: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 18,
    color: "#000000",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  locationSub: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 13,
    color: "#404040",
  },
  starsContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  ratingText: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 13,
    color: "#404040",
    marginLeft: 4,
  },
  tagsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tagPill: {
    backgroundColor: "#DFDFDF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 11,
  },
  tagText: {
    fontFamily: "WorkSans_500Medium",
    fontSize: 12,
    color: "#000000",
  },
});

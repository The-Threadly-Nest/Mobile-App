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
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { MapPin, Search, Star, ShoppingBag, Store } from "lucide-react-native";
import * as Location from "expo-location";
import { useAuthStore } from "@/stores/useAuthStore";
import { useAppDataStore } from "@/stores/useAppDataStore";
import { apiFetch } from "@/shared/utils/apiClient";
import CachedImage from "@/shared/components/CachedImage";

export interface TailorItem {
  id: string;
  name: string;
  location: string;
  price: string;
  rating: number;
  reviewsCount: string;
  badge: string;
  turnaround: string;
  categoryTag?: string;
  image: ImageSourcePropType | { uri: string };
  category: string;
  bio?: string;
  phone?: string;
}

export interface MarketplaceItem {
  id: string;
  name: string;
  priceFrom: string;
  imageUrl: string;
  vendorName: string;
  location: string;
  categoryTag?: string;
  badge?: string;
  fashionHouseId?: string;
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

export const MOCK_MARKETPLACE: MarketplaceItem[] = [
  {
    id: "m1",
    name: "Aso-Ebi Velvet Corset Gown",
    priceFrom: "₦ 1,200,000",
    imageUrl: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=500&q=80",
    vendorName: "Adaeze Couture",
    location: "Lagos",
    categoryTag: "Bridal",
    badge: "BRIDAL · ASO-EBI",
  },
  {
    id: "m2",
    name: "Autogele & Accessories Set",
    priceFrom: "₦ 10,000",
    imageUrl: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=500&q=80",
    vendorName: "The Gele Room",
    location: "Akure",
    categoryTag: "Accessories",
    badge: "GELE · ACCESSORIES",
  },
  {
    id: "m3",
    name: "Royal Ceremonial Agbada Set",
    priceFrom: "₦ 500,000",
    imageUrl: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=500&q=80",
    vendorName: "Iyanuade Atelier",
    location: "Abuja",
    categoryTag: "Agbada",
    badge: "LUXURY MENSWEAR",
  },
  {
    id: "m4",
    name: "Handwoven Silk Kaftan",
    priceFrom: "₦ 300,000",
    imageUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=500&q=80",
    vendorName: "Kaftan & Co",
    location: "Abuja",
    categoryTag: "Kaftan",
    badge: "NATIVE WEAR",
  },
];

const CATEGORIES = ["Aso-ebi", "Agbada", "Kaftan", "Gele & Accessories"];

export default function BrowseScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const cachedCatalog = useAppDataStore((s) => s.catalogItems);
  const setCachedCatalog = useAppDataStore((s) => s.setCatalogItems);

  const [mode, setMode] = useState<"vendors" | "marketplace">("vendors");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const initialTailors = Array.isArray(cachedCatalog) && cachedCatalog.length > 0
    ? cachedCatalog
    : MOCK_TAILORS;

  const [tailorsList, setTailorsList] = useState<TailorItem[]>(initialTailors);
  const [marketplaceList, setMarketplaceList] = useState<MarketplaceItem[]>(MOCK_MARKETPLACE);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const savedLocation = useAuthStore((s) => s.location);
  const setStoreLocation = useAuthStore((s) => s.setLocation);

  const [currentLocation, setCurrentLocation] = useState<string>(savedLocation || "Lagos, Nigeria");
  const [isFetchingLocation, setIsFetchingLocation] = useState<boolean>(false);

  const fetchFashionHouses = async () => {
    try {
      const fetched = await apiFetch<TailorItem[]>("/api/fashion-houses", { silent: true }).catch(() => []);
      if (Array.isArray(fetched) && fetched.length > 0) {
        setCachedCatalog(fetched);
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
    }
  };

  const fetchMarketplace = async () => {
    try {
      const fetched = await apiFetch<any[]>("/api/catalog/marketplace", { silent: true }).catch(() => []);
      if (Array.isArray(fetched) && fetched.length > 0) {
        const formatted: MarketplaceItem[] = fetched.map((c: any, idx: number) => ({
          id: c.id,
          name: c.name,
          priceFrom: typeof c.priceFrom === "number" ? `₦ ${(c.priceFrom / 100).toLocaleString()}` : c.priceFrom || "₦ 50,000",
          imageUrl: c.imageUrl || MOCK_MARKETPLACE[idx % MOCK_MARKETPLACE.length].imageUrl,
          fashionHouseId: c.fashionHouseId,
          vendorName: c.fashionHouse?.shopName || "Luxury Fashion House",
          location: c.fashionHouse?.city || "Lagos",
          categoryTag: "Catalog",
          badge: "CATALOG ITEM",
        }));
        setMarketplaceList(formatted);
      } else {
        setMarketplaceList(MOCK_MARKETPLACE);
      }
    } catch (err) {
      console.log("Could not fetch marketplace items:", err);
      setMarketplaceList(MOCK_MARKETPLACE);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchFashionHouses(), fetchMarketplace(), fetchCurrentLocation()]);
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
    fetchMarketplace();
  }, []);

  // Filtering for Vendors
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

  // Filtering for Marketplace
  const filteredMarketplace = marketplaceList.filter((item) => {
    const matchesCategory =
      !selectedCategory ||
      (item.categoryTag && item.categoryTag.toLowerCase().includes(selectedCategory.toLowerCase())) ||
      (item.name && item.name.toLowerCase().includes(selectedCategory.toLowerCase()));

    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.vendorName.toLowerCase().includes(q) ||
      item.location.toLowerCase().includes(q);

    return matchesCategory && matchesSearch;
  });

  const displayTailors = filteredTailors.length > 0 ? filteredTailors : tailorsList;
  const displayMarketplace = filteredMarketplace.length > 0 ? filteredMarketplace : marketplaceList;

  const renderStarRating = (rating: number, starSize = 13) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    for (let i = 0; i < 5; i++) {
      const isFilled = i < fullStars;
      stars.push(
        <Star
          key={i}
          size={starSize}
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
      <View style={[styles.header, isLandscape && { paddingHorizontal: 16, paddingTop: 2, paddingBottom: 4, marginBottom: 4 }]}>
        {/* Location Row */}
        <Pressable style={[styles.locationRow, isLandscape && { marginBottom: 4 }]} onPress={fetchCurrentLocation}>
          <MapPin size={14} color="#000000" style={{ marginRight: 4 }} />
          <Text style={[styles.locationText, isLandscape && { fontSize: 12 }]}>
            {isFetchingLocation ? "Detecting location..." : currentLocation}
          </Text>
          {isFetchingLocation && (
            <ActivityIndicator size="small" color="#4A080C" style={{ marginLeft: 4 }} />
          )}
        </Pressable>

        {/* Vendors vs Marketplace Segmented Control Switch */}
        <View style={styles.segmentedContainer}>
          <Pressable
            onPress={() => setMode("vendors")}
            style={[styles.segmentedPill, mode === "vendors" && styles.segmentedPillActive]}
          >
            <Store size={15} color={mode === "vendors" ? "#FFFFFF" : "#3A2E1A"} style={{ marginRight: 6 }} />
            <Text style={[styles.segmentedText, mode === "vendors" && styles.segmentedTextActive]}>
              Vendors
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setMode("marketplace")}
            style={[styles.segmentedPill, mode === "marketplace" && styles.segmentedPillActive]}
          >
            <ShoppingBag size={15} color={mode === "marketplace" ? "#FFFFFF" : "#3A2E1A"} style={{ marginRight: 6 }} />
            <Text style={[styles.segmentedText, mode === "marketplace" && styles.segmentedTextActive]}>
              Marketplace
            </Text>
          </Pressable>
        </View>

        {/* Search Bar */}
        <View style={[styles.searchContainer, isLandscape && { height: 38, marginBottom: 6, paddingHorizontal: 12, borderRadius: 19 }]}>
          <Search size={16} color="#404040" style={{ marginRight: 6 }} />
          <TextInput
            disableFullscreenUI={true}
            style={[styles.searchInput, isLandscape && { fontSize: 13 }]}
            placeholder={mode === "vendors" ? "Search vendors by name or location..." : "Search marketplace garments..."}
            placeholderTextColor="#404040"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Main List Body */}
      {mode === "vendors" ? (
        /* Vendors / Fashion Houses View */
        <FlatList
          key={`vendors-${isLandscape ? "landscape" : "portrait"}`}
          data={displayTailors}
          keyExtractor={(item) => item.id}
          numColumns={isLandscape ? 2 : 1}
          columnWrapperStyle={isLandscape ? { gap: 12, marginBottom: 12 } : undefined}
          contentContainerStyle={[
            styles.listContainer,
            isLandscape && { maxWidth: 900, alignSelf: "center", width: "100%", paddingHorizontal: 16, paddingTop: 2, paddingBottom: 64 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#4A080C" />}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.card,
                isLandscape && { flex: 1, marginBottom: 0, borderRadius: 16 },
                { transform: [{ scale: pressed ? 0.985 : 1 }] },
              ]}
              onPress={() =>
                router.push({
                  pathname: `/(customer)/fashion-house/${item.id}`,
                  params: {
                    initialName: item.name,
                    initialLocation: item.location,
                    initialImage: typeof item.image === "string" ? item.image : undefined,
                    initialBio: item.bio || "",
                  },
                })
              }
            >
              {/* Image Container with Badge */}
              <View style={[styles.imageContainer, isLandscape && { height: 125 }]}>
                <CachedImage
                  source={typeof item.image === "string" ? { uri: item.image } : item.image}
                  style={styles.cardImage}
                />
                <View style={[styles.badge, isLandscape && { bottom: 8, left: 8, paddingHorizontal: 10, paddingVertical: 3 }]}>
                  <Text style={[styles.badgeText, isLandscape && { fontSize: 10 }]}>{item.badge}</Text>
                </View>
              </View>

              {/* Content Container */}
              <View style={[styles.cardContent, isLandscape && { padding: 8 }]}>
                <View style={[styles.rowBetween, isLandscape && { marginBottom: 2 }]}>
                  <Text style={[styles.cardTitle, isLandscape && { fontSize: 14 }]}>{item.name}</Text>
                  <Text style={[styles.cardPrice, isLandscape && { fontSize: 14 }]}>{item.price}</Text>
                </View>

                <View style={[styles.ratingRow, isLandscape && { marginBottom: 6 }]}>
                  <Text style={[styles.locationSub, isLandscape && { fontSize: 11 }]}>{item.location} · </Text>
                  <View style={styles.starsContainer}>{renderStarRating(item.rating, isLandscape ? 11 : 13)}</View>
                  <Text style={[styles.ratingText, isLandscape && { fontSize: 11 }]}>
                    {item.rating} ({item.reviewsCount})
                  </Text>
                </View>

                <View style={[styles.tagsRow, isLandscape && { gap: 6 }]}>
                  <View style={[styles.tagPill, isLandscape && { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }]}>
                    <Text style={[styles.tagText, isLandscape && { fontSize: 10 }]}>{item.turnaround}</Text>
                  </View>
                  <View style={[styles.tagPill, isLandscape && { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }]}>
                    <Text style={[styles.tagText, isLandscape && { fontSize: 10 }]}>{item.categoryTag}</Text>
                  </View>
                </View>
              </View>
            </Pressable>
          )}
        />
      ) : (
        /* Marketplace Garments View */
        <FlatList
          key={`marketplace-${isLandscape ? "landscape" : "portrait"}`}
          data={displayMarketplace}
          keyExtractor={(item) => item.id}
          numColumns={isLandscape ? 2 : 1}
          columnWrapperStyle={isLandscape ? { gap: 12, marginBottom: 12 } : undefined}
          contentContainerStyle={[
            styles.listContainer,
            isLandscape && { maxWidth: 900, alignSelf: "center", width: "100%", paddingHorizontal: 16, paddingTop: 2, paddingBottom: 64 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#4A080C" />}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.card,
                isLandscape && { flex: 1, marginBottom: 0, borderRadius: 16 },
                { transform: [{ scale: pressed ? 0.985 : 1 }] },
              ]}
              onPress={() => {
                if (item.fashionHouseId) {
                  router.push({
                    pathname: `/(customer)/fashion-house/${item.fashionHouseId}`,
                    params: {
                      initialName: item.vendorName,
                      initialLocation: item.location,
                      initialImage: item.imageUrl,
                    },
                  });
                } else {
                  router.push(`/(customer)/fashion-house/1`);
                }
              }}
            >
              {/* Image Container */}
              <View style={[styles.imageContainer, isLandscape && { height: 140 }]}>
                <CachedImage source={{ uri: item.imageUrl }} style={styles.cardImage} />
                <View style={[styles.badge, { backgroundColor: "#4A080C" }]}>
                  <Text style={styles.badgeText}>{item.badge}</Text>
                </View>
              </View>

              {/* Content Container */}
              <View style={[styles.cardContent, isLandscape && { padding: 8 }]}>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.cardPrice}>{item.priceFrom}</Text>
                </View>

                <Text style={styles.vendorSubtext}>
                  By {item.vendorName} · {item.location}
                </Text>

                <View style={styles.actionRow}>
                  <View style={styles.tagPill}>
                    <Text style={styles.tagText}>{item.categoryTag}</Text>
                  </View>

                  <Pressable
                    style={styles.orderBtn}
                    onPress={() => {
                      const targetFhId = item.fashionHouseId || "1";
                      router.push({
                        pathname: `/(customer)/chat/${targetFhId}`,
                        params: { garmentName: item.name, garmentPrice: item.priceFrom },
                      });
                    }}
                  >
                    <Text style={styles.orderBtnText}>Book Fitting</Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
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
    marginBottom: 10,
  },
  locationText: {
    fontFamily: "WorkSans_500Medium",
    fontSize: 14,
    color: "#3A2E1A",
  },
  segmentedContainer: {
    flexDirection: "row",
    backgroundColor: "#EBE0D3",
    borderRadius: 24,
    padding: 4,
    marginBottom: 14,
  },
  segmentedPill: {
    flex: 1,
    height: 42,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  segmentedPillActive: {
    backgroundColor: "#4A080C",
  },
  segmentedText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 14,
    color: "#3A2E1A",
  },
  segmentedTextActive: {
    color: "#FFFFFF",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 25,
    borderWidth: 0.5,
    borderColor: "#404040",
    paddingHorizontal: 16,
    height: 48,
    marginBottom: 12,
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
    paddingVertical: 8,
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
    fontSize: 13,
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
    gap: 18,
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
    height: 190,
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
    fontSize: 17,
    color: "#000000",
    flex: 1,
    marginRight: 8,
  },
  cardPrice: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 17,
    color: "#4A080C",
  },
  vendorSubtext: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 13,
    color: "#8A7550",
    marginBottom: 12,
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
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  orderBtn: {
    backgroundColor: "#4A080C",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  orderBtnText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 13,
    color: "#FFFFFF",
  },
});

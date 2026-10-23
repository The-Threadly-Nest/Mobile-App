import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { MapPin, Search, Star, ShoppingBag, Store } from "lucide-react-native";
import * as Location from "expo-location";
import { useAuthStore } from "@/stores/useAuthStore";
import { useAppDataStore } from "@/stores/useAppDataStore";
import { apiFetchCollectionPage } from "@/shared/utils/apiClient";
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
  image?: string | null;
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

const CATEGORIES = ["Aso-ebi", "Agbada", "Kaftan", "Gele & Accessories"];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hasRealId = (item: { id?: string }) => Boolean(item.id && UUID_PATTERN.test(item.id));

export default function BrowseScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const cachedCatalog = useAppDataStore((s) => s.catalogItems);
  const setCachedCatalog = useAppDataStore((s) => s.setCatalogItems);

  const [mode, setMode] = useState<"vendors" | "marketplace">("vendors");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const initialTailors = Array.isArray(cachedCatalog) ? cachedCatalog.filter(hasRealId) : [];

  const [tailorsList, setTailorsList] = useState<TailorItem[]>(initialTailors);
  const [marketplaceList, setMarketplaceList] = useState<MarketplaceItem[]>([]);
  const [loadingMarketplace, setLoadingMarketplace] = useState<boolean>(true);
  const [nextVendorsPage, setNextVendorsPage] = useState<number | null>(null);
  const [nextMarketplacePage, setNextMarketplacePage] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [vendorsError, setVendorsError] = useState<string | null>(null);
  const [marketplaceError, setMarketplaceError] = useState<string | null>(null);

  const savedLocation = useAuthStore((s) => s.location);
  const setStoreLocation = useAuthStore((s) => s.setLocation);

  const [currentLocation, setCurrentLocation] = useState<string>(savedLocation || "Lagos, Nigeria");
  const [isFetchingLocation, setIsFetchingLocation] = useState<boolean>(false);

  useEffect(() => {
    if (Array.isArray(cachedCatalog)) {
      setTailorsList(cachedCatalog.filter(hasRealId));
    }
  }, [cachedCatalog]);

  const fetchFashionHouses = useCallback(async (page = 1) => {
    try {
      if (page === 1) setVendorsError(null);
      const result = await apiFetchCollectionPage<TailorItem>(
        `/api/fashion-houses?page=${page}&limit=50`,
        { silent: true }
      );
      const fetched = result.items.filter(hasRealId);
      if (Array.isArray(fetched) && fetched.length > 0) {
        setTailorsList((current) => {
          const map = new Map<string, TailorItem>();
          (page === 1 ? [] : current).forEach((item) => map.set(item.id, item));
          fetched.forEach((item) => map.set(item.id, item));
          const merged = Array.from(map.values());
          setCachedCatalog(merged);
          return merged;
        });
        setNextVendorsPage(result.nextPage);
      } else if (page === 1) {
        setTailorsList([]);
        setCachedCatalog([]);
        setNextVendorsPage(null);
      }
    } catch (err) {
      console.log("Could not fetch real fashion houses:", err);
      if (page === 1) setVendorsError("Could not load fashion houses. Check your connection and try again.");
    }
  }, [setCachedCatalog]);

  const fetchMarketplace = useCallback(async (page = 1) => {
    try {
      if (page === 1) setLoadingMarketplace(true);
      if (page === 1) setMarketplaceError(null);
      const result = await apiFetchCollectionPage<any>(
        `/api/catalog/marketplace?page=${page}&limit=50`,
        { silent: true }
      );
      const fetched = result.items.filter(hasRealId);
      if (Array.isArray(fetched) && fetched.length > 0) {
        const formatted: MarketplaceItem[] = fetched.map((c: any) => ({
          id: c.id,
          name: c.name,
          priceFrom: typeof c.priceFrom === "number" ? `₦ ${c.priceFrom.toLocaleString()}` : (c.priceFrom ? String(c.priceFrom) : "Price on request"),
          imageUrl: c.imageUrl || "",
          fashionHouseId: c.fashionHouseId,
          vendorName: c.fashionHouse?.shopName || "Luxury Fashion House",
          location: c.fashionHouse?.city || "Lagos",
          categoryTag: "Catalog",
          badge: "CATALOG ITEM",
        }));
        setMarketplaceList((current) => {
          const byId = new Map((page === 1 ? [] : current).map((item) => [item.id, item]));
          formatted.forEach((item) => byId.set(item.id, item));
          return Array.from(byId.values());
        });
        setNextMarketplacePage(result.nextPage);
      } else if (page === 1) {
        setMarketplaceList([]);
        setNextMarketplacePage(null);
      }
    } catch (err) {
      console.log("Could not fetch marketplace items:", err);
      if (page === 1) setMarketplaceError("Could not load the marketplace. Check your connection and try again.");
    } finally {
      setLoading(false);
      setLoadingMarketplace(false);
    }
  }, []);

  const loadMore = async () => {
    const nextPage = mode === "vendors" ? nextVendorsPage : nextMarketplacePage;
    if (!nextPage || loadingMore) return;
    setLoadingMore(true);
    try {
      if (mode === "vendors") await fetchFashionHouses(nextPage);
      else await fetchMarketplace(nextPage);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchFashionHouses(), fetchMarketplace(), fetchCurrentLocation()]);
    setRefreshing(false);
  };

  const fetchCurrentLocation = useCallback(async () => {
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
  }, [setStoreLocation]);

  useFocusEffect(
    useCallback(() => {
      if (!savedLocation) {
        fetchCurrentLocation();
      }
      fetchFashionHouses();
      fetchMarketplace();
    }, [savedLocation, fetchCurrentLocation, fetchFashionHouses, fetchMarketplace])
  );

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

  const displayTailors = (searchQuery || selectedCategory) ? filteredTailors : tailorsList;
  const displayMarketplace = (searchQuery || selectedCategory) ? filteredMarketplace : marketplaceList;

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

        {/* Brand Title */}
        <Text style={styles.brandTitle}>Òwújà</Text>

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
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>{vendorsError ? "Unable to load vendors" : "No fashion houses found"}</Text>
              <Text style={styles.emptyBody}>{vendorsError || "Registered fashion houses will appear here."}</Text>
            </View>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator color="#4A080C" style={{ margin: 16 }} /> : null}
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
      ) : loadingMarketplace && marketplaceList.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 60 }}>
          <ActivityIndicator size="large" color="#4A080C" />
        </View>
      ) : (
        /* Marketplace Garments View — Strict 2-Column Grid (Fits 4 items above the fold) */
        <FlatList
          key={`marketplace-grid-${isLandscape ? "4col" : "2col"}`}
          data={displayMarketplace}
          keyExtractor={(item) => item.id}
          numColumns={isLandscape ? 4 : 2}
          columnWrapperStyle={{ gap: 10, marginBottom: 12 }}
          contentContainerStyle={[
            styles.listContainer,
            { paddingHorizontal: 12, paddingTop: 2, paddingBottom: 64, gap: 0 },
          ]}
          showsVerticalScrollIndicator={false}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>{marketplaceError ? "Unable to load marketplace" : "No styles available"}</Text>
              <Text style={styles.emptyBody}>{marketplaceError || "Uploaded catalog styles will appear here."}</Text>
            </View>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator color="#4A080C" style={{ margin: 16 }} /> : null}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#4A080C" />}
          renderItem={({ item }) => {
            const cardHeight = isLandscape ? 220 : 255;
            const cardWidth = isLandscape
              ? (width - 24 - 30) / 4
              : (width - 34) / 2;

            return (
              <Pressable
                style={({ pressed }) => [
                  styles.card,
                  {
                    width: cardWidth,
                    maxWidth: cardWidth,
                    height: cardHeight,
                    marginBottom: 0,
                    borderRadius: 14,
                  },
                  { transform: [{ scale: pressed ? 0.985 : 1 }] },
                ]}
                onPress={() => {
                  router.push({
                    pathname: `/(customer)/catalog/${item.id}`,
                    params: {
                      initialName: item.name,
                      initialPrice: item.priceFrom || "Price upon request",
                      initialImage: item.imageUrl,
                      initialVendorName: item.vendorName,
                      initialLocation: item.location,
                      initialFashionHouseId: item.fashionHouseId,
                      badge: item.badge,
                      categoryTag: item.categoryTag,
                    },
                  });
                }}
              >
                {/* Image Container */}
                <View style={[styles.imageContainer, { height: isLandscape ? 115 : 145, backgroundColor: "#EBE6DC" }]}>
                  <CachedImage
                    source={{ uri: item.imageUrl }}
                    style={styles.cardImage}
                    contentFit="cover"
                    contentPosition="top center"
                  />
                  {item.badge ? (
                    <View
                      style={[
                        styles.badge,
                        {
                          top: 12,
                          left: 12,
                          bottom: undefined,
                          backgroundColor: "rgba(74, 8, 12, 0.88)",
                          paddingHorizontal: 7,
                          paddingVertical: 2,
                          borderRadius: 12,
                        },
                      ]}
                    >
                      <Text style={[styles.badgeText, { fontSize: 8, letterSpacing: 0.4 }]}>{item.badge}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Content Container */}
                <View style={[styles.cardContent, { padding: 8, flex: 1, justifyContent: "space-between" }]}>
                  <View>
                    <Text style={[styles.cardTitle, { flex: 0, fontSize: 13.5, lineHeight: 17, color: "#000000", marginRight: 0, marginBottom: 2 }]} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={[styles.cardPrice, { fontSize: 12, marginBottom: 2 }]} numberOfLines={1}>
                      {item.priceFrom ? item.priceFrom : "Price on request"}
                    </Text>

                    <Text style={[styles.vendorSubtext, { fontSize: 10, marginBottom: 0, textTransform: "uppercase" }]} numberOfLines={1}>
                      {item.vendorName}
                    </Text>
                  </View>

                  <Pressable
                    style={[styles.orderBtn, { paddingVertical: 6, borderRadius: 16, alignItems: "center", justifyContent: "center" }]}
                    onPress={() => {
                      if (!item.fashionHouseId || !UUID_PATTERN.test(item.fashionHouseId)) return;
                      const targetFhId = item.fashionHouseId;
                      const numericPrice = item.priceFrom ? parseFloat(item.priceFrom.replace(/[^0-9.]/g, '')) || 0 : 0;
                      router.push({
                        pathname: `/(customer)/catalog/details`,
                        params: {
                          id: item.id,
                          initialName: item.name,
                          initialPrice: String(numericPrice),
                          initialImage: item.imageUrl,
                          initialVendorName: item.vendorName,
                          initialFashionHouseId: targetFhId,
                          badge: item.badge,
                          categoryTag: item.categoryTag,
                        },
                      });
                    }}
                  >
                    <Text style={[styles.orderBtnText, { fontSize: 11, textAlign: "center" }]}>Order Style</Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          }}
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
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 56,
  },
  emptyTitle: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#3A2E1A",
    marginBottom: 6,
  },
  emptyBody: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 13,
    color: "#646464",
    textAlign: "center",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 36,
    paddingBottom: 6,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  brandTitle: {
    fontFamily: "Fraunces-Bold",
    fontSize: 26,
    color: "#4A080C",
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  locationText: {
    fontFamily: "WorkSans_500Medium",
    fontSize: 13,
    color: "#3A2E1A",
  },
  segmentedContainer: {
    flexDirection: "row",
    backgroundColor: "#EBE0D3",
    borderRadius: 32,
    padding: 3,
    marginBottom: 16,
  },
  segmentedPill: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  segmentedPillActive: {
    backgroundColor: "#4A080C",
  },
  segmentedText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 13,
    color: "#3A2E1A",
  },
  segmentedTextActive: {
    color: "#FFFFFF",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    borderWidth: 0.5,
    borderColor: "#404040",
    paddingHorizontal: 14,
    height: 48,
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
    gap: 24,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
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

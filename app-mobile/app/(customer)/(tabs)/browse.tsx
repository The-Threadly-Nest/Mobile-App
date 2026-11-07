import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Image,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  AppState,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import {
  Search,
  SlidersHorizontal,
  Bell,
  Heart,
  Star,
  Zap,
} from "lucide-react-native";
import Svg, { Path } from "react-native-svg";
import { useAuthStore } from "@/stores/useAuthStore";
import { useAppDataStore } from "@/stores/useAppDataStore";
import { apiFetch, apiFetchCollectionPage, ApiError } from "@/shared/utils/apiClient";
import { useAppAlert } from "@/shared/hooks/useAppAlert";
import { loadCatalogFavorites, saveCatalogFavorite } from "@/shared/utils/catalogFavorites";
import { formatCurrency } from "@/shared/utils/formatters";
import { SCREEN_TOP_SPACING } from "@/shared/utils/screenSpacing";
import CachedImage from "@/shared/components/CachedImage";

interface ProductCardItem {
  id: string;
  name: string;
  category: string;
  price: number | null;

  imageUrl: any;
  isFavorite?: boolean;
  discountBadge?: string;
  featured?: boolean;
}

interface FashionHouseSummary {
  id: string;
  name: string;
  brandLogoUrl?: string | null;
  image?: string | null;
  location?: string;
}




export default function BrowseScreen() {
  const { width } = useWindowDimensions();
  const userName = useAuthStore((s) => s.name);
  const token = useAuthStore(s => s.token);
  const unreadCount = useAppDataStore(s => s.unreadMessageCount);
  const setUnreadCount = useAppDataStore(s => s.setUnreadMessageCount);
  const [notificationsError, setNotificationsError] = useState("");
  const unreadLock = React.useRef(false);
  const loadUnread = useCallback(async (active: () => boolean = () => true) => {
    if (!token || unreadLock.current || AppState.currentState !== "active") return;
    unreadLock.current = true;
    try {
      const threads = await apiFetch<{ unreadCount: number }[]>("/api/direct-messages/my-threads", { silent: true });
      if (active()) {
        setUnreadCount(threads.reduce((total, thread) => total + Math.max(0, thread.unreadCount || 0), 0));
        setNotificationsError("");
      }
    } catch {
      if (active()) setNotificationsError("Couldn't refresh notifications. Tap the bell to open your messages.");
    } finally { unreadLock.current = false; }
  }, [token, setUnreadCount]);
  useFocusEffect(useCallback(() => {
    let active = true;
    void loadUnread(() => active);
    const timer = setInterval(() => { void loadUnread(() => active); }, 30_000);
    const subscription = AppState.addEventListener("change", state => {
      if (state === "active") void loadUnread(() => active);
    });
    return () => { active = false; clearInterval(timer); subscription.remove(); };
  }, [loadUnread]));

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [fashionHouses, setFashionHouses] = useState<FashionHouseSummary[]>([]);
  const [housesError, setHousesError] = useState("");
  const [products, setProducts] = useState<ProductCardItem[]>([]);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [error, setError] = useState("");
  const { showAlert } = useAppAlert();
  const favoriteLock = React.useRef(false);
  const scrollRef = React.useRef<ScrollView>(null);
  const catalogOffset = React.useRef(0);
  const fashionHouseScrollRef = React.useRef<ScrollView>(null);
  const houseMotion = React.useRef({ offset: 0, viewport: 0, content: 0, direction: 1, resumeAt: 0 });
  // Animate the real row back and forth; never clone records to fill the strip.
  useFocusEffect(useCallback(() => {
    const timer = setInterval(() => {
      const motion = houseMotion.current;
      const maxOffset = Math.max(0, motion.content - motion.viewport);
      if (!maxOffset || Date.now() < motion.resumeAt || AppState.currentState !== "active") return;
      const next = Math.max(0, Math.min(maxOffset, motion.offset + 0.8 * motion.direction));
      if (next === maxOffset) motion.direction = -1;
      else if (next === 0) motion.direction = 1;
      motion.offset = next;
      fashionHouseScrollRef.current?.scrollTo({ x: next, animated: false });
    }, 25);
    return () => clearInterval(timer);
  }, []));
  const normalizeCategory = (value: string) => {
    const category = value.toLowerCase().replace(/[ _-]/g, "");
    return ({ tshirt: "T-Shirt", tshirts: "T-Shirt", pant: "Pant", pants: "Pant", dress: "Dress", dresses: "Dress", jacket: "Jacket", jackets: "Jacket" } as Record<string, string>)[category] || value;
  };

  const loadFashionHouses = useCallback(async () => {
    try {
      const res = await apiFetchCollectionPage<FashionHouseSummary>(
        "/api/fashion-houses?limit=20",
        { silent: true }
      );
      setFashionHouses([...new Map(res.items.map(house => [house.id, house])).values()]); setHousesError("");
    } catch {
      setHousesError("We couldn't load fashion houses. Pull down to retry.");
    }
  }, []);

  const loadCatalog = useCallback(async (page = 1) => {
    setError("");
    setRefreshing(true);
    try {
      const response = await apiFetchCollectionPage<{ id: string; name: string; category: string | null; priceFrom: number | null; imageUrl: string }>(
        `/api/catalog/marketplace?page=${page}&limit=50`, { silent: true });
      const items = response.items.map(item => ({ id: item.id, name: item.name, category: item.category || "", price: item.priceFrom, imageUrl: item.imageUrl }));
      setProducts(previous => page === 1 ? items : [...new Map([...previous, ...items].map(item => [item.id, item])).values()]);
      setNextPage(response.nextPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't load the catalog. Please try again.");
    } finally { setRefreshing(false); setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => {
    void loadCatalog();
    void loadFashionHouses();
    let active = true;
    loadCatalogFavorites()
      .then(profile => { if (active) setFavorites(Object.fromEntries(profile.savedCatalogIds.map(id => [id, true]))); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : "We couldn't load your saved items."); });
    return () => { active = false; };
  }, [loadCatalog, loadFashionHouses]));
  async function toggleFavorite(id: string) {
    if (favoriteLock.current) return;
    favoriteLock.current = true;
    setSavingFavorite(true);
    try {
      const saved = await saveCatalogFavorite(id, !favorites[id]);
      setFavorites(Object.fromEntries(saved.savedCatalogIds.map(key => [key, true])));
    } catch (err) { showAlert("Couldn't save item", err instanceof Error ? err.message : "Please try again."); }
    finally { favoriteLock.current = false; setSavingFavorite(false); }
  }
  const filteredRecommend = products.filter(item =>
    (!searchQuery.trim() || item.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    && (!selectedCategory || normalizeCategory(item.category) === selectedCategory));
  const onRefresh = useCallback(async () => { await Promise.all([loadCatalog(1), loadUnread(), loadFashionHouses()]); }, [loadCatalog, loadUnread, loadFashionHouses]);

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#453332" />}
      >
        {/* Header Greeting & Profile Bar */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greetingSub}>Hello, Welcome 👋</Text>
            <Text style={styles.greetingName}>{userName ? userName.split(" ")[0] : "there"}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Notifications, ${unreadCount} unread messages`}
            onPress={() => router.push("/(customer)/messages")}
            style={({ pressed }) => [
              styles.bellButton,
              { opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <Bell size={20} color="#1E1E1E" />
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        {notificationsError ? <Text style={{ color: "#646464", fontSize: 12, marginBottom: 12 }}>{notificationsError}</Text> : null}
        {/* Search & Filter Bar */}
        <View style={styles.searchBarRow}>
          <View style={styles.searchInputWrapper}>
            <Search size={18} color="#6C7278" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search clothes... "
              placeholderTextColor="#6C7278"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <Pressable accessibilityLabel="Show all categories" onPress={() => { setSelectedCategory(""); setSearchQuery(""); scrollRef.current?.scrollTo({ y: catalogOffset.current, animated: true }); }} style={styles.filterBtn}>
            <SlidersHorizontal size={18} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Hero Promo Banner (New Collection) */}
        <View style={styles.bannerContainer}>
          <View style={styles.bannerTextCol}>
            <Text style={styles.bannerTitle}>New Collection</Text>
            <Text style={styles.bannerSubtitle}>Discover clothing from{"\n"}independent fashion houses</Text>
            <Pressable onPress={() => scrollRef.current?.scrollTo({ y: catalogOffset.current, animated: true })} style={styles.shopNowBtn}>
              <Text style={styles.shopNowText}>Shop Now</Text>
            </Pressable>
          </View>
          <View style={styles.bannerImageWrapper}>
            <Image
              source={require("../../../assets/banner-model.png")}
              style={styles.bannerImage}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* ─── Fashion Houses Carousel ─── */}
        <View style={styles.fashionHousesSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Fashion Houses</Text>
          </View>
          {housesError ? <Text style={{ color: "#9F1239", marginBottom: 12 }}>{housesError}</Text> : !fashionHouses.length && !loading ? <Text style={{ color: "#746765", marginBottom: 12 }}>No fashion houses are available yet.</Text> : null}
          <ScrollView
            ref={fashionHouseScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.fashionHousesCarousel}
            onLayout={event => { houseMotion.current.viewport = event.nativeEvent.layout.width; }}
            onContentSizeChange={width => {
              const motion = houseMotion.current;
              motion.content = width;
              motion.offset = Math.min(motion.offset, Math.max(0, width - motion.viewport));
            }}
            onTouchStart={() => { houseMotion.current.resumeAt = Number.POSITIVE_INFINITY; }}
            onTouchEnd={() => { houseMotion.current.resumeAt = Date.now() + 3000; }}
            onTouchCancel={() => { houseMotion.current.resumeAt = Date.now() + 3000; }}
            onScrollBeginDrag={() => { houseMotion.current.resumeAt = Number.POSITIVE_INFINITY; }}
            onScrollEndDrag={() => { houseMotion.current.resumeAt = Date.now() + 3000; }}
            onMomentumScrollEnd={() => { houseMotion.current.resumeAt = Date.now() + 3000; }}
            onScroll={event => { houseMotion.current.offset = Math.max(0, event.nativeEvent.contentOffset.x); }}
            scrollEventThrottle={16}
          >
            {fashionHouses.map((house) => (
              <Pressable
                key={house.id}
                onPress={() => {
                  router.push({
                    pathname: "/(customer)/fashion-house/[fashionHouseId]",
                    params: {
                      fashionHouseId: house.id,
                      initialName: house.name,
                      initialImage: house.image || house.brandLogoUrl || "",
                      initialLocation: house.location || "",
                    },
                  });
                }}
                style={styles.fashionHouseItem}
              >
                <View style={styles.fashionHouseLogoWrap}>
                  {house.image || house.brandLogoUrl ? (
                    <CachedImage
                      source={{ uri: (house.image || house.brandLogoUrl) as string }}
                      style={styles.fashionHouseLogo}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={styles.fallbackLogo}>
                      <Text style={styles.fallbackInitial}>
                        {house.name ? house.name.charAt(0).toUpperCase() : "A"}
                      </Text>
                    </View>
                  )}
                </View>
                <Text numberOfLines={1} style={styles.fashionHouseName}>
                  {house.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Recommend For You Section */}
        <View onLayout={event => { catalogOffset.current = event.nativeEvent.layout.y; }} style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>For You</Text>
          <Pressable onPress={() => { setSelectedCategory(""); setSearchQuery(""); }}>
            <Text style={styles.viewAllText}>View All</Text>
          </Pressable>
        </View>
        {loading && <ActivityIndicator color="#453332" />}
        {error ? <Pressable onPress={() => void loadCatalog()}><Text style={{ color: "#9F1239", paddingVertical: 12 }}>{error} Tap to retry.</Text></Pressable> : null}
        {!loading && !error && filteredRecommend.length === 0 && <Text style={{ color: "#646464", paddingVertical: 20 }}>No catalog items match yet. Try another category or check back soon.</Text>}
        <View style={styles.gridContainer}>
          {filteredRecommend.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: "/(customer)/catalog/[id]", params: { id: item.id } })}
              style={styles.productCard}
            >
              <View style={styles.productImageContainer}>
                <CachedImage
                  source={typeof item.imageUrl === "string" ? { uri: item.imageUrl } : item.imageUrl}
                  style={styles.productImage}
                  contentFit="cover"
                />
                {/* Top-Right Heart Button */}
                <Pressable
                  disabled={savingFavorite}
                  accessibilityLabel={favorites[item.id] ? "Unsave item" : "Save item"}
                  onPress={(event) => {
                    event.stopPropagation();
                    void toggleFavorite(item.id);
                  }}
                  style={styles.heartBtn}
                >
                  <Heart
                    size={14}
                    color="#FFFFFF"
                    fill={favorites[item.id] ? "#FFFFFF" : "none"}
                  />
                </Pressable>
                {item.discountBadge && (
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountText}>{item.discountBadge}</Text>
                  </View>
                )}
                {item.featured && (
                  <View style={[styles.featuredBadge, !item.discountBadge && { bottom: 8 }]}>
                    <Text style={styles.featuredText}>FEATURED</Text>
                  </View>
                )}
              </View>
              <View style={styles.productInfo}>
                <Text numberOfLines={1} style={styles.productName}>{item.name}</Text>
                <Text style={styles.productPrice}>
                  {item.price !== null && item.price > 0 ? formatCurrency(item.price) : "Price on request"}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        {nextPage && <Pressable disabled={refreshing} onPress={() => void loadCatalog(nextPage)} style={{ padding: 16, alignItems: "center" }}><Text style={{ color: "#453332" }}>{refreshing ? "Loading..." : "Load more items"}</Text></Pressable>}
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: SCREEN_TOP_SPACING,
    paddingBottom: 110, // Generous clearance for the 3-tab floating navigation bar
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  greetingSub: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 12,
    color: "#787676",
    marginBottom: 2,
  },
  greetingName: {
    fontFamily: "HedvigLettersSerif-Regular",
    fontSize: 26,
    color: "#3B0508",
  },
  bellButton: {
    position: "relative",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  unreadBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#F96951",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  unreadBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontFamily: "InstrumentSans-Bold",
  },
  bellBadgeDot: {
    position: "absolute",
    top: 3,
    right: 3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F96951",
  },
  avatarButton: {
    padding: 2,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#453332",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "#FFFFFF",
    fontFamily: "InstrumentSans-Bold",
    fontSize: 14,
  },
  searchBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DFDEDE",
    borderRadius: 24,
    paddingHorizontal: 16,
    height: 48,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: "InstrumentSans-Regular",
    fontSize: 13,
    color: "#1E1E1E",
    height: "100%",
  },
  filterBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#453332",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerContainer: {
    backgroundColor: "#F96951",
    borderRadius: 14,
    height: 146,
    flexDirection: "row",
    overflow: "hidden",
    marginBottom: 24,
    paddingLeft: 18,
    paddingVertical: 18,
  },
  bannerTextCol: {
    flex: 1.2,
    justifyContent: "space-between",
  },
  bannerTitle: {
    fontFamily: "InstrumentSans-Bold",
    fontSize: 18,
    color: "#FFFFFF",
  },
  bannerSubtitle: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 11,
    lineHeight: 15,
    color: "#FFFFFF",
  },
  shopNowBtn: {
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
    alignSelf: "flex-start",
  },
  shopNowText: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 12,
    color: "#453332",
  },
  bannerImageWrapper: {
    flex: 0.9,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  bannerImage: {
    width: 140,
    height: 140,
  },
  sectionHeader: {
    marginBottom: 14,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: "HedvigLettersSerif-Regular",
    fontSize: 20,
    color: "#3B0508",
  },
  viewAllText: {
    fontFamily: "InstrumentSans-Medium",
    fontSize: 12,
    color: "#F96951",
    textDecorationLine: "underline",
  },
  fashionHousesSection: {
    marginBottom: 24,
  },
  fashionHousesCarousel: {
    flexDirection: "row",
    gap: 16,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  fashionHouseItem: {
    alignItems: "center",
    width: 68,
  },
  fashionHouseLogoWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: "rgba(69, 51, 50, 0.12)",
    backgroundColor: "#FBF7EF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  fashionHouseLogo: {
    width: "100%",
    height: "100%",
  },
  fallbackLogo: {
    width: "100%",
    height: "100%",
    backgroundColor: "#F5EFE6",
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackInitial: {
    fontFamily: "HedvigLettersSerif-Regular",
    fontSize: 22,
    color: "#453332",
  },
  fashionHouseName: {
    fontFamily: "InstrumentSans-Medium",
    fontSize: 11,
    color: "#000000",
    textAlign: "center",
    marginTop: 6,
    maxWidth: 68,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 24,
  },
  productCard: {
    width: 156,
    marginBottom: 12,
  },
  productImageContainer: {
    width: 156,
    height: 206,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#F5F5F5",
  },
  productImage: {
    width: "100%",
    height: "100%",
  },
  heartBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#F96951",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  discountBadge: {
    position: "absolute",
    bottom: 24,
    left: 0,
    backgroundColor: "#006637",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  discountText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontFamily: "InstrumentSans-Bold",
  },
  featuredBadge: {
    position: "absolute",
    bottom: 6,
    left: 0,
    backgroundColor: "#E49100",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  featuredText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontFamily: "InstrumentSans-Bold",
  },
  productInfo: {
    paddingTop: 8,
  },
  productName: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 13,
    color: "#000000",
    lineHeight: 17,
  },
  productPrice: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 13,
    color: "#000000",
    marginTop: 4,
  },
  ratingBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  ratingText: {
    fontFamily: "InstrumentSans-Bold",
    fontSize: 10,
    color: "#000000",
  },
  flashSaleHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  flashTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  closingInText: {
    fontFamily: "InstrumentSans-Medium",
    fontSize: 10,
    color: "#000000",
    marginRight: 2,
  },
  timerBlock: {
    backgroundColor: "#453332",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  timerText: {
    fontFamily: "InstrumentSans-Bold",
    fontSize: 10,
    color: "#FFFFFF",
  },
  timerColon: {
    fontFamily: "InstrumentSans-Bold",
    fontSize: 10,
    color: "#453332",
  },
  filterPillsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  filterPill: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#453332",
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  filterPillActive: {
    backgroundColor: "#453332",
  },
  filterPillText: {
    fontFamily: "InstrumentSans-Medium",
    fontSize: 11,
    color: "#453332",
  },
  filterPillTextActive: {
    color: "#FFFFFF",
  },
});

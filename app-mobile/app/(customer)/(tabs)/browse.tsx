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
import { formatCurrency } from "@/shared/utils/formatters";

interface ProductCardItem {
  id: string;
  name: string;
  category: "T-Shirt" | "Pant" | "Dress" | "Jacket" | string;
  price: number | null;

  imageUrl: any;
  isFavorite?: boolean;
  discountBadge?: string;
  featured?: boolean;
}

const CATEGORIES = [
  { id: "T-Shirt", label: "T-Shirt" },
  { id: "Pant", label: "Pant" },
  { id: "Dress", label: "Dress" },
  { id: "Jacket", label: "Jacket" },
] as const;


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
  const normalizeCategory = (value: string) => {
    const category = value.toLowerCase().replace(/[ _-]/g, "");
    return ({ tshirt: "T-Shirt", tshirts: "T-Shirt", pant: "Pant", pants: "Pant", dress: "Dress", dresses: "Dress", jacket: "Jacket", jackets: "Jacket" } as Record<string, string>)[category] || value;
  };
  const loadCatalog = useCallback(async (page = 1) => {
    setError("");
    setRefreshing(true);
    try {
      const response = await apiFetchCollectionPage<{ id: string; name: string; category: string | null; priceFrom: number | null; imageUrl: string }>(
        `/api/catalog/marketplace?page=${page}&limit=50`, { silent: true });
      const items = response.items.map(item => ({ id: item.id, name: item.name, category: item.category || "Custom clothing", price: item.priceFrom, imageUrl: item.imageUrl }));
      setProducts(previous => page === 1 ? items : [...new Map([...previous, ...items].map(item => [item.id, item])).values()]);
      setNextPage(response.nextPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't load the catalog. Please try again.");
    } finally { setRefreshing(false); setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => {
    void loadCatalog();
    let active = true;
    apiFetch<{ savedCatalogIds: string[] }>("/api/preferences", { silent: true })
      .then(profile => { if (active) setFavorites(Object.fromEntries((profile.savedCatalogIds || []).map(id => [id, true]))); })
      .catch(err => { if (active && err instanceof ApiError && err.details.status === 404) setFavorites({}); });
    return () => { active = false; };
  }, [loadCatalog]));
  async function toggleFavorite(id: string) {
    if (favoriteLock.current) return;
    favoriteLock.current = true;
    setSavingFavorite(true);
    const updated = { ...favorites, [id]: !favorites[id] };
    try {
      const saved = await apiFetch<{ savedCatalogIds: string[] }>("/api/preferences", { method: "POST", body: JSON.stringify({ savedCatalogIds: Object.keys(updated).filter(key => updated[key]) }), silent: true });
      if (!Array.isArray(saved.savedCatalogIds)) throw new Error("The server hasn't enabled saved items yet. Please update the backend and try again.");
      setFavorites(Object.fromEntries(saved.savedCatalogIds.map(key => [key, true])));
    } catch (err) { showAlert("Couldn't save item", err instanceof Error ? err.message : "Please try again."); }
    finally { favoriteLock.current = false; setSavingFavorite(false); }
  }
  const filteredRecommend = products.filter(item =>
    (!searchQuery.trim() || item.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    && (!selectedCategory || normalizeCategory(item.category) === selectedCategory));
  const onRefresh = useCallback(async () => { await Promise.all([loadCatalog(1), loadUnread()]); }, [loadCatalog, loadUnread]);

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
          <View style={styles.headerActionsPill}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Notifications, ${unreadCount} unread messages`}
              onPress={() => router.push("/(customer)/messages")} style={styles.bellButton}>
              <Bell size={18} color="#1E1E1E" />
              {unreadCount > 0 && <View style={{ position: "absolute", top: -4, right: -5, backgroundColor: "#F96951", borderRadius: 10, minWidth: 18, paddingHorizontal: 4, height: 18, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "white", fontSize: 10, fontFamily: "InstrumentSans-SemiBold" }}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
              </View>}
            </Pressable>
          </View>
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

        {/* Categories Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Category</Text>
        </View>
        <View style={styles.categoryRow}>
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <Pressable
                key={cat.id}
                onPress={() => setSelectedCategory(isSelected ? "" : cat.id)}
                style={styles.categoryItem}
              >
                <View style={[styles.categoryCircle, isSelected && styles.categoryCircleActive]}>
                  {cat.id === "T-Shirt" && (
                    <Svg width={28} height={28} viewBox="0 0 29 29" fill="none">
                      <Path
                        d="M17.8124 3.58154C17.5092 4.32989 16.9896 4.9708 16.3202 5.42233C15.6508 5.87386 14.862 6.11549 14.0545 6.11633C13.2471 6.11549 12.4582 5.87386 11.7888 5.42233C11.1194 4.9708 10.5999 4.32989 10.2967 3.58154L1.09521 7.48122L3.68318 13.5824L6.52817 12.3771V24.817H21.6819V12.4223L24.4232 13.5851L27.0112 7.48388L17.8124 3.58154Z"
                        fill={isSelected ? "#FFFFFF" : "#453332"}
                      />
                    </Svg>
                  )}
                  {cat.id === "Pant" && (
                    <Svg width={28} height={28} viewBox="0 0 28.36 28.36" fill="none">
                      <Path
                        d="M5.92222 4.82061L5.99756 4.21128C6.05154 3.78282 6.26008 3.38881 6.58401 3.10322C6.90795 2.81764 7.32499 2.66013 7.75684 2.66028H20.608C21.0399 2.66013 21.4569 2.81764 21.7809 3.10322C22.1048 3.38881 22.3133 3.78282 22.3673 4.21128L22.4427 4.8195C22.4506 4.88217 22.445 4.94581 22.4263 5.00614C22.4076 5.06647 22.3762 5.12211 22.3342 5.16932C22.2922 5.21653 22.2407 5.25422 22.1829 5.27987C22.1252 5.30552 22.0627 5.31853 21.9995 5.31804H6.36204C6.29927 5.31804 6.2372 5.3047 6.17997 5.27891C6.12273 5.25312 6.07163 5.21546 6.03005 5.16843C5.98846 5.1214 5.95734 5.06607 5.93876 5.00611C5.92017 4.94614 5.91453 4.88291 5.92222 4.82061ZM18.7247 7.09173C18.9223 7.85245 19.3666 8.52614 19.9881 9.00729C20.6096 9.48843 21.3731 9.74985 22.159 9.75059H22.5568C22.6199 9.75109 22.6825 9.73808 22.7402 9.71243C22.7979 9.68678 22.8495 9.64908 22.8915 9.60187C22.9334 9.55466 22.9648 9.49903 22.9835 9.43869C23.0022 9.37836 23.0078 9.31473 22.9999 9.25206L22.7783 7.47948C22.7648 7.37179 22.7122 7.27283 22.6305 7.20136C22.5488 7.12988 22.4437 7.09088 22.3352 7.09173H18.7247ZM5.80811 9.75059H6.20584C6.9918 9.74985 7.75532 9.48843 8.3768 9.00729C8.99828 8.52614 9.44261 7.85245 9.64021 7.09173H6.02969C5.92115 7.09088 5.81608 7.12988 5.7344 7.20136C5.65272 7.27283 5.6001 7.37179 5.58654 7.47948L5.36497 9.25206C5.35707 9.31473 5.36266 9.37836 5.38137 9.43869C5.40007 9.49903 5.43146 9.55466 5.47343 9.60187C5.51539 9.64908 5.56696 9.68678 5.62469 9.71243C5.68241 9.73808 5.74495 9.75109 5.80811 9.75059ZM24.8046 23.7097L23.3289 11.9109C23.3154 11.8032 23.2628 11.7043 23.1811 11.6328C23.0994 11.5613 22.9943 11.5223 22.8858 11.5232H22.159C20.9029 11.5214 19.6879 11.0757 18.7286 10.2648C17.7693 9.45389 17.1275 8.33 16.9166 7.09173H15.0687V11.4933C15.0715 11.7219 14.9878 11.9432 14.8343 12.1127C14.6809 12.2822 14.469 12.3874 14.2412 12.4072C14.1199 12.4153 13.9983 12.3983 13.8839 12.3574C13.7695 12.3165 13.6648 12.2525 13.5761 12.1694C13.4875 12.0863 13.4169 11.9858 13.3688 11.8743C13.3206 11.7627 13.2959 11.6425 13.2962 11.521V7.09173H11.4482C11.2374 8.33 10.5956 9.45389 9.63628 10.2648C8.67699 11.0757 7.46194 11.5214 6.20584 11.5232H5.47575C5.36722 11.5223 5.26215 11.5613 5.18047 11.6328C5.09879 11.7043 5.04617 11.8032 5.03261 11.9109L3.56026 23.7097C3.52043 24.0296 3.5686 24.3543 3.69959 24.6489C3.83058 24.9434 4.03942 25.1967 4.30364 25.3814C4.61506 25.5954 4.98494 25.708 5.36275 25.7038H9.82744C10.2216 25.7039 10.6046 25.5725 10.9158 25.3306C11.227 25.0886 11.4487 24.7498 11.5457 24.3677L14.1824 14.1754L16.818 24.3611C16.9139 24.7446 17.1352 25.085 17.4467 25.3283C17.7583 25.5716 18.1422 25.7037 18.5374 25.7038H23.0021C23.3797 25.7088 23.7496 25.5969 24.0612 25.3836C24.3258 25.1987 24.5349 24.9451 24.6659 24.6501C24.7969 24.3551 24.8449 24.0299 24.8046 23.7097Z"
                        fill={isSelected ? "#FFFFFF" : "#453332"}
                      />
                    </Svg>
                  )}
                  {cat.id === "Dress" && (
                    <Svg width={28} height={28} viewBox="0 0 28.36 28.36" fill="none">
                      <Path
                        d="M7.34261 8.88799C7.22041 8.68818 7.14106 8.46515 7.10959 8.23306C7.07812 8.00096 7.09522 7.76486 7.15981 7.53972C7.20367 7.35279 7.27857 7.17454 7.38139 7.01238L9.7511 3.62232V0.885903C9.75084 0.764403 9.77555 0.644147 9.82372 0.532602C9.87188 0.421058 9.94247 0.320608 10.0311 0.237492C10.1197 0.154377 10.2245 0.0903699 10.3389 0.0494481C10.4533 0.00852632 10.5749 -0.00843656 10.6961 -0.000386923C10.9244 0.0192161 11.1368 0.124674 11.2904 0.294712C11.4439 0.464749 11.5273 0.68671 11.5237 0.915815V3.5913L12.1053 4.32027C12.3585 4.63782 12.6813 4.89289 13.0488 5.06578C13.4163 5.23867 13.8186 5.32474 14.2246 5.31735C14.6257 5.30601 15.0192 5.20653 15.3775 5.02598C15.7357 4.84542 16.0498 4.58822 16.2975 4.27264L16.8414 3.5913V0.885903C16.8412 0.764403 16.8659 0.644147 16.914 0.532602C16.9622 0.421058 17.0328 0.320608 17.1214 0.237492C17.21 0.154377 17.3148 0.0903699 17.4292 0.0494481C17.5436 0.00852632 17.6652 -0.00843656 17.7864 -0.000386923C18.0147 0.0192161 18.2271 0.124674 18.3807 0.294712C18.5343 0.464749 18.6176 0.68671 18.614 0.915815V3.5913L20.987 7.01238C21.0899 7.17454 21.1648 7.35279 21.2086 7.53972C21.2732 7.76486 21.2903 8.00096 21.2588 8.23306C21.2274 8.46515 21.148 8.68818 21.0258 8.88799C21.0214 8.89442 21.0173 8.90107 21.0136 8.90793L19.4781 11.3164C19.4378 11.3797 19.3821 11.4316 19.3162 11.4675C19.2504 11.5033 19.1765 11.5219 19.1015 11.5214H9.26364C9.18921 11.5213 9.11598 11.5025 9.05073 11.4667C8.98548 11.4309 8.9303 11.3792 8.89029 11.3164L7.3548 8.90793C7.35109 8.90107 7.34702 8.89442 7.34261 8.88799ZM23.7944 23.2414C23.7898 23.2285 23.7842 23.2159 23.7777 23.2038L19.2444 13.5488C19.2085 13.4724 19.1517 13.4079 19.0804 13.3628C19.0092 13.3176 18.9265 13.2938 18.8422 13.294H9.52288C9.43855 13.2938 9.35592 13.3176 9.28468 13.3628C9.21345 13.4079 9.15657 13.4724 9.12073 13.5488L4.58736 23.2038C4.58089 23.2159 4.57534 23.2285 4.57074 23.2414C4.47416 23.4745 4.4278 23.7253 4.43467 23.9774C4.44154 24.2296 4.5015 24.4775 4.61062 24.7049C4.75617 25.0041 4.98298 25.2563 5.26509 25.4326C5.54721 25.6089 5.87326 25.7023 6.20594 25.702H22.1592C22.4917 25.7021 22.8175 25.6086 23.0994 25.4323C23.3813 25.256 23.6079 25.0039 23.7534 24.7049C23.8627 24.4776 23.9228 24.2297 23.9299 23.9776C23.9369 23.7254 23.8908 23.4746 23.7944 23.2414Z"
                        fill={isSelected ? "#FFFFFF" : "#453332"}
                      />
                    </Svg>
                  )}
                  {cat.id === "Jacket" && (
                    <Svg width={28} height={28} viewBox="0 0 28.36 28.36" fill="none">
                      <Path
                        d="M26.29 13.3538L20.2732 4.3347C20.1117 4.09266 19.8931 3.8941 19.6368 3.75653C19.3804 3.61896 19.094 3.54663 18.8031 3.54591H9.55687C9.2659 3.54663 8.97959 3.61896 8.72319 3.75653C8.4668 3.8941 8.24822 4.09266 8.08673 4.3347L2.06993 13.3538C1.92921 13.5646 1.83533 13.8031 1.79462 14.0533C1.75391 14.3035 1.76733 14.5595 1.83396 14.804L4.20922 23.5107C4.3115 23.8857 4.53424 24.2167 4.84312 24.4528C5.15201 24.6888 5.52991 24.8167 5.91865 24.8169H8.86224C9.33235 24.8169 9.78322 24.6301 10.1156 24.2977C10.4481 23.9653 10.6348 23.5144 10.6348 23.0443V21.2717H17.7251V23.0443C17.7251 23.5144 17.9119 23.9653 18.2443 24.2977C18.5767 24.6301 19.0276 24.8169 19.4977 24.8169H22.4413C22.83 24.8167 23.2079 24.6888 23.5168 24.4528C23.8257 24.2167 24.0484 23.8857 24.1507 23.5107L26.526 14.804C26.5926 14.5595 26.606 14.3035 26.5653 14.0533C26.5246 13.8031 26.4307 13.5646 26.29 13.3538ZM8.86224 23.0443H5.91865L3.5445 14.3376L7.08966 9.01985V19.4991C7.08966 19.9692 7.27641 20.4201 7.60883 20.7525C7.94126 21.0849 8.39212 21.2717 8.86224 21.2717V23.0443ZM13.2937 15.0677C13.2937 15.3027 13.2003 15.5282 13.0341 15.6944C12.8679 15.8606 12.6425 15.954 12.4074 15.954C12.1723 15.954 11.9469 15.8606 11.7807 15.6944C11.6145 15.5282 11.5211 15.3027 11.5211 15.0677V10.7625C11.5211 10.5275 11.6145 10.302 11.7807 10.1358C11.9469 9.96961 12.1723 9.87623 12.4074 9.87623C12.6425 9.87623 12.8679 9.96961 13.0341 10.1358C13.2003 10.302 13.2937 10.5275 13.2937 10.7625V15.0677ZM16.8388 14.1814C16.8388 14.4164 16.7455 14.6419 16.5793 14.8081C16.413 14.9743 16.1876 15.0677 15.9526 15.0677C15.7175 15.0677 15.4921 14.9743 15.3259 14.8081C15.1596 14.6419 15.0663 14.4164 15.0663 14.1814V10.7625C15.0663 10.5275 15.1596 10.302 15.3259 10.1358C15.4921 9.96961 15.7175 9.87623 15.9526 9.87623C16.1876 9.87623 16.413 9.96961 16.5793 10.1358C16.7455 10.302 16.8388 10.5275 16.8388 10.7625V14.1814ZM14.18 8.72073L9.23337 5.80484L9.55687 5.31848H18.8031L19.1266 5.80484L14.18 8.72073ZM22.4413 23.0443H19.4977V21.2717C19.9678 21.2717 20.4187 21.0849 20.7511 20.7525C21.0835 20.4201 21.2703 19.9692 21.2703 19.4991V9.01985L24.8154 14.3376L22.4413 23.0443Z"
                        fill={isSelected ? "#FFFFFF" : "#453332"}
                      />
                    </Svg>
                  )}
                </View>
                <Text style={[styles.categoryLabel, isSelected && styles.categoryLabelActive]}>
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Recommend For You Section */}
        <View onLayout={event => { catalogOffset.current = event.nativeEvent.layout.y; }} style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Explore the catalog</Text>
          <Pressable onPress={() => { setSelectedCategory(""); setSearchQuery(""); }}>
            <Text style={styles.viewAllText}>View All</Text>
          </Pressable>
        </View>
        {loading && <ActivityIndicator color="#453332" />}
        {error ? <Pressable onPress={() => void loadCatalog()}><Text style={{ color: "#9F1239", paddingVertical: 12 }}>{error} Tap to retry.</Text></Pressable> : null}
        {!loading && !error && filteredRecommend.length === 0 && <Text style={{ color: "#646464", paddingVertical: 20 }}>No catalog items match yet. Try another category or check back soon.</Text>}
        <View style={styles.gridContainer}>
          {filteredRecommend.map((item) => (
            <Pressable key={item.id} accessibilityRole="button" onPress={() => router.push({ pathname: "/(customer)/catalog/[id]", params: { id: item.id } })} style={styles.productCard}>
              <View style={styles.productImageContainer}>
                <Image
                  source={typeof item.imageUrl === "string" ? { uri: item.imageUrl } : item.imageUrl}
                  style={styles.productImage}
                  resizeMode="cover"
                />
                <Pressable
                  disabled={savingFavorite} accessibilityLabel={favorites[item.id] ? "Unsave item" : "Save item"}
                  onPress={event => { event.stopPropagation(); void toggleFavorite(item.id); }}
                  style={[
                    styles.heartBtn,
                    favorites[item.id] && { backgroundColor: "#F96951" },
                  ]}
                >
                  <Heart
                    size={13}
                    color={favorites[item.id] ? "#FFFFFF" : "#FFFFFF"}
                    fill={favorites[item.id] ? "#FFFFFF" : "none"}
                  />
                </Pressable>
              </View>
              <View style={styles.productInfo}>
                <Text numberOfLines={1} style={styles.productName}>{item.name}</Text>
                <Text style={styles.productCategory}>{item.category}</Text>
                <View style={styles.priceReviewRow}>
                  <Text style={styles.productPrice}>{item.price !== null && item.price > 0 ? formatCurrency(item.price) : "Price on request"}</Text>

                </View>
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
    paddingTop: 36,
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
    fontFamily: "InstrumentSans-Bold",
    fontSize: 18,
    color: "#000000",
  },
  headerActionsPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  bellButton: {
    position: "relative",
    padding: 4,
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
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
    fontFamily: "InstrumentSans-Bold",
    fontSize: 16,
    color: "#000000",
  },
  viewAllText: {
    fontFamily: "InstrumentSans-Medium",
    fontSize: 12,
    color: "#F96951",
    textDecorationLine: "underline",
  },
  categoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  categoryItem: {
    alignItems: "center",
    gap: 6,
  },
  categoryCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FFEAE6",
    alignItems: "center",
    justifyContent: "center",
  },
  categoryCircleActive: {
    backgroundColor: "#F96951",
  },
  categoryLabel: {
    fontFamily: "InstrumentSans-Medium",
    fontSize: 11,
    color: "#000000",
  },
  categoryLabelActive: {
    color: "#F96951",
    fontFamily: "InstrumentSans-Bold",
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 24,
  },
  productCard: {
    width: "47.5%",
    marginBottom: 4,
  },
  productImageContainer: {
    width: "100%",
    height: 196,
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
    top: 12,
    right: 12,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
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
  },
  productCategory: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 10,
    color: "#787676",
    marginTop: 1,
  },
  priceReviewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  productPrice: {
    fontFamily: "InstrumentSans-Bold",
    fontSize: 12,
    color: "#000000",
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  ratingText: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 11,
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

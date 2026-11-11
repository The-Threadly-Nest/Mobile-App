import { typeScale } from "@/shared/utils/typeScale";
import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { View, FlatList, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Search, SlidersHorizontal } from "lucide-react-native";
import { Text, TextInput } from "./Typography";
import CachedImage from "./CachedImage";
import BackArrowIcon from "./BackArrowIcon";
import CatalogFilters from "./CatalogFilters";
import { SCREEN_TOP_SPACING } from "../utils/screenSpacing";
import { apiFetchCollectionPage, getCachedResponse, ApiError } from "../utils/apiClient";
import { formatCurrency } from "../utils/formatters";
import { filterCatalogItems } from "../utils/catalogFilters";
import { getConnectionStatus, subscribeConnectionStatus } from "../services/connectionStatus";

type Item = { id: string; name: string; imageUrl?: string; image?: string; brandLogoUrl?: string; location?: string; priceFrom?: number | null; category?: string; fulfillmentType?: string; fashionHouse?: { shopName: string } };
export default function DiscoveryPage({ kind }: { kind: "marketplace" | "houses" }) {
  const offline = useSyncExternalStore(subscribeConnectionStatus, getConnectionStatus) === "offline";
  const houses = kind === "houses";
  const params = useLocalSearchParams<{ q?: string; filters?: string }>();
  const base = houses ? "/api/fashion-houses" : "/api/catalog/marketplace";
  const limit = houses ? 20 : 50;
  const [input, setInput] = useState(params.q || "");
  const [query, setQuery] = useState(params.q || "");
  const [type, setType] = useState("");
  const [sort, setSort] = useState("newest");
  const [filters, setFilters] = useState(params.filters === "1");
  const [items, setItems] = useState<Item[]>(() => getCachedResponse<Item[]>(`${base}?page=1&limit=${limit}`) || []);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  const revision = useRef(0);
  const moreLock = useRef(false);
  const querySuffix = `${query ? `&q=${encodeURIComponent(query)}` : ""}${type && !houses ? `&fulfillmentType=${type}` : ""}${sort !== "newest" && !houses ? `&sort=${sort}` : ""}`;
  const load = async (page: number, generation: number) => {
    if (page === 1) setLoading(true); else setMore(true);
    setError("");
    try {
      const data = await apiFetchCollectionPage<Item>(`${base}?page=${page}&limit=${limit}${querySuffix}`, { silent: true });
      if (generation !== revision.current) return;
      setItems(previous => page === 1 ? data.items : [...new Map([...previous, ...data.items].map(item => [item.id, item])).values()]);
      setNextPage(data.nextPage);
    } catch (err) { if (generation === revision.current && getConnectionStatus() !== "offline" && !(err instanceof ApiError && err.details.status === 0)) setError(err instanceof Error ? err.message : "We couldn't load this page. Please try again."); }
    finally { if (generation === revision.current) { setLoading(false); setMore(false); } moreLock.current = false; }
  };
  useEffect(() => {
    const generation = ++revision.current;
    setItems(getCachedResponse<Item[]>(`${base}?page=1&limit=${limit}${querySuffix}`) || []); setNextPage(null);
    void load(1, generation);
    return () => { revision.current++; };
  }, [query, type, sort, kind]);
  return <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
    <View style={styles.header}><Pressable accessibilityLabel="Back" accessibilityRole="button" hitSlop={4} onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}><BackArrowIcon size={24} color="#453332" /></Pressable><Text style={styles.title}>{houses ? "Fashion houses" : "Marketplace"}</Text></View>
    <View style={styles.searchRow}>
      <TextInput accessibilityLabel={houses ? "Search fashion houses or cities" : "Search clothes or designers"} placeholder={houses ? "Name or city" : "Clothes, style or designer"} value={input} onChangeText={setInput} returnKeyType="search" onSubmitEditing={() => setQuery(input.trim())} style={styles.searchInput} />
      <Pressable accessibilityLabel="Search" onPress={() => setQuery(input.trim())} style={styles.primaryIcon}><Search size={20} color="#FFFDF9" /></Pressable>
      {!houses ? <Pressable accessibilityLabel="Filter marketplace" onPress={() => setFilters(true)} style={styles.primaryIcon}><SlidersHorizontal size={20} color="#FFFDF9" /></Pressable> : null}
    </View>
    {!offline && error ? <Pressable onPress={() => void load(1, revision.current)} style={styles.notice}><Text style={styles.body}>{error} Tap to retry.</Text></Pressable> : null}
    {loading && !items.length ? <ActivityIndicator color="#F96951" style={styles.notice} /> : null}
    <FlatList key={houses ? "houses" : "products"} data={houses ? items : filterCatalogItems(items, type, sort)} numColumns={houses ? 3 : 2} keyExtractor={item => item.id} contentContainerStyle={styles.list} columnWrapperStyle={styles.columns}
      ListEmptyComponent={!offline && !loading && !error ? <Text style={styles.body}>No matches. Try another search or filter.</Text> : null}
      onEndReached={() => { if (!offline && nextPage && !loading && !more && !moreLock.current) { moreLock.current = true; void load(nextPage, revision.current); } }} onEndReachedThreshold={0.5}
      ListFooterComponent={more ? <ActivityIndicator color="#F96951" /> : null}
      renderItem={({ item }) => <Pressable accessibilityRole="button" style={houses ? styles.houseCard : styles.card} onPress={() => houses ? router.push({ pathname: "/(customer)/fashion-house/[fashionHouseId]", params: { fashionHouseId: item.id, initialName: item.name, initialImage: item.image || item.brandLogoUrl || "", initialLocation: item.location || "" } }) : router.push({ pathname: "/(customer)/catalog/[id]", params: { id: item.id } })}>
        <View style={houses ? styles.houseLogo : styles.imageFrame}>
          {item.imageUrl || item.image || item.brandLogoUrl ? <CachedImage source={houses ? item.image || item.brandLogoUrl : item.imageUrl} style={styles.image} contentFit="cover" /> : houses ? <Text style={styles.initial}>{item.name?.charAt(0).toUpperCase() || "A"}</Text> : null}
        </View>
        {houses ? <Text numberOfLines={1} style={styles.houseName}>{item.name}</Text> : <View style={styles.copy}><Text numberOfLines={1} style={styles.name}>{item.name}</Text><Text style={styles.price}>{item.priceFrom ? formatCurrency(item.priceFrom) : "Price on request"}</Text></View>}
      </Pressable>} />
    <CatalogFilters visible={!houses && filters} onClose={() => setFilters(false)} type={type} onTypeChange={setType} sort={sort} onSortChange={setSort} />
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: SCREEN_TOP_SPACING, paddingBottom: 16 },
  title: { flex: 1, ...typeScale.pageTitle, color: "#4A403B" },
  backBtn: { width: 36, height: 36, alignItems: "flex-start", justifyContent: "center" },
  searchRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, marginBottom: 18 },
  searchInput: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 24, paddingHorizontal: 16, color: "#4A403B", minHeight: 48 },
  primaryIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#F96951", justifyContent: "center", alignItems: "center" },
  list: { paddingHorizontal: 16, paddingBottom: 40 }, columns: { justifyContent: "space-between", gap: 14 },
  card: { flex: 1, maxWidth: "48%", marginBottom: 24 },
  imageFrame: { width: "100%", aspectRatio: 156 / 206, borderRadius: 14, overflow: "hidden", backgroundColor: "#FFFDF9" },
  image: { width: "100%", height: "100%" }, copy: { paddingTop: 8, gap: 4 },
  name: { ...typeScale.productName, color: "#4A403B" },
  price: { ...typeScale.productPrice, color: "#4A403B" },
  houseCard: { flex: 1, maxWidth: "30%", alignItems: "center", marginBottom: 24 },
  houseLogo: { width: 64, height: 64, borderRadius: 32, borderWidth: 1.5, borderColor: "rgba(69, 51, 50, 0.12)", backgroundColor: "#F9E8D3", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  initial: { fontFamily: "InstrumentSans-Regular", fontSize: 22, color: "#4A403B" },
  houseName: { ...typeScale.compactLabel, color: "#4A403B", textAlign: "center", marginTop: 6, maxWidth: 68 },
  body: { ...typeScale.body, color: "#4A403B", }, notice: { padding: 20 },
});

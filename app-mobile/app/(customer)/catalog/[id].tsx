import { typeScale } from "@/shared/utils/typeScale";
import React, { useEffect, useState, useCallback } from "react";
import { View, ScrollView, Pressable, Image, StyleSheet, useWindowDimensions, ActivityIndicator } from "react-native";
import { Text } from "@/shared/components/Typography";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import {
  Star,
  Eye,
  Heart,
  ShoppingCart,
  ChevronRight,
} from "lucide-react-native";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import CachedImage from "@/shared/components/CachedImage";
import { apiFetch } from "@/shared/utils/apiClient";
import { formatCurrency } from "@/shared/utils/formatters";
import { loadCatalogFavorites, saveCatalogFavorite } from "@/shared/utils/catalogFavorites";
import { useCartStore } from "@/stores/useCartStore";
import { useAppAlert } from "@/shared/hooks/useAppAlert";
import { type CatalogProduct, readyItemError } from "@/shared/utils/catalogCommerce";

export default function CatalogItemDetailScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { showAlert } = useAppAlert();
  const addItemToCart = useCartStore((s) => s.addItem);

  const {
    id,
    initialName,
    initialPrice,
    initialImage,
    initialVendorName,
    initialLocation,
    initialFashionHouseId,
    categoryTag,
  } = useLocalSearchParams<{
    id: string;
    initialName?: string;
    initialPrice?: string;
    initialImage?: string;
    initialVendorName?: string;
    initialLocation?: string;
    initialFashionHouseId?: string;
    badge?: string;
    categoryTag?: string;
  }>();

  const [garmentData, setGarmentData] = useState<CatalogProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [savingFav, setSavingFav] = useState(false);
  const favoriteLock = React.useRef(false);
  const [selectedVariant, setSelectedVariant] = useState("");
  const [selectedColor, setSelectedColor] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setGarmentData(null);
    if (!id) { setError("This item couldn't be opened."); setLoading(false); return; }
    apiFetch<CatalogProduct>("/api/catalog/item/" + encodeURIComponent(id), { silent: true })
      .then(data => { if (active) { setGarmentData(data); setSelectedVariant(data.sizes[0] || ""); setSelectedColor(data.colors[0] || ""); } })
      .catch(error => { if (active) setError(error instanceof Error ? error.message : "We couldn't load this item."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, reload]);

  useFocusEffect(useCallback(() => {
    let active = true;
    if (id) loadCatalogFavorites().then(profile => { if (active) setIsFavorite(profile.savedCatalogIds.includes(id)); }).catch(() => { });
    return () => { active = false; };
  }, [id]));

  const toggleFav = async () => {
    if (!id || favoriteLock.current) return;
    const wasSaved = isFavorite;
    favoriteLock.current = true; setSavingFav(true);
    setIsFavorite(!wasSaved);
    try { const profile = await saveCatalogFavorite(id, !wasSaved); setIsFavorite(profile.savedCatalogIds.includes(id)); }
    catch (error) { setIsFavorite(wasSaved); showAlert("Couldn't update saved item", error instanceof Error ? error.message : "Please try again."); }
    finally { favoriteLock.current = false; setSavingFav(false); }
  };
  const garmentName = garmentData?.name || initialName || "";
  const parsedNumericPrice = garmentData?.priceFrom ?? null;
  const garmentPriceFormatted = parsedNumericPrice ? formatCurrency(parsedNumericPrice) : "Price on request";
  const imageUrl = garmentData?.imageUrl || initialImage || "";
  const categoryName = garmentData?.category || "";
  const fashionHouseId = garmentData?.fashionHouseId || "";
  const vendorName = garmentData?.fashionHouse?.shopName || "";
  const isCustomFit = garmentData?.fulfillmentType !== "ready_to_wear";

  const handleBookMeasurement = () => {
    const targetHouseId = garmentData?.fashionHouseId || garmentData?.fashionHouse?.id;
    if (!garmentData || !targetHouseId) return;
    router.push({
      pathname: "/(customer)/chat/[fashionHouseId]",
      params: {
        fashionHouseId: targetHouseId,
        fashionHouseName: vendorName,
        garmentName: garmentData.name,
        catalogItemId: garmentData.id,
        garmentPrice: garmentPriceFormatted,
        startNew: String(Date.now()),
      },
    });
  };
  const handleAddToCart = (buyNow = false) => {
    if (!garmentData) return;
    const problem = readyItemError(garmentData, selectedVariant, selectedColor);
    if (problem) { showAlert("Check your selection", problem); return; }
    const existing = useCartStore.getState().items.find(item => item.id === garmentData.id && item.selectedSize === selectedVariant && item.selectedColor === selectedColor);
    if (existing && existing.quantity >= 20) { showAlert("Quantity limit", "You can order up to 20 of this size and colour at once."); return; }
    addItemToCart({ id: garmentData.id, name: garmentData.name, price: garmentData.priceFrom!, image: garmentData.imageUrl, vendorName, fashionHouseId, selectedSize: selectedVariant, selectedColor });
    if (buyNow) router.push("/(customer)/cart");
    else showAlert("Added to cart", garmentData.name + " has been added to your cart.");
  };

  const heroHeight = Math.min(Math.max(height * 0.48, 380), 460);

  const variants = (garmentData?.sizes || []).map(label => ({ label, disabled: false }));
  const colors = (garmentData?.colors || []).map(name => ({ name }));

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 24 + insets.bottom },
          isLandscape && { maxWidth: 840, alignSelf: "center", width: "100%" },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* ─── Hero Image Section (Figma 95:7441) ─── */}
        <View style={[styles.heroContainer, { height: heroHeight }]}>
          <CachedImage
            source={typeof imageUrl === "string" ? { uri: imageUrl } : imageUrl}
            style={styles.heroImage}
            contentFit="cover"
            contentPosition="top center"
          />

          {/* Floating Top Nav (Back Arrow < and More Options) */}
          <View style={[styles.floatingNav, { top: Math.max(insets.top, 14) + 6 }]}>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={({ pressed }) => [styles.navCircleBtn, { opacity: pressed ? 0.75 : 1 }]}
            >
              <BackArrowIcon size={24} color="#FFFDF9" />
            </Pressable>

          </View>


        </View>

        {/* ─── Cloth Details Bottom Sheet (Figma 95:7449) ─── */}
        <View style={styles.sheetCard}>
          {loading && <ActivityIndicator color="#453332" />}
          {error ? <Pressable onPress={() => setReload(value => value + 1)}><Text style={{ color: "#F96951", paddingVertical: 16 }}>{error} Tap to retry.</Text></Pressable> : null}
          {/* Drag Handle */}
          <View style={styles.dragHandle} />

          {/* Title Row + Favorite Heart */}
          <View style={styles.headerRow}>
            <View style={styles.titleCol}>
              <Text style={styles.garmentTitle}>{garmentName}</Text>
              <Text style={styles.categorySubtitle}>{categoryName}</Text>
            </View>

            <Pressable
              onPress={toggleFav}
              disabled={savingFav}
              accessibilityRole="button"
              accessibilityLabel={isFavorite ? "Remove from saved" : "Save item"}
              accessibilityState={{ selected: isFavorite, busy: savingFav, disabled: savingFav }}
              style={({ pressed }) => [styles.favoriteCard, { opacity: pressed ? 0.8 : 1 }]}
            >
              <Heart
                size={22}
                color={isFavorite ? "#F96951" : "#2B2B2B"}
                fill={isFavorite ? "#F96951" : "none"}
              />
            </Pressable>
          </View>

          <View style={styles.priceRatingRow}><Text style={styles.mainPrice}>{garmentPriceFormatted}</Text></View>
          {!isCustomFit && (
            <Text style={{ fontFamily: "InstrumentSans-Medium", color: "#4A403B", marginTop: 4, marginBottom: 8 }}>
              Ready for pickup
            </Text>
          )}
          {vendorName ? (
            <Pressable
              onPress={() => router.push({ pathname: "/(customer)/fashion-house/[fashionHouseId]", params: { fashionHouseId } })}
              style={({ pressed }) => [styles.vendorCard, { opacity: pressed ? 0.8 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel={`Visit ${vendorName}`}
            >
              <View style={styles.vendorAvatar}>
                {garmentData?.fashionHouse?.brandLogoUrl ? (
                  <Image source={{ uri: garmentData.fashionHouse.brandLogoUrl }} style={styles.vendorAvatarImg} resizeMode="cover" />
                ) : (
                  <Text style={styles.vendorAvatarLetter}>{vendorName.charAt(0).toUpperCase()}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.vendorNameText}>{vendorName}</Text>
                <Text style={styles.vendorSubtitle}>Fashion House</Text>
              </View>
              <ChevronRight size={18} color="#453332" />
            </Pressable>
          ) : null}

          {/* Description */}
          <Text style={styles.descriptionText}>
            {garmentData?.description || ""}
          </Text>



          {/* Size Variant Selector (Small circular buttons) */}
          {!isCustomFit && <View style={[styles.sectionBlock, colors.length === 0 && { marginBottom: 0 }]}>
            <Text style={styles.sectionTitle}>Size</Text>
            <View style={styles.variantRow}>
              {variants.map((v) => {
                const isSelected = selectedVariant === v.label;
                return (
                  <Pressable
                    key={v.label}
                    disabled={v.disabled}
                    onPress={() => setSelectedVariant(v.label)}
                    style={[
                      styles.roundPill,
                      isSelected && styles.roundPillActive,
                      v.disabled && styles.roundPillDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.roundPillText,
                        isSelected && styles.roundPillTextActive,
                        v.disabled && styles.roundPillTextDisabled,
                      ]}
                    >
                      {v.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>}

          {/* Color Selector */}
          {!isCustomFit && colors.length > 0 && <View style={[styles.sectionBlock, { marginBottom: 0 }]}>
            <Text style={styles.sectionTitle}>Color</Text>
            <View style={styles.colorRow}>
              {colors.map((c) => {
                const isSelected = selectedColor === c.name;
                return (
                  <Pressable
                    key={c.name}
                    onPress={() => setSelectedColor(c.name)}
                    style={[
                      styles.colorPill,
                      isSelected && styles.colorPillActive,
                    ]}
                    accessibilityLabel={c.name}
                  >
                    <Text
                      style={[
                        styles.roundPillText,
                        isSelected && styles.roundPillTextActive,
                      ]}
                    >
                      {c.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>}

          {/* Purchase actions follow size and colour choices. */}
          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            {isCustomFit ? <Pressable disabled={!garmentData || loading || Boolean(error)} style={styles.addToCartBtn} onPress={handleBookMeasurement}><Text style={styles.addToCartText}>Book measurement</Text></Pressable>
              : <View style={{ flexDirection: "row", gap: 10, width: "100%" }}>
                <Pressable disabled={!garmentData || loading || Boolean(error)} style={[styles.addToCartBtn, { flex: 1, width: undefined, backgroundColor: "#453332" }]} onPress={() => handleAddToCart()}><Text style={styles.addToCartText}>Add to cart</Text></Pressable>
                <Pressable disabled={!garmentData || loading || Boolean(error)} style={[styles.addToCartBtn, { flex: 1, width: undefined, backgroundColor: "#F96951" }]} onPress={() => handleAddToCart(true)}><Text style={styles.addToCartText}>Buy now</Text></Pressable>
              </View>}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    paddingBottom: 24,
  },
  heroContainer: {
    width: "100%",
    position: "relative",
    backgroundColor: "#2B2B2B",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  floatingNav: {
    position: "absolute",
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 10,
  },
  navCircleBtn: {
    width: 40,
    height: 40,
    
    
    alignItems: "center",
    justifyContent: "center",
  },
  paginationRow: {
    position: "absolute",
    bottom: 38,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  paginationDash: {
    width: 14,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
  },
  paginationDashActive: {
    width: 26,
    backgroundColor: "#F96951",
  },
  sheetCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -26,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  dragHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E4D5B7",
    alignSelf: "center",
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  titleCol: {
    flex: 1,
    paddingRight: 14,
  },
  garmentTitle: {
    fontFamily: "InstrumentSans-Bold",
    fontSize: 22,
    color: "#4A403B",
    letterSpacing: -0.3,
  },
  categorySubtitle: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 13,
    color: "#4A403B",
    marginTop: 2,
  },
  favoriteCard: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "#F9E8D3",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2B2B2B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#453332",
  },
  priceRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  priceLeftGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  mainPrice: {
    fontFamily: "InstrumentSans-Bold",
    fontSize: 20,
    color: "#4A403B",
  },
  originalPrice: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 13,
    color: "#4A403B",
    textDecorationLine: "line-through",
    marginLeft: 8,
  },
  discountBadge: {
    backgroundColor: "#453332",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginLeft: 8,
  },
  discountBadgeText: {
    fontFamily: "InstrumentSans-Bold",
    fontSize: 11,
    color: "#FFFDF9",
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingScore: {
    fontFamily: "InstrumentSans-Bold",
    fontSize: 15,
    color: "#4A403B",
  },
  descriptionText: {
    ...typeScale.body,
    color: "#4A403B",
    marginBottom: 16,
  },
  socialStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    marginBottom: 16,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statText: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 12,
    color: "#4A403B",
  },
  divider: {
    display: "none",
    height: 1,
    backgroundColor: "#FFFDF9",
    marginBottom: 18,
  },
  sectionBlock: {
    marginBottom: 20,
  },
  sectionTitle: {
    ...typeScale.sectionTitle,
    color: "#4A403B",
    marginBottom: 10,
  },
  variantRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  roundPill: {
    width: 38,
    height: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#453332",
    backgroundColor: "#F9E8D3",
    alignItems: "center",
    justifyContent: "center",
  },
  roundPillActive: {
    backgroundColor: "#FFFDF9",
    borderColor: "#F96951",
  },
  roundPillDisabled: {
    backgroundColor: "#FFFDF9",
    borderColor: "transparent",
  },
  roundPillText: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 13,
    color: "#4A403B",
  },
  roundPillTextActive: {
    fontFamily: "InstrumentSans-Bold",
    color: "#4A403B",
  },
  roundPillTextDisabled: {
    color: "#4A403B",
  },
  colorRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  colorPill: {
    height: 38,
    minWidth: 44,
    borderRadius: 999,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#453332",
    backgroundColor: "#FFFDF9",
    alignItems: "center",
    justifyContent: "center",
  },
  colorPillActive: {
    backgroundColor: "#FFFDF9",
    borderColor: "#F96951",
  },
  vendorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#FFFDF9",
    borderRadius: 16,
    marginVertical: 12,
  },
  vendorAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#453332",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  vendorAvatarImg: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  vendorAvatarLetter: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 16,
    color: "#FFFDF9",
  },
  vendorNameText: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 14,
    color: "#4A403B",
  },
  vendorSubtitle: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 11,
    color: "#453332",
    marginTop: 1,
  },
  bottomBar: {
    backgroundColor: "#FFFFFF",
    marginTop: 12,
    paddingTop: 0,
    alignItems: "center",
  },
  addToCartBtn: {
    backgroundColor: "#F96951",
    height: 54,
    borderRadius: 27,
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#2B2B2B",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 3,
  },
  addToCartText: {
    fontFamily: "InstrumentSans-Bold",
    fontSize: 16,
    color: "#FFFDF9",
  },
});

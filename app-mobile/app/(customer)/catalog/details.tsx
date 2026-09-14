import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useCartStore } from '../../../src/stores/useCartStore';
import { apiFetch } from '../../../src/shared/utils/apiClient';

function CustomBrushIcon({ width = 22, height = 22, color = '#FFFFFF' }: { width?: number; height?: number; color?: string }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21.81 3.94012C20.27 7.78012 16.41 13.0001 13.18 15.5901L11.21 17.1701C10.96 17.3501 10.71 17.5101 10.43 17.6201C10.43 17.4401 10.42 17.2401 10.39 17.0501C10.28 16.2101 9.90002 15.4301 9.23002 14.7601C8.55002 14.0801 7.72002 13.6801 6.87002 13.5701C6.67002 13.5601 6.47002 13.5401 6.27002 13.5601C6.38002 13.2501 6.55002 12.9601 6.76002 12.7201L8.32002 10.7501C10.9 7.52012 16.14 3.64012 19.97 2.11012C20.56 1.89012 21.13 2.05012 21.49 2.42012C21.87 2.79012 22.05 3.36012 21.81 3.94012Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10.43 17.6201C10.43 18.7201 10.01 19.77 9.22003 20.57C8.61003 21.18 7.78003 21.6001 6.79003 21.7301L4.33003 22.0001C2.99003 22.1501 1.84003 21.01 2.00003 19.65L2.27003 17.1901C2.51003 15.0001 4.34003 13.6001 6.28003 13.5601C6.48003 13.5501 6.69003 13.56 6.88003 13.57C7.73003 13.68 8.56003 14.0701 9.24003 14.7601C9.91003 15.4301 10.29 16.21 10.4 17.05C10.41 17.24 10.43 17.4301 10.43 17.6201Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14.24 14.47C14.24 11.86 12.12 9.73999 9.51001 9.73999"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

interface ExtendedCatalogItem {
  id: string;
  name: string;
  price: number;
  image?: string;
  category?: string;
  description?: string;
  sizes?: string[];
  colors?: string[];
  fashionHouse?: {
    id: string;
    name: string;
  };
}

export default function ProductDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id: string;
    initialName?: string;
    initialPrice?: string;
    initialImage?: string;
    initialVendorName?: string;
    initialFashionHouseId?: string;
    badge?: string;
    categoryTag?: string;
  }>();

  const [item, setItem] = useState<ExtendedCatalogItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSize, setSelectedSize] = useState<string>('l');
  const [selectedColor, setSelectedColor] = useState<string>('#434164');
  const [quantity, setQuantity] = useState<number>(1);
  const [isLiked, setIsLiked] = useState(false);

  const addItemToCart = useCartStore((state) => state.addItem);

  const name = item?.name || params.initialName || 'Aso-Ebi';
  const rawPrice = item?.price ?? (params.initialPrice ? parseFloat(params.initialPrice) : 380000);
  const price = rawPrice > 0 ? rawPrice : 380000;
  const image = item?.image || params.initialImage || 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800';
  const vendorName = item?.fashionHouse?.name || params.initialVendorName || 'The Threadly Nest';
  const fashionHouseId = item?.fashionHouse?.id || params.initialFashionHouseId || '';

  useEffect(() => {
    async function loadItemDetails() {
      if (!params.id) {
        setLoading(false);
        return;
      }
      try {
        const data = await apiFetch<ExtendedCatalogItem>(`/api/catalog/item/${params.id}`);
        if (data) {
          setItem(data);
          if (data.sizes && data.sizes.length > 0) {
            setSelectedSize(data.sizes[0].toLowerCase());
          }
          if (data.colors && data.colors.length > 0) {
            setSelectedColor(data.colors[0]);
          }
        }
      } catch (err) {
        // Fall back to parameter defaults
      } finally {
        setLoading(false);
      }
    }
    loadItemDetails();
  }, [params.id]);

  const availableSizes =
    item?.sizes && item.sizes.length > 0
      ? item.sizes.map((s) => s.toLowerCase())
      : ['s', 'm', 'l', 'xl'];

  const availableColors =
    item?.colors && item.colors.length > 0
      ? item.colors
      : ['#434164', '#1E6527', '#000000'];

  const descriptionText =
    item?.description ||
    'Experience refined elegance with our bespoke handcrafted garment. Engineered with premium fabrics, precise darting, and meticulous hand-stitching to deliver an unmatched silhouette.';

  const handleAddToCart = () => {
    addItemToCart(
      {
        id: params.id || 'custom-item',
        name,
        price,
        image,
        vendorName,
        fashionHouseId,
        selectedSize,
        selectedColor,
      },
      quantity
    );

    Alert.alert(
      'Added to Cart',
      `${name} (${selectedSize.toUpperCase()}, ${quantity}x) has been added to your shopping cart.`,
      [
        { text: 'Continue Shopping', style: 'cancel' },
        { text: 'View Cart', onPress: () => router.push('/(customer)/(tabs)/orders') },
      ]
    );
  };

  const handleCustomOrder = () => {
    if (fashionHouseId) {
      router.push(`/(customer)/chat/${fashionHouseId}` as const);
    } else {
      Alert.alert('Fashion House', 'Fashion House details unavailable for direct customization chat.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F6F0" />

      {/* Header Bar */}
      <View style={[styles.header, { paddingTop: 36 }]}>
        <View style={styles.headerLeftGroup}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#1A1110" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Details</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 16) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Fashion House Name Above Image */}
        <Text style={styles.fashionHouseTopName}>{vendorName.toUpperCase()}</Text>

        {/* Main Product Image Container */}
        <View style={styles.imageCard}>
          <Image source={{ uri: image }} style={styles.productImage} resizeMode="cover" />
        </View>

        {/* Carousel Dots Indicator Below Image */}
        <View style={styles.dotsBelowImage}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>

        {/* Description Section */}
        <View style={styles.section}>
          <Text style={styles.descriptionHeader}>DESCRIPTION</Text>
          <Text style={styles.descriptionBody}>{descriptionText}</Text>
        </View>

        {/* Title, Price & Heart Row */}
        <View style={styles.titlePriceRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.productName}>{name}</Text>
            <Text style={styles.priceText}>₦{price.toLocaleString()}</Text>
          </View>
          <TouchableOpacity onPress={() => setIsLiked(!isLiked)} style={styles.heartBtn}>
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={24}
              color={isLiked ? '#4A080C' : '#1A1110'}
            />
          </TouchableOpacity>
        </View>

        {/* Side-by-Side Options: Select Size & Select Color */}
        <View style={styles.optionsRow}>
          {/* Select Size Column */}
          <View style={styles.optionColumn}>
            <Text style={styles.optionLabel}>Select size</Text>
            <View style={styles.pillsRow}>
              {availableSizes.map((size) => {
                const isSelected = selectedSize === size;
                return (
                  <TouchableOpacity
                    key={size}
                    style={[styles.sizePill, isSelected && styles.sizePillSelected]}
                    onPress={() => setSelectedSize(size)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.sizePillText, isSelected && styles.sizePillTextSelected]}>
                      {size}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Select Color Column */}
          <View style={styles.optionColumn}>
            <Text style={styles.optionLabel}>Select color</Text>
            <View style={styles.pillsRow}>
              {availableColors.map((colorHex) => {
                const isSelected = selectedColor === colorHex;
                return (
                  <TouchableOpacity
                    key={colorHex}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: colorHex },
                      isSelected && styles.colorSwatchSelected,
                    ]}
                    onPress={() => setSelectedColor(colorHex)}
                    activeOpacity={0.8}
                  />
                );
              })}
            </View>
          </View>
        </View>

        {/* Quantity Section */}
        <View style={styles.quantitySection}>
          <Text style={styles.optionLabel}>Quantity</Text>
          <View style={styles.quantityCapsule}>
            <TouchableOpacity
              style={styles.qtyBox}
              onPress={() => setQuantity((q) => Math.max(1, q - 1))}
            >
              <Text style={styles.qtyBoxSign}>-</Text>
            </TouchableOpacity>
            <Text style={styles.qtyValue}>{quantity}</Text>
            <TouchableOpacity
              style={styles.qtyBox}
              onPress={() => setQuantity((q) => q + 1)}
            >
              <Text style={styles.qtyBoxSign}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Action Buttons: Add to cart & Custom */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleAddToCart}
            activeOpacity={0.85}
          >
            <Ionicons name="cart-outline" size={20} color="#FFFFFF" style={styles.btnIcon} />
            <Text style={styles.actionBtnText}>Add to cart</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleCustomOrder}
            activeOpacity={0.85}
          >
            <CustomBrushIcon width={22} height={22} color="#FFFFFF" />
            <Text style={styles.actionBtnText}>Custom</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F6F0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: '#F8F6F0',
  },
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Fraunces-SemiBold',
    color: '#1A1110',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFECE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  fashionHouseTopName: {
    fontFamily: 'WorkSans_600SemiBold',
    fontSize: 12,
    color: '#4A080C',
    letterSpacing: 1,
    marginTop: 12,
    marginBottom: 12,
  },
  imageCard: {
    width: '100%',
    height: 380,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#E5E2DA',
    position: 'relative',
    marginBottom: 24,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  badgeTag: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: '#4A080C',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dotsBelowImage: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
    marginTop: -8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#C4BFC0',
  },
  dotActive: {
    width: 40,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4A080C',
  },
  titlePriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  productName: {
    fontFamily: 'Fraunces-Regular',
    fontSize: 14,
    color: '#1A1110',
    marginBottom: 4,
  },
  priceText: {
    fontFamily: 'Fraunces-SemiBold',
    fontSize: 16,
    color: '#1A1110',
  },
  heartBtn: {
    paddingTop: 4,
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  optionColumn: {
    // Fits neatly within screen bounds
  },
  optionLabel: {
    fontFamily: 'WorkSans_500Medium',
    fontSize: 14,
    color: '#1A1110',
    marginBottom: 12,
  },
  pillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    gap: 8,
  },
  sizePill: {
    width: 38,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#E5E2DA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizePillSelected: {
    backgroundColor: '#4A080C',
  },
  sizePillText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1A1110',
  },
  sizePillTextSelected: {
    color: '#FFFFFF',
  },
  colorSwatch: {
    width: 38,
    height: 36,
    borderRadius: 10,
  },
  colorSwatchSelected: {
    borderWidth: 2,
    borderColor: '#4A080C',
  },
  quantitySection: {
    marginBottom: 56,
  },
  quantityCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    backgroundColor: '#E5E2DA',
    borderRadius: 12,
    padding: 4,
    alignSelf: 'flex-start',
  },
  qtyBox: {
    width: 38,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBoxSign: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1110',
  },
  qtyValue: {
    width: 34,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1110',
  },
  section: {
    marginTop: 8,
    marginBottom: 24,
  },
  descriptionHeader: {
    fontFamily: 'WorkSans_500Medium',
    fontSize: 14,
    color: '#4A080C',
    marginBottom: 8,
  },
  descriptionBody: {
    fontFamily: 'WorkSans_400Regular',
    fontSize: 12,
    lineHeight: 24,
    color: '#554E4A',
    textAlign: 'justify',
    minHeight: 76,
    maxWidth: 376,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 0,
    marginBottom: 12,
  },
  actionBtn: {
    flex: 1,
    height: 52,
    backgroundColor: '#4A080C',
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'WorkSans_600SemiBold',
    marginLeft: 6,
  },
  btnIcon: {
    marginRight: 2,
  },
});

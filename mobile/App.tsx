import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Asset } from 'expo-asset';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ImageBackground,
  Modal,
  NativeModules,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
  BackHandler,
  Linking,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { formatCurrency, getOrderImageUrls } from './utils';

const getBackendCandidates = () => {
  const scriptURL = NativeModules.SourceCode?.scriptURL as string | undefined;
  const hosts = new Set<string>();

  if (scriptURL) {
    const match = scriptURL.match(/https?:\/\/([^:/]+)(?::\d+)?/);
    if (match) {
      hosts.add(match[1]);
    }
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.hostname) {
    hosts.add(window.location.hostname);
  }

  if (Platform.OS === 'android') {
    hosts.add('10.0.2.2');
  }
  if (Platform.OS === 'ios') {
    hosts.add('127.0.0.1');
  }

  hosts.add('127.0.0.1');
  hosts.add('localhost');

  return Array.from(hosts).filter(Boolean);
};

const getRailwayApiBaseUrl = (): string | null => {
  const manifestExtra = (Constants as any).expoConfig?.extra ?? (Constants as any).manifest?.extra ?? (Constants as any).manifest2?.extra;
  const extras = manifestExtra as Record<string, unknown> | undefined;
  const raw = extras?.apiBaseUrl || process.env.EXPO_PUBLIC_API_BASE_URL || process.env.API_BASE_URL;
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed || null;
};

// Force the Railway backend URL as a fallback so the app always targets it.
const RAILWAY_API_BASE_URL = getRailwayApiBaseUrl() || 'https://backends-production-3d0b.up.railway.app';
const API_BASE_URLS = [
  ...(RAILWAY_API_BASE_URL ? [RAILWAY_API_BASE_URL] : []),
  ...getBackendCandidates().map((host) => `http://${host}:8000`),
];
const buildUrl = (path: string, baseUrl?: string) => `${baseUrl || API_BASE_URLS[0] || 'http://127.0.0.1:8000'}${path}`;
const CART_STORAGE_KEY = '@glow-cart-v1';
const AUTH_TOKEN_STORAGE_KEY = '@glow-auth-token-v1';
const PRODUCTS_STORAGE_KEY = '@glow-products-v1';
const DISCOVER_MORE_PRODUCT_LIMIT = 100;
// No stock fallback image: show a neutral placeholder when backend image missing.
const SPLASH_LOGO_URL = 'https://res.cloudinary.com/h78tlu47/image/upload/v1784708343/icon_sotujz.jpg';

const matchesProductSearch = (product: any, query: string) => {
  const normalizedQuery = (query || '').trim().toLowerCase();
  if (!normalizedQuery) return true;

  const searchableText = [
    product?.product_name,
    product?.name,
    product?.description,
    product?.category_name,
    product?.category?.category_name,
    product?.brand_name,
    product?.brand?.brand_name,
    product?.sku,
    product?.tags,
    product?.short_description,
  ]
    .filter((value) => typeof value === 'string' && value.trim())
    .join(' ')
    .toLowerCase();

  return searchableText.includes(normalizedQuery);
};

const matchesOrderSearch = (order: any, query: string) => {
  const normalizedQuery = (query || '').trim().toLowerCase();
  if (!normalizedQuery) return true;

  const searchableText = [
    order?.order_number,
    order?.salon_name,
    order?.business_name,
    order?.customer_name,
    order?.customer?.full_name,
    order?.delivery_address,
    order?.address,
    order?.shipping_address,
    order?.location,
  ]
    .filter((value) => typeof value === 'string' && value.trim())
    .join(' ')
    .toLowerCase();

  return searchableText.includes(normalizedQuery) || String(order?.order_number || '').toLowerCase().includes(normalizedQuery);
};
const SPLASH_DELIVERY_IMAGE_URL = 'https://res.cloudinary.com/h78tlu47/image/upload/v1784708354/glow-logo-navy-bg_tzzdwd.jpg';
const SIDEBAR_PERSIST_KEY = '@glow-show-sidebar-v1';

// Ensure React Native Image defaults to contain so images are shown in full
try {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  if (Image) {
    // @ts-ignore
    Image.defaultProps = Image.defaultProps || {};
    // @ts-ignore
    Image.defaultProps.resizeMode = Image.defaultProps.resizeMode || 'contain';
  }
} catch (e) {
  // ignore
}

// Uganda has over 71,000 villages. The district picker includes all 146
// districts/cities; the area picker offers useful suggestions and also accepts
// the customer's exact village, trading centre, or neighbourhood.
const UGANDA_DISTRICTS = [
  'Abim', 'Adjumani', 'Agago', 'Alebtong', 'Amolatar', 'Amudat', 'Amuria', 'Amuru', 'Apac', 'Arua', 'Arua City', 'Budaka', 'Bududa', 'Buhweju', 'Buikwe', 'Bukedea', 'Bukomansimbi', 'Bukwo', 'Bulambuli', 'Bulisa', 'Bundibugyo', 'Bunyangabu', 'Bushenyi', 'Busia', 'Butaleja', 'Butambala', 'Butebo', 'Buvuma', 'Buyende', 'Bugiri', 'Bugweri', 'Dokolo', 'Fort Portal City', 'Gomba', 'Gulu', 'Gulu City', 'Hoima', 'Hoima City', 'Ibanda', 'Iganga', 'Isingiro', 'Jinja', 'Jinja City', 'Kaabong', 'Kabale', 'Kabarole', 'Kaberamaido', 'Kagadi', 'Kakumiro', 'Kalaki', 'Kalangala', 'Kaliro', 'Kalungu', 'Kamuli', 'Kamwenge', 'Kanungu', 'Kapchorwa', 'Kapelebyong', 'Karenga', 'Kasese', 'Kassanda', 'Katakwi', 'Kayunga', 'Kazo', 'Kibale', 'Kiboga', 'Kibuku', 'Kikuube', 'Kiruhura', 'Kiryandongo', 'Kisoro', 'Kitagwenda', 'Kitgum', 'Koboko', 'Kole', 'Kotido', 'Kumi', 'Kwania', 'Kween', 'Kyankwanzi', 'Kyegegwa', 'Kyenjojo', 'Kyotera', 'Lamwo', 'Lira', 'Lira City', 'Luuka', 'Luwero', 'Lwengo', 'Lyantonde', 'Madi Okollo', 'Manafwa', 'Maracha', 'Masaka', 'Masaka City', 'Masindi', 'Mayuge', 'Mbale', 'Mbale City', 'Mbarara', 'Mbarara City', 'Mitooma', 'Mityana', 'Moroto', 'Moyo', 'Mpigi', 'Mubende', 'Mukono', 'Nabilatuk', 'Nakapiripirit', 'Nakaseke', 'Nakasongola', 'Namayingo', 'Namisindwa', 'Namutumba', 'Napak', 'Nebbi', 'Ngora', 'Ntoroko', 'Ntungamo', 'Nwoya', 'Obongi', 'Omoro', 'Otuke', 'Oyam', 'Pader', 'Pakwach', 'Pallisa', 'Rakai', 'Rubanda', 'Rubirizi', 'Rukiga', 'Rukungiri', 'Rwampara', 'Serere', 'Sheema', 'Sironko', 'Soroti', 'Soroti City', 'Ssembabule', 'Terego', 'Tororo', 'Wakiso', 'Yumbe', 'Zombo', 'Kampala',
].sort();

const DELIVERY_AREA_SUGGESTIONS: Record<string, string[]> = {
  Kampala: ['Bugolobi', 'Bukoto', 'Bunga', 'Kawempe', 'Kibuli', 'Kisementi', 'Kololo', 'Makindye', 'Makerere', 'Ntinda', 'Rubaga', 'Muyenga'],
  Wakiso: ['Entebbe', 'Kira', 'Kisasi', 'Kyanja', 'Najjanankumbi', 'Nansana', 'Namugongo', 'Ssonde'],
  Mukono: ['Mukono Central', 'Nakifuma', 'Seeta'],
  Jinja: ['Bugembe', 'Jinja Central', 'Mpumudde', 'Walukuba'],
  Mbarara: ['Biharwe', 'Kakoba', 'Mbarara City', 'Nyamitanga'],
  Gulu: ['Awach', 'Gulu City', 'Layibi', 'Pece'],
  Mbale: ['Industrial Division', 'Mbale City', 'Nakhaloke', 'Northern Division'],
  Masaka: ['Bukakata', 'Kimaanya', 'Masaka City', 'Nyendo'],
  Arua: ['Arua City', 'Mvara', 'Oli', 'River Oli'],
  Lira: ['Adyel', 'Lira City', 'Ojwina', 'Railway Division'],
};

const formatDeliveryLocation = (district: string, village: string) => district && village ? `${village}, ${district}` : '';

const parseDeliveryLocationParts = (value: string) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return { district: '', village: '' };

  const segments = trimmed
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length >= 2) {
    return {
      village: segments[0],
      district: segments[segments.length - 1],
    };
  }

  return { district: segments[0] || '', village: '' };
};

const normalizeAddressEntry = (entry: any, fallbackIndex = 0, fallbackId = `addr-${fallbackIndex}`) => {
  const rawAddress = entry?.address || entry?.line || entry?.location || entry?.street || '';
  const parsedFromAddress = parseDeliveryLocationParts(rawAddress);
  const district = entry?.district || entry?.region || parsedFromAddress.district || '';
  const village = entry?.village || entry?.city || entry?.area || entry?.neighbourhood || parsedFromAddress.village || '';
  const address = rawAddress || formatDeliveryLocation(district, village);
  return {
    id: entry?.id ?? entry?.address_id ?? entry?.pk ?? entry?._id ?? `addr-${fallbackId}`,
    label: entry?.label || entry?.name || 'Address',
    address,
    district,
    village,
    phone: entry?.phone || entry?.phone_number || '',
    isDefault: Boolean(entry?.is_default || entry?.default || fallbackIndex === 0),
  };
};

const deriveSavedAddressesFromProfile = (profileData: any) => {
  const serverAddresses = Array.isArray(profileData?.addresses)
    ? profileData.addresses
    : Array.isArray(profileData?.saved_addresses)
      ? profileData.saved_addresses
      : Array.isArray(profileData?.address_list)
        ? profileData.address_list
        : [];

  if (Array.isArray(serverAddresses) && serverAddresses.length) {
    return serverAddresses.map((entry: any, index: number) => normalizeAddressEntry(entry, index, `${index}`));
  }

  const directProfileAddress = profileData?.address || profileData?.delivery_address || profileData?.primary_address || profileData?.location || '';
  const parsedFromAddress = parseDeliveryLocationParts(directProfileAddress);
  const district = profileData?.district || profileData?.state || parsedFromAddress.district || '';
  const village = profileData?.village || profileData?.city || profileData?.area || profileData?.neighbourhood || parsedFromAddress.village || '';

  if (district || village || directProfileAddress) {
    return [{
      id: profileData?.id ? `profile-${profileData.id}` : `profile-${Date.now()}`,
      label: 'Primary',
      address: directProfileAddress || formatDeliveryLocation(district, village),
      district,
      village,
      phone: profileData?.phone_number || profileData?.phone || '',
      isDefault: true,
    }];
  }

  return [];
};

const DeliveryLocationSelector = ({
  district,
  village,
  onDistrictChange,
  onVillageChange,
}: {
  district: string;
  village: string;
  onDistrictChange: (value: string) => void;
  onVillageChange: (value: string) => void;
}) => {
  const [menu, setMenu] = useState<'district' | 'village' | null>(null);
  const [search, setSearch] = useState('');
  const isDistrictMenu = menu === 'district';
  const choices = (isDistrictMenu ? UGANDA_DISTRICTS : (DELIVERY_AREA_SUGGESTIONS[district] || []))
    .filter((choice) => choice.toLowerCase().includes(search.trim().toLowerCase()));
  const openMenu = (nextMenu: 'district' | 'village') => {
    setSearch(nextMenu === 'village' ? village : '');
    setMenu(nextMenu);
  };

  return (
    <View>
      <Text style={styles.locationLabel}>District</Text>
      <TouchableOpacity style={styles.locationSelect} onPress={() => openMenu('district')} accessibilityRole="button">
        <Text style={district ? styles.locationSelectValue : styles.locationSelectPlaceholder}>{district || 'Select district'}</Text>
        <Text style={styles.locationSelectArrow}>⌄</Text>
      </TouchableOpacity>
      <Text style={styles.locationLabel}>Village / area</Text>
      <TouchableOpacity style={[styles.locationSelect, !district && styles.locationSelectDisabled]} onPress={() => district && openMenu('village')} disabled={!district} accessibilityRole="button">
        <Text style={village ? styles.locationSelectValue : styles.locationSelectPlaceholder}>{village || 'Select village or area'}</Text>
        <Text style={styles.locationSelectArrow}>⌄</Text>
      </TouchableOpacity>
      <Modal visible={menu !== null} transparent animationType="fade" onRequestClose={() => setMenu(null)}>
        <View style={styles.locationModalOverlay}>
          <View style={styles.locationModalCard}>
            <Text style={styles.locationModalTitle}>Select {menu === 'district' ? 'district' : 'village or area'}</Text>
            <TextInput
              style={styles.locationSearchInput}
              value={search}
              onChangeText={setSearch}
              placeholder={menu === 'district' ? 'Search all Uganda districts' : 'Search or type your village / area'}
              placeholderTextColor="#94A3B8"
              autoFocus
            />
            <ScrollView style={styles.locationOptions}>
              {menu === 'village' && search.trim() && !choices.some((choice) => choice.toLowerCase() === search.trim().toLowerCase()) ? (
                <TouchableOpacity style={styles.locationOption} onPress={() => {
                  onVillageChange(search.trim());
                  setMenu(null);
                }}>
                  <Text style={styles.locationOptionText}>Use “{search.trim()}”</Text>
                </TouchableOpacity>
              ) : null}
              {choices.map((choice) => (
                <TouchableOpacity key={choice} style={styles.locationOption} onPress={() => {
                  if (menu === 'district') {
                    onDistrictChange(choice);
                    onVillageChange('');
                  } else {
                    onVillageChange(choice);
                  }
                  setMenu(null);
                }}>
                  <Text style={styles.locationOptionText}>{choice}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setMenu(null)}><Text style={styles.secondaryButtonText}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const CatalogImage = ({ uri, style }: { uri: string; style: any }) => {
  const [failedToLoad, setFailedToLoad] = useState(false);
  const safeUri = typeof uri === 'string' && uri.trim() ? uri.trim() : '';

  useEffect(() => {
    setFailedToLoad(false);
  }, [uri]);

  // Aggressively warm the native asset cache for visible images so they
  // render faster when the user navigates to detail screens.
  useEffect(() => {
    if (!safeUri) return;
    try {
      if (globalPrefetchedImagesCache.has(safeUri)) return;
    } catch (e) {
      // ignore if cache not yet defined
    }

    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        await Asset.fromURI(safeUri).downloadAsync();
        try {
          globalPrefetchedImagesCache.add(safeUri);
        } catch (e) {}
      } catch (err) {
        try {
          await Image.prefetch(safeUri);
          try {
            globalPrefetchedImagesCache.add(safeUri);
          } catch (e) {}
        } catch (_) {
          // ignore
        }
      }
    })();
  }, [safeUri]);

  if (!safeUri || failedToLoad) {
    return <View style={[style, styles.productPlaceholder]} />;
  }

  return (
    <Image
      source={{ uri: safeUri }}
      style={style}
      resizeMode="contain"
      onError={() => setFailedToLoad(true)}
    />
  );
};

const OrderItemCard = React.memo(({ item, onView, onRetry }: { item: any; onView: (id: number) => void; onRetry: (item: any) => void }) => {
  const status = item.order_status || 'Pending';
  const orderDate = item.created_at ? new Date(item.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Pending';
  const orderImages = getOrderImageUrls(item);
  const visibleImages = orderImages.slice(0, 3);
  const itemCount = Array.isArray(item.items) ? item.items.length : Number(item.item_count || 0);
  const salonName = item.salon_name || item.business_name || item.salonName || item.customer?.salon_name || item.customer?.business_name || 'Salon order';
  const deliveryAddress = item.delivery_address || item.address || item.shipping_address || item.deliveryAddress || item.location || item.customer_address || 'Delivery address pending';

  return (
    <View style={styles.orderCard}>
      <View style={styles.orderCardHeader}>
        <View style={styles.orderCardHeaderLeft}>
          <Text style={styles.orderNumber}>Order #{item.order_number || item.id}</Text>
          <Text style={styles.orderDate}>{orderDate}</Text>
          <Text style={styles.orderDate}>{salonName}</Text>
          <Text style={styles.orderDate}>{deliveryAddress}</Text>
        </View>
        <View style={[styles.statusBadge, getOrderStatusStyle(status)]}>
          <Text style={styles.statusBadgeText}>{status}</Text>
        </View>
      </View>

      <View style={styles.thumbnailRow}>
        {visibleImages.length ? visibleImages.map((imageUrl, index) => (
          <CatalogImage key={`${item.id}-${index}`} uri={imageUrl} style={styles.thumbImage} />
        )) : (
          <><View style={styles.thumbBox} /><View style={styles.thumbBox} /><View style={styles.thumbBox} /></>
        )}
        {orderImages.length > 3 ? (
          <View style={styles.moreThumbBadge}>
            <Text style={styles.moreThumbText}>+{orderImages.length - 3}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.orderSummaryRow}>
        <Text style={styles.orderItemCount}>{itemCount} item{itemCount === 1 ? '' : 's'}</Text>
        <Text style={styles.orderTotalAmount}>{formatCurrency(item.total_amount ?? item.total ?? 0)}</Text>
      </View>

      {item._local ? (
        <View style={styles.orderTagRow}>
          <Text style={styles.orderLocalTag}>{item._error ? 'Sync failed' : 'Awaiting confirmation'}</Text>
        </View>
      ) : null}

      <View style={styles.orderActionsRow}>
        <TouchableOpacity style={styles.viewButton} onPress={() => onView(item.id)}>
          <Text style={styles.viewButtonText}>View details</Text>
        </TouchableOpacity>
        {item._error ? (
          <TouchableOpacity style={styles.retryButton} onPress={() => onRetry(item)}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
});

const normalizeOrderValue = (value: any) => {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') {
    const nested = value.name || value.title || value.label || value.salon_name || value.business_name || value.address || value.delivery_address || value.customer_name || '';
    return typeof nested === 'string' ? nested.trim() : String(nested).trim();
  }
  return String(value).trim();
};

const normalizeOrdersPayload = (payload: any) => {
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.results)
      ? payload.results
      : Array.isArray(payload?.orders)
        ? payload.orders
        : Array.isArray(payload?.data)
          ? payload.data
          : [];

  return items.map((order: any) => {
    const normalizedOrder = { ...order };
    const customer = order?.customer || {};
    const user = order?.user || {};
    const salonName = normalizeOrderValue(
      order?.salon_name
      || order?.salonName
      || order?.business_name
      || order?.business_name
      || order?.seller_name
      || order?.shop_name
      || customer?.salon_name
      || customer?.business_name
      || customer?.shop_name
      || user?.salon_name
      || user?.business_name
      || user?.shop_name
      || order?.customer_name
      || customer?.name
      || user?.name
      || user?.full_name
    );
    const deliveryAddress = normalizeOrderValue(
      order?.delivery_address
      || order?.deliveryAddress
      || order?.shipping_address
      || order?.address
      || order?.customer_address
      || order?.location
      || customer?.address
      || customer?.delivery_address
      || customer?.location
      || user?.address
      || user?.delivery_address
    );

    normalizedOrder.salon_name = salonName;
    normalizedOrder.business_name = salonName || normalizedOrder.business_name || '';
    normalizedOrder.delivery_address = deliveryAddress;
    normalizedOrder.address = deliveryAddress || normalizedOrder.address || '';
    normalizedOrder.customer_name = normalizeOrderValue(order?.customer_name || customer?.name || user?.name || user?.full_name || normalizedOrder.customer_name);

    return normalizedOrder;
  });
};

const getCategoryTextValue = (value: any) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    return [value.category_name, value.name, value.title, value.label, value.slug]
      .filter(Boolean)
      .join(' ');
  }
  return String(value);
};

function deduplicateItems(items: any[], getKey: (item: any) => string): any[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item);
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

const normalizeCategoriesPayload = (payload: any) => {
  const items = Array.isArray(payload) ? payload : [];
  return deduplicateItems(items, (item) => {
    const id = item?.id ?? item?.category_id ?? '';
    const name = item?.category_name || item?.name || '';
    return [id, name].filter(Boolean).join('::');
  });
};

const normalizeBrandsPayload = (payload: any) => {
  const items = Array.isArray(payload) ? payload : [];
  return deduplicateItems(items, (item) => {
    const id = item?.id ?? item?.brand_id ?? '';
    const name = item?.brand_name || item?.name || '';
    return [id, name].filter(Boolean).join('::');
  });
};

const getCollectionPayload = (payload: any, key?: string): any[] => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];

  const candidates = [
    payload.results,
    key ? payload[key] : undefined,
    payload.data,
    payload.data?.results,
    key ? payload.data?.[key] : undefined,
  ];

  return candidates.find(Array.isArray) || [];
};

const getBrandsFromProducts = (products: any[]) => normalizeBrandsPayload(products.map((product) => ({
  id: product?.brand_id ?? product?.brand?.id,
  brand_id: product?.brand_id ?? product?.brand?.id,
  brand_name: product?.brand_name ?? product?.brand?.brand_name ?? product?.brand?.name,
  name: product?.brand_name ?? product?.brand?.brand_name ?? product?.brand?.name,
})).filter((brand) => brand.brand_name || brand.name));

const normalizeProductsPayload = (payload: any) => {
  const items = Array.isArray(payload) ? payload : [];
  return deduplicateItems(items, (item) => {
    const id = item?.id ?? item?.product_id ?? item?.sku ?? '';
    const name = item?.product_name || item?.name || '';
    return [id, name, item?.sku].filter(Boolean).join('::');
  });
};

const getListItemKey = (item: any, index: number, prefix = 'item') => {
  const candidate = item?.id ?? item?.product_id ?? item?.order_id ?? item?.order_number ?? item?.sku ?? item?.slug ?? item?.route ?? item?.title ?? item?.name ?? item?.product_name ?? item?.label ?? item?.address ?? item?.image_url;
  const normalized = candidate !== undefined && candidate !== null && candidate !== '' ? String(candidate) : '';
  if (normalized) {
    return `${prefix}-${index}-${normalized}`;
  }
  return `${prefix}-${index}`;
};

const getProductCategoryMatchText = (product: any) => {
  const candidates = [
    product?.category_name,
    product?.category?.category_name,
    product?.category?.name,
    product?.category?.title,
    product?.category?.label,
    product?.category,
    product?.category_id,
  ];

  return candidates.map(getCategoryTextValue).filter(Boolean).join(' ').toLowerCase();
};

const getProductBrandMatchText = (product: any) => {
  const candidates = [
    product?.brand_name,
    product?.brand?.brand_name,
    product?.brand?.name,
    product?.brand?.title,
    product?.brand,
    product?.brand_id,
  ];

  return candidates.map(getCategoryTextValue).filter(Boolean).join(' ').toLowerCase();
};

const getProductRelationIds = (product: any, relation: 'category' | 'brand') => {
  const value = product?.[relation];
  return [
    product?.[`${relation}_id`],
    product?.[`${relation}Id`],
    value?.id,
    value?.[`${relation}_id`],
  ]
    .filter((id) => id !== undefined && id !== null && id !== '')
    .map(String);
};

const getProductStockQuantity = (product: any) => {
  const candidates = [
    product?.quantity_in_stock,
    product?.stock,
    product?.available_quantity,
    product?.stock_quantity,
    product?.inventory_count,
    product?.stock_count,
    product?.available_stock,
  ];

  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value)) return value;
  }
  return null;
};

const isProductOutOfStock = (product: any) => {
  const status = String(product?.status || '').trim().toLowerCase();
  const quantity = getProductStockQuantity(product);
  return status === 'out of stock' || (quantity !== null && quantity <= 0);
};

const getApiErrorMessage = (data: any, fallback: string) => {
  if (!data || typeof data !== 'object') return fallback;
  if (typeof data.detail === 'string') return data.detail;
  if (typeof data.error === 'string') return data.error;

  for (const value of Object.values(data)) {
    if (typeof value === 'string') return value;
    if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  }
  return fallback;
};

const productMatchesCatalogItem = (product: any, item: any, relation: 'category' | 'brand') => {
  const itemId = item?.id ?? item?.[`${relation}_id`] ?? item?.[`${relation}Id`];
  const itemName = (item?.category_name || item?.brand_name || getCategoryTextValue(item)).trim().toLowerCase();
  const productRelationIds = getProductRelationIds(product, relation);

  if (itemId !== undefined && itemId !== null && itemId !== '' && productRelationIds.includes(String(itemId))) {
    return true;
  }

  const productRelationText = relation === 'brand'
    ? getProductBrandMatchText(product)
    : getProductCategoryMatchText(product);

  return Boolean(
    itemName
      && productRelationText
      && (productRelationText.includes(itemName) || itemName.includes(productRelationText)),
  );
};

const normalizeImageUrl = (value: any, fallback: string): string => {
  if (value === null || value === undefined || value === false) return fallback;

  if (typeof value === 'object') {
    const nested = value.url || value.image_url || value.src || value.uri || value.href || value.path;
    return nested ? normalizeImageUrl(nested, fallback) : fallback;
  }

  const raw = String(value).trim();
  if (!raw || raw === 'null' || raw === 'undefined') return fallback;

  const safeBase = API_BASE_URLS[0] || 'http://127.0.0.1:8000';
  if (raw.startsWith('/')) {
    return `${safeBase}${raw}`;
  }

  if (!/^https?:\/\//i.test(raw)) {
    return `${safeBase}/${raw.replace(/^\/+/, '')}`;
  }

  try {
    const parsed = new URL(raw);
    if ((parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') && Platform.OS === 'android') {
      const rewritten = new URL(parsed.toString());
      (rewritten as any).hostname = '10.0.2.2';
      return rewritten.toString();
    }
    return parsed.toString();
  } catch {
    return fallback;
  }
};

const collectImageCandidates = (value: any): string[] => {
  if (value === null || value === undefined || value === false) return [];
  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectImageCandidates(entry));
  }
  if (typeof value === 'object') {
    const nested = [
      value.url,
      value.image_url,
      value.imageUrl,
      value.src,
      value.uri,
      value.href,
      value.path,
      value.image,
      value.product_image,
    ];
    return nested.flatMap((entry) => collectImageCandidates(entry));
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  return [];
};

const getProductImageUrls = (product: any): string[] => {
  if (!product) return [];

  const values = [
    product.image_url,
    product.image_url_2,
    product.image_url_3,
    product.image_url_4,
    product.image,
    product.product_image,
    product.productImage,
    product.gallery,
    product.images,
    product.image_urls,
    product.images_url,
    product.photo,
    product.photo_url,
    product.thumbnail,
    product.thumbnail_url,
  ].flatMap((entry) => collectImageCandidates(entry));

  const seen = new Set<string>();
  const urls = values
    .map((value) => normalizeImageUrl(value, ''))
    .filter((url) => Boolean(url) && !seen.has(url) && Boolean(seen.add(url)));

  if (urls.length) return urls.slice(0, 4);

  const category = getProductCategoryMatchText(product);
  if (/(nail|makeup|beauty|cosmetic)/.test(category)) {
    return ['https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=600&q=75'];
  }
  if (/(tool|clipper|scissor|barber|brush|comb)/.test(category)) {
    return ['https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=600&q=75'];
  }
  return [];
};
// Prefetch product image URLs with a concurrency limit. Uses expo-asset when available.
// Use a module-level fallback cache when called before component initialization.
const globalPrefetchedImagesCache: Set<string> = new Set();

const prefetchProductImages = async (
  products: any[],
  options: { concurrency?: number; totalLimit?: number } = { concurrency: 4, totalLimit: 60 },
  cacheRef?: { current: Set<string> } | Set<string>
) => {
  const concurrency = options.concurrency ?? 4;
  const totalLimit = options.totalLimit ?? 60;
  const urls: string[] = [];
  for (const p of products) {
    const img = getProductImageUrls(p)[0];
    if (img && typeof img === 'string') urls.push(img);
    if (urls.length >= totalLimit) break;
  }

  const unique = Array.from(new Set(urls)).filter(Boolean);
  // simple concurrency-controlled worker
  let i = 0;
  const workers: Promise<void>[] = [];
  const cache: Set<string> = cacheRef && (cacheRef as any).current ? (cacheRef as any).current : (cacheRef instanceof Set ? cacheRef : globalPrefetchedImagesCache);

  const runOne = async () => {
    while (true) {
      const idx = i++;
      if (idx >= unique.length) return;
      const url = unique[idx];
      if (!url || cache.has(url)) continue;
      try {
        // try expo Asset first
        try {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          await Asset.fromURI(url).downloadAsync();
        } catch (e) {
          // fallback to Image.prefetch
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          await Image.prefetch(url);
        }
        cache.add(url);
      } catch (err) {
        // ignore individual failures
      }
    }
  };

  for (let w = 0; w < concurrency; w++) workers.push(runOne());
  await Promise.all(workers);
};


const getCategoryIconVisual = (categoryName: string) => {
  const normalized = (categoryName || '').toLowerCase();

  if (/(shampoo|conditioner|treatment|serum|hair|care|oil)/.test(normalized)) {
    return { imageUrl: 'https://images.unsplash.com/photo-1527799820379-db61410e8c2e?auto=format&fit=crop&w=200&q=80', color: '#1B2A4A', bgColor: '#EAF0FF' };
  }
  if (/(nail|manicure|pedicure|cosmetic|makeup|beauty)/.test(normalized)) {
    return { imageUrl: 'https://images.unsplash.com/photo-1608248597279-f99d160bfbc8?auto=format&fit=crop&w=200&q=80', color: '#A23C79', bgColor: '#FCE7F3' };
  }
  if (/(skin|face|cream|mask|cleanser|serum)/.test(normalized)) {
    return { imageUrl: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=200&q=80', color: '#2F7A4A', bgColor: '#EAF8EF' };
  }
  if (/(tool|scissor|clipper|brush|comb|accessory|barber)/.test(normalized)) {
    return { imageUrl: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=200&q=80', color: '#8B5CF6', bgColor: '#F3E8FF' };
  }
  if (/(sanitizer|clean|disinfect|wipe)/.test(normalized)) {
    return { imageUrl: 'https://images.unsplash.com/photo-1584305577018-273b331d5f2b?auto=format&fit=crop&w=200&q=80', color: '#0F766E', bgColor: '#E6FFFB' };
  }
  if (/(salon|spa|massage|towel|hotel)/.test(normalized)) {
    return { imageUrl: 'https://images.unsplash.com/photo-1540555700478-4be289fbec6b?auto=format&fit=crop&w=200&q=80', color: '#F5821F', bgColor: '#FFF2E6' };
  }

  return { imageUrl: 'https://images.unsplash.com/photo-1527799820379-db61410e8c2e?auto=format&fit=crop&w=200&q=80', color: '#1B2A4A', bgColor: '#F3F4F6' };
};

const getCategoryImageUrl = (category: any, fallback: string) => {
  const image = [
    category?.image_url,
    category?.imageUrl,
    category?.category_image_url,
    category?.category_image,
    category?.brand_image_url,
    category?.brand_image,
    category?.thumbnail_url,
    category?.icon_url,
    category?.logo_url,
    category?.logo,
    category?.image?.url,
    category?.image,
  ].find((value) => typeof value === 'string' && value.trim());

  return normalizeImageUrl(image, fallback);
};

const mapPaymentMethodToApiValue = (label: string) => {
  const normalized = (label || '').trim().toLowerCase();
  if (normalized === 'cash on delivery' || normalized === 'cash on delivery (cod)') return 'PAY_ON_DELIVERY';
  if (normalized.includes('mtn')) return 'MTN_MOBILE_MONEY';
  if (normalized.includes('airtel')) return 'AIRTEL_MONEY';
  if (normalized.includes('bank')) return 'BANK_TRANSFER';
  return 'PAY_ON_DELIVERY';
};

// Retry logic with exponential backoff
const retryFetch = async (
  fn: () => Promise<Response>,
  maxRetries: number = 2,
  baseDelayMs: number = 500
): Promise<Response> => {
  let lastError: Error | null = null;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries) {
        const delayMs = baseDelayMs * Math.pow(2, i);
        await new Promise<void>((resolve) => setTimeout(() => resolve(), delayMs));
      }
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
};

const requestJson = async (
  path: string,
  options: RequestInit = {},
  token: string | null = null,
  timeoutMs: number = 20000
) => {
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const candidateUrls = API_BASE_URLS.map((baseUrl) => buildUrl(path, baseUrl));
  let lastError: Error | null = null;

  for (const [index, url] of candidateUrls.entries()) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      console.log(`[API] request -> ${url} (timeout ${timeoutMs}ms)`);
      console.log('[API] request options:', options);
      const response = await retryFetch(
        () =>
          fetch(url, {
            ...options,
            headers,
            signal: controller.signal,
          }),
        2,
        300
      );

      const text = await response.text();
      let data: any = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }

      return { ok: response.ok, status: response.status, data };
    } catch (error: any) {
      lastError = error as Error;
      console.error(`API Error [${path}] @ ${url}:`, error?.message || error);
      console.error(error);
      if (error?.name === 'AbortError' && index < candidateUrls.length - 1) {
        continue;
      }
      if (index === candidateUrls.length - 1) {
        if (error?.name === 'AbortError') {
          return { ok: false, status: 408, data: { error: 'Request timeout' } };
        }
        return {
          ok: false,
          status: 0,
          data: { error: (error && error.message) || 'Network error' },
        };
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return {
    ok: false,
    status: 0,
    data: { error: (lastError && lastError.message) || 'Network error' },
  };
};

const fetchPublicCatalogProducts = async (token: string | null) => {
  const pageSize = 100;
  const allProducts: any[] = [];
  let page = 1;
  let lastResponse: any = { ok: false, status: 0, data: null };

  // The public catalog is paginated so stores with more than 100 products are
  // fully available on category and brand screens, not just on the home rail.
  while (page <= 100) {
    const response = await requestJson(`/api/catalog/products/?page=${page}&page_size=${pageSize}`, {}, token);
    lastResponse = response;
    if (!response.ok) {
      return { response, products: normalizeProductsPayload(allProducts) };
    }

    const pageProducts = normalizeProductsPayload(getCollectionPayload(response.data, 'products'));
    allProducts.push(...pageProducts);
    const total = Number(response.data?.count);

    if (!pageProducts.length || (Number.isFinite(total) && allProducts.length >= total) || !response.data?.next) {
      break;
    }
    page += 1;
  }

  return { response: lastResponse, products: normalizeProductsPayload(allProducts) };
};

const navItems = [
  { key: 'Home', label: 'Home', icon: '⌂' },
  { key: 'Categories', label: 'Category', icon: '▦' },
  { key: 'Cart', label: 'Cart', icon: '🛒' },
  { key: 'Orders', label: 'Orders', icon: '▤' },
  { key: 'Settings', label: 'Settings', icon: '⚙' },
];

// Mirror backend ORDER_STATUS_CHOICES to avoid mismatches between UI and API
const orderStatusTabs = [
  'All',
  'Confirmed',
  'Delivered',
];

  const getOrderStatusStyle = (status?: string | null) => {
    switch ((status || 'Pending').toLowerCase()) {
      case 'delivered':
        return styles.statusDelivered;
      case 'confirmed':
        return styles.statusConfirmed;
      case 'pending':
      default:
        return styles.statusPending;
    }
  };

function SplashScreen() {
  return (
    <View style={styles.splashContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#01143F" />
      <Image source={{ uri: SPLASH_LOGO_URL }} style={styles.splashLogoImage} resizeMode="contain" />
      <Image source={{ uri: SPLASH_DELIVERY_IMAGE_URL }} style={styles.splashDeliveryImage} resizeMode="contain" />
        <View style={styles.logoStack}>
          <View style={styles.logoBadgeCircle}>
            <Text style={styles.logoBadgeCircleText}>👤</Text>
          </View>
          <Text style={styles.splashLogo}>GLOW</Text>
        </View>
        <Text style={styles.splashTagline}>— SALON SUPPLIES, DELIVERED. —</Text>

        <Image source={require('./assets/glow-logo-navy-bg.jpg')} style={styles.splashImage} />

        <Text style={styles.splashHeading}>Welcome to Glow</Text>
        <Text style={styles.splashSubtext}>Everything your salon needs,{'\n'}delivered to your door.</Text>
      <ActivityIndicator size="small" color="#F5821F" style={styles.splashLoader} />
    </View>
  );
}

export default function App() {
  const { width } = useWindowDimensions();
  const isCompact = width < 380;
  const productCardWidth = Math.min(174, Math.max(148, width - 44));
  const miniProductCardWidth = Math.min(150, Math.max(126, Math.round(width * 0.36)));
  const categoryCardWidth = Math.min(84, Math.max(70, width * 0.21));
  const [banners, setBanners] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [cart, setCart] = useState<any>({ items: [] });
  const [profile, setProfile] = useState<any>(null);
  const [resetEmail, setResetEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Auto-clear transient error messages after a short delay so the UI doesn't
  // remain stuck showing a stale error (e.g., stock sync failures).
  useEffect(() => {
    if (!error) return undefined;
    const id = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(id);
  }, [error]);
  const [activeTab, setActiveTab] = useState('Home');
  const [heroImageFallback, setHeroImageFallback] = useState(false);
  useEffect(() => {
    setHeroImageFallback(false);
  }, [banners[0]?.image_url]);
  const [searchTerm, setSearchTerm] = useState('');
  const [catalogMode, setCatalogMode] = useState<'category' | 'brand'>('category');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState('All Brands');
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [categorySortMode, setCategorySortMode] = useState<'featured' | 'price' | 'name'>('featured');
  const [categoryFilterMode, setCategoryFilterMode] = useState<'all' | 'in_stock' | 'out_of_stock'>('all');
  const [categoryFilterOpen, setCategoryFilterOpen] = useState(false);
  const [selectedOrderStatus, setSelectedOrderStatus] = useState('All');
  const [debouncedOrderStatus, setDebouncedOrderStatus] = useState('All');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersRefreshing, setOrdersRefreshing] = useState(false);
  const [ordersLoadingMore, setOrdersLoadingMore] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [orderSearch, setOrderSearch] = useState('');
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersHasMore, setOrdersHasMore] = useState(true);
  const ordersEndReachedDuringMomentumRef = useRef(true);
  const [profileRoute, setProfileRoute] = useState<'profile' | 'login' | 'settings' | 'personal_information' | 'change_password' | 'payment_methods' | 'addresses' | 'help' | 'about' | 'cart' | 'checkout' | 'order_success' | 'security' | 'favorites'>('profile');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [selectedProductImageIndex, setSelectedProductImageIndex] = useState(0);
  const [wishlist, setWishlist] = useState<any[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<any[]>([]);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [profileAuthMode, setProfileAuthMode] = useState<'login' | 'signup'>('login');
  const [profileAuthEmail, setProfileAuthEmail] = useState('');
  const [profileAuthPassword, setProfileAuthPassword] = useState('');
  const [showProfilePassword, setShowProfilePassword] = useState(false);
  const [showRecoveryPassword, setShowRecoveryPassword] = useState(false);
  const [showRecoveryConfirmPassword, setShowRecoveryConfirmPassword] = useState(false);
  const [profileAuthFirstName, setProfileAuthFirstName] = useState('');
  const [profileAuthLastName, setProfileAuthLastName] = useState('');
  const [profileAuthPhone, setProfileAuthPhone] = useState('');
  const [profileAuthSalonName, setProfileAuthSalonName] = useState('');
  const [profileAuthDistrict, setProfileAuthDistrict] = useState('');
  const [profileAuthVillage, setProfileAuthVillage] = useState('');
  const [profileAuthError, setProfileAuthError] = useState<string | null>(null);
  const [profileAuthLoading, setProfileAuthLoading] = useState(false);
  const [showPasswordRecovery, setShowPasswordRecovery] = useState(false);
  const [recoveryIdentifier, setRecoveryIdentifier] = useState('');
  const [recoveryUid, setRecoveryUid] = useState('');
  const [recoveryToken, setRecoveryToken] = useState('');
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [recoveryPasswordConfirm, setRecoveryPasswordConfirm] = useState('');
  const [postLoginRoute, setPostLoginRoute] = useState<'profile' | 'checkout' | 'orders'>('profile');
  const prefetchedImagesRef = useRef<Set<string>>(new Set());
  const previousTabRef = useRef('Home');
  const tabHistoryRef = useRef<string[]>([]);

  useEffect(() => {
    if (activeTab !== previousTabRef.current) {
      if (previousTabRef.current && activeTab !== previousTabRef.current) {
        tabHistoryRef.current = [...tabHistoryRef.current, previousTabRef.current];
        if (tabHistoryRef.current.length > 15) {
          tabHistoryRef.current = tabHistoryRef.current.slice(-15);
        }
      }
      previousTabRef.current = activeTab;
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'Home' && activeTab !== 'Categories') {
      setSelectedProduct(null);
    }
  }, [activeTab]);

  // Android hardware back button handling: go to the last viewed screen when available,
  // otherwise keep the app on the current view instead of always forcing Home.
  useEffect(() => {
    const onBackPress = () => {
      if (selectedProduct) {
        setSelectedProduct(null);
        return true;
      }
      const previousTab = tabHistoryRef.current[tabHistoryRef.current.length - 1];
      if (previousTab) {
        tabHistoryRef.current = tabHistoryRef.current.slice(0, -1);
        setActiveTab(previousTab);
        return true;
      }
      if (activeTab !== 'Home') {
        setActiveTab('Home');
        return true;
      }
      return false;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [selectedProduct, activeTab]);
  const [cartQuantities, setCartQuantities] = useState<Record<number, number>>({});
  const [cartFeedback, setCartFeedback] = useState<string | null>(null);
  const [cartHydrated, setCartHydrated] = useState(false);
  const [checkoutNotice, setCheckoutNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash on delivery');
  const [savingPaymentMethod, setSavingPaymentMethod] = useState(false);
  const [addressRouteReturnTarget, setAddressRouteReturnTarget] = useState<'profile' | 'checkout'>('profile');
  const [profileDraft, setProfileDraft] = useState({ first_name: '', last_name: '', email: '', phone_number: '', salon_name: '' });
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [newAddressLabel, setNewAddressLabel] = useState('Home');
  const [newAddressDistrict, setNewAddressDistrict] = useState('');
  const [newAddressVillage, setNewAddressVillage] = useState('');
  const [newAddressPhone, setNewAddressPhone] = useState('');
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [editingAddressLabel, setEditingAddressLabel] = useState('');
  const [editingAddressDistrict, setEditingAddressDistrict] = useState('');
  const [editingAddressVillage, setEditingAddressVillage] = useState('');
  const [editingAddressPhone, setEditingAddressPhone] = useState('');
  const ordersRequestRef = useRef<string | null>(null);
  const ordersFetchInFlightRef = useRef(false);
  const cartOpsRef = useRef<Record<string, boolean>>({});

  const openAddresses = (target: 'profile' | 'checkout') => {
    setAddressRouteReturnTarget(target);
    setProfileRoute('addresses');
  };

  const selectAddress = (address: any) => {
    setSelectedAddressId(String(address.id));
    const addressText = formatDeliveryLocation(address.district || '', address.village || '') || address.address || '';
    setDeliveryAddress(addressText);
    setProfile((prev: any) => (prev ? { ...prev, address: addressText, district: address.district || prev.district, village: address.village || prev.village } : prev));
  };

  const startEditAddress = (entry: any) => {
    setEditingAddressId(String(entry.id));
    setEditingAddressLabel(entry.label || '');
    setEditingAddressDistrict(entry.district || '');
    setEditingAddressVillage(entry.village || '');
    setEditingAddressPhone(entry.phone || '');
  };

  const cancelEditAddress = () => {
    setEditingAddressId(null);
    setEditingAddressLabel('');
    setEditingAddressDistrict('');
    setEditingAddressVillage('');
    setEditingAddressPhone('');
  };

  const saveEditedAddress = async (addressId: any) => {
    const addrId = addressId;
    if (!editingAddressDistrict || !editingAddressVillage) {
      Alert.alert('Delivery location required', 'Choose both a district and village or area.');
      return;
    }
    const updatedAddress = formatDeliveryLocation(editingAddressDistrict, editingAddressVillage);
    // Update locally first
    setSavedAddresses((prev) => prev.map((a: any) => (String(a.id) === String(addrId) ? {
      ...a,
      label: editingAddressLabel.trim() || a.label,
      district: editingAddressDistrict,
      village: editingAddressVillage,
      address: updatedAddress,
      phone: editingAddressPhone.trim(),
    } : a)));
    if (String(selectedAddressId) === String(addrId)) {
      setDeliveryAddress(updatedAddress);
    }
    // Persist to server
    if (!authToken) {
      cancelEditAddress();
      return;
    }
    try {
      const payload: any = {
        label: editingAddressLabel.trim() || undefined,
        district: editingAddressDistrict,
        village: editingAddressVillage,
        address: updatedAddress,
        phone: editingAddressPhone.trim(),
      };
      // Try PATCH to addresses endpoint
      let res = await requestJson(`/api/addresses/${addrId}/`, { method: 'PATCH', body: JSON.stringify(payload) }, authToken);
      if (res && res.ok) {
        await refreshProfile();
        cancelEditAddress();
        return;
      }
      // Fallback: patch profile if single address model
      res = await requestJson('/api/profile/', { method: 'PATCH', body: JSON.stringify({ phone_number: editingAddressPhone, address: updatedAddress, district: editingAddressDistrict, village: editingAddressVillage }) }, authToken);
      if (res && res.ok) {
        await refreshProfile();
      }
    } catch (err) {
      console.warn('saveEditedAddress error', err);
    } finally {
      cancelEditAddress();
    }
  };

  const saveProfileDetails = async () => {
    const salonName = (profileDraft.salon_name || profile?.salon_name || profile?.business_name || profile?.salonName || '').trim();
    const nextProfile = {
      ...(profile || {}),
      ...profileDraft,
      first_name: (profileDraft.first_name || '').trim(),
      last_name: (profileDraft.last_name || '').trim(),
      email: (profileDraft.email || profile?.email || '').trim(),
      phone_number: (profileDraft.phone_number || profile?.phone_number || '').trim(),
      salon_name: salonName,
      business_name: salonName || profile?.business_name || '',
    };

    if (authToken) {
      try {
        const payload = {
          first_name: nextProfile.first_name,
          last_name: nextProfile.last_name,
          email: nextProfile.email,
          phone_number: nextProfile.phone_number,
          salon_name: salonName,
          business_name: salonName,
        };

        const res = await requestJson('/api/profile/', { method: 'PATCH', body: JSON.stringify(payload) }, authToken);
        if (!res || !res.ok) {
          Alert.alert('Could not update profile', res?.data?.detail || res?.data?.error || 'Please try again.');
          return;
        }
      } catch (err) {
        console.warn('saveProfileDetails failed', err);
        Alert.alert('Could not update profile', 'Please check your connection and try again.');
        return;
      }
    }

    setProfile(nextProfile);
    setProfileRoute('profile');
    Alert.alert('Profile updated', 'Your account information has been saved.');
  };

  const saveNewAddress = () => {
    if (!newAddressDistrict || !newAddressVillage) {
      Alert.alert('Delivery location required', 'Please choose both a district and village or area.');
      return;
    }

    if (savedAddresses.length >= 5) {
      Alert.alert('Address limit reached', 'You can save up to 5 addresses. Delete an existing address before adding another.');
      return;
    }

    const addressText = formatDeliveryLocation(newAddressDistrict, newAddressVillage);

    const addressEntry = {
      id: `addr-${Date.now()}`,
      label: newAddressLabel.trim() || 'Home',
      address: addressText,
      district: newAddressDistrict,
      village: newAddressVillage,
      phone: newAddressPhone.trim(),
      isDefault: savedAddresses.length === 0,
    };

    setSavedAddresses((prev) => [addressEntry, ...prev]);
    setSelectedAddressId(String(addressEntry.id));
    setDeliveryAddress(addressEntry.address);
    setProfile((prev: any) => (prev ? { ...prev, address: addressEntry.address } : prev));
    // Persist to server when signed in. Try address collection endpoint first, fallback to profile PATCH
    (async () => {
      try {
        if (!authToken) return;
        const payload: any = {
          label: addressEntry.label,
          address: addressEntry.address,
          district: addressEntry.district,
          village: addressEntry.village,
        };
        if (addressEntry.phone) payload.phone = addressEntry.phone;
        console.log('[CART] saving new address to server', payload);
        // Try POST to addresses collection
        let res = await requestJson('/api/addresses/', { method: 'POST', body: JSON.stringify(payload) }, authToken);
        if (res && res.ok) {
          const serverAddr = res.data;
          // Ensure server address appears in savedAddresses
          setSavedAddresses((prev) => [serverAddr, ...prev.filter((a: any) => String(a.id) !== String(addressEntry.id))].slice(0, 5));
          setSelectedAddressId(String(serverAddr.id));
          await refreshProfile();
          Alert.alert('Address saved', 'Your new address has been saved to your account and selected for delivery.');
          return;
        }
        // Fallback: update profile with primary address fields. Some backends reject PATCH.
        const fallbackPayload = { address: addressEntry.address, district: addressEntry.district, village: addressEntry.village, phone_number: addressEntry.phone };
        res = await requestJson('/api/profile/', { method: 'PATCH', body: JSON.stringify(fallbackPayload) }, authToken);
        console.log('[CART] saveNewAddress fallback response:', res);
        if (!res || !res.ok) {
          console.warn('[CART] saveNewAddress profile update failed', res);
        }
        if (res && res.ok) {
          await refreshProfile();
          Alert.alert('Address saved', 'Your new address has been saved to your account and selected for delivery.');
        }
      } catch (err) {
        console.warn('Failed to persist address', err);
      }
    })();
    setNewAddressLabel('Home');
    setNewAddressDistrict('');
    setNewAddressVillage('');
    setNewAddressPhone('');
    Alert.alert('Address saved', 'Your new address has been added and selected for delivery.');
  };

  const deleteAddress = async (addressId: any) => {
    const remainingAddresses = savedAddresses.filter((entry: any) => String(entry.id) !== String(addressId));
    const replacement = remainingAddresses.find((entry: any) => entry.isDefault) || remainingAddresses[0];
    // Remove locally first for snappy UI
    setSavedAddresses(remainingAddresses);
    if (String(selectedAddressId) === String(addressId)) {
      if (replacement) {
        selectAddress(replacement);
      } else {
        setSelectedAddressId(null);
        setDeliveryAddress('');
      }
    }

    if (!authToken) return;
    try {
      // Try deleting via addresses endpoint
      const res = await requestJson(`/api/addresses/${addressId}/`, { method: 'DELETE' }, authToken);
      if (res && (res.ok || res.status === 204)) {
        await refreshProfile();
        return;
      }
      // Fallback: if API doesn't support delete, try clearing profile fields if they match
      await requestJson('/api/profile/', { method: 'PATCH', body: JSON.stringify({ address: '', district: '', village: '' }) }, authToken);
      await refreshProfile();
    } catch (err) {
      console.warn('deleteAddress error', err);
    }
  };

    const savePaymentMethod = async () => {
      const nextPaymentMethod = 'Cash on delivery';
      setPaymentMethod(nextPaymentMethod);
      const apiValue = mapPaymentMethodToApiValue(nextPaymentMethod);
      if (!authToken) {
        Alert.alert('Sign in required', 'Please sign in to save your payment method.');
        setPostLoginRoute('profile');
        setProfileRoute('login');
        return;
      }

      try {
        setSavingPaymentMethod(true);
        const res = await requestJson('/api/profile/', { method: 'PATCH', body: JSON.stringify({ preferred_payment_method: apiValue }) }, authToken);
        if (res.ok) {
          setProfile((prev: any) => ({ ...(prev || {}), preferred_payment_method: apiValue }));
          Alert.alert('Saved', 'Cash on delivery is now your active payment method.');
        } else {
          Alert.alert('Error', res.data?.detail || res.data?.error || 'Could not save payment method');
        }
      } catch (e) {
        console.error('savePaymentMethod error', e);
        Alert.alert('Error', 'An error occurred while saving your payment method.');
      } finally {
        setSavingPaymentMethod(false);
      }
    };

  const fetchOrders = async ({ page = 1, refresh = false } = {}) => {
    if (!authToken || ordersFetchInFlightRef.current) return;

    const requestKey = `orders:${authToken}:${selectedOrderStatus}:${page}`;
    if (!refresh && page === 1 && ordersRequestRef.current === requestKey) return;

    ordersFetchInFlightRef.current = true;
    if (refresh) {
      setOrdersRefreshing(true);
    } else if (page === 1) {
      setOrdersLoading(true);
    } else {
      setOrdersLoadingMore(true);
    }
    if (page === 1) {
      setOrdersError(null);
    }

    try {
      const statusParam = selectedOrderStatus && selectedOrderStatus !== 'All' ? `&status=${encodeURIComponent(selectedOrderStatus)}` : '';
      const res = await requestJson(`/api/orders/?page=${page}${statusParam}`, {}, authToken);
      if (res.ok) {
        const nextOrders = normalizeOrdersPayload(res.data);
        const isPaginatedResponse = res.data && typeof res.data === 'object' && !Array.isArray(res.data) && (Array.isArray(res.data.results) || 'next' in res.data || 'previous' in res.data || 'count' in res.data);

        if (!isPaginatedResponse && page > 1) {
          // The backend does not support page-based order pagination for this endpoint,
          // so stop requesting additional pages after the first successful load.
          setOrdersHasMore(false);
          return;
        }

        setOrders((prev) => {
          if (page === 1 || refresh) {
            // Preserve any optimistic local orders created client-side until server confirms them
            const localPending = Array.isArray(prev) ? prev.filter((o: any) => o && o._local) : [];
            const merged = [...nextOrders];
            for (const local of localPending) {
              if (!merged.some((m: any) => (m.order_number && local.order_number && m.order_number === local.order_number))) {
                merged.push(local);
              }
            }
            return merged;
          }
          return [...(prev || []), ...nextOrders];
        });

        if (isPaginatedResponse) {
          setOrdersHasMore(Boolean(res.data.next) || nextOrders.length > 0);
        } else {
          setOrdersHasMore(false);
        }

        ordersRequestRef.current = requestKey;
      } else {
        const responseDetail = typeof res.data?.detail === 'string' ? res.data.detail : null;
        setOrdersError(responseDetail || 'We could not load your orders. Please try again.');
        setOrdersHasMore(false);
      }
    } catch (e) {
      console.error('fetchOrders error', e);
      setOrdersError('We could not load your orders. Check your connection and try again.');
      setOrdersHasMore(false);
    } finally {
      ordersFetchInFlightRef.current = false;
      setOrdersLoading(false);
      setOrdersRefreshing(false);
      setOrdersLoadingMore(false);
    }
  };

  const loadHomeData = async (isRefresh = false, tokenOverride: string | null = null) => {
    try {
      console.log(`[INFO] Starting data load from ${API_BASE_URLS[0] || 'http://127.0.0.1:8000'}`);
      
      const token = tokenOverride ?? authToken;
      const isAuthenticatedLoad = Boolean(token);

      // Send the access token when available. The deployed API protects its
      // catalog endpoints, while local development may allow guest browsing.
      console.log('[API] Fetching the public home catalog...');
      const [bannerRes, categoryRes, brandRes, catalogLoad] = await Promise.all([
        requestJson('/api/banners/'),
        requestJson('/api/categories/'),
        requestJson('/api/brands/'),
        fetchPublicCatalogProducts(token),
      ]);
      let catalogRes = catalogLoad.response;
      let catalogProducts = catalogLoad.products;

      // Keep existing installations useful until their backend has deployed
      // the new catalog route. The fallback is intentionally only a fallback:
      // it remains capped, whereas the catalog route loads every page.
      if (!catalogRes.ok) {
        const legacyProductsRes = await requestJson('/api/products/best-sellers/', {}, token);
        if (legacyProductsRes.ok) {
          catalogRes = legacyProductsRes;
          catalogProducts = normalizeProductsPayload(getCollectionPayload(legacyProductsRes.data, 'products'));
        }
      }

      const authRequests = isAuthenticatedLoad ? [
        requestJson('/api/cart/', {}, token),
        requestJson('/api/profile/', {}, token),
        requestJson('/api/orders/', {}, token),
      ] : [Promise.resolve({ ok: false, status: 401, data: null }), Promise.resolve({ ok: false, status: 401, data: null }), Promise.resolve({ ok: false, status: 401, data: null })];

      console.log('[API] Fetching cart, profile, and orders for authenticated session:', isAuthenticatedLoad);
      const [cartRes, profileRes, ordersRes] = await Promise.all(authRequests);

      // Log protected request results only when a signed-in session made them.
      if (isAuthenticatedLoad) {
      console.log('[API] Banners:', bannerRes.ok ? '✓' : `✗ (${bannerRes.status})`);
      console.log('[API] Categories:', categoryRes.ok ? '✓' : `✗ (${categoryRes.status})`);
      console.log('[API] Public catalog:', catalogRes.ok ? '✓' : `✗ (${catalogRes.status})`);
      console.log('[API] Cart:', cartRes.ok ? '✓' : `✗ (${cartRes.status})`);
      console.log('[API] Profile:', profileRes.ok ? '✓' : `✗ (${profileRes.status})`);
      console.log('[API] Orders:', ordersRes.ok ? '✓' : `✗ (${ordersRes.status})`);

      }

      // Update state with responses (show partial data if some calls fail)
      const nextProducts = catalogProducts;
      console.log('[API] Loaded products count:', nextProducts.length);
      const apiBrands = normalizeBrandsPayload(getCollectionPayload(brandRes.data, 'brands'));
      setBanners(getCollectionPayload(bannerRes.data, 'banners'));
      setCategories(normalizeCategoriesPayload(getCollectionPayload(categoryRes.data, 'categories')));
      setBrands(apiBrands.length ? apiBrands : getBrandsFromProducts(nextProducts));
      setProducts(nextProducts);
      try {
        await AsyncStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(nextProducts));
      } catch (err) {
        console.warn('[CACHE] unable to persist products locally', err);
      }
      // Start prefetching product images for faster display
      (async () => {
        try {
          await prefetchProductImages(nextProducts, { concurrency: 4, totalLimit: 120 }, prefetchedImagesRef);
        } catch (err) {
          console.warn('[PREFETCH] product image prefetch failed', err);
        }
      })();
      const nextCart = cartRes.ok && cartRes.data ? cartRes.data : { items: [] };
      setCart(nextCart);
      setCartQuantities(Object.fromEntries((nextCart.items || []).map((item: any) => [item.product_id ?? item.id, Number(item.quantity || 0)])));
      
      const profileData = profileRes.ok ? profileRes.data : null;
      setProfile(profileData);
      setProfilePhoto(profileData?.profile_image || null);

      const profileUnauthorized = isAuthenticatedLoad && (profileRes.status === 401 || profileRes.status === 403);
      if (profileUnauthorized) {
        console.warn('[AUTH] Server rejected a stored session; keeping the session until the user explicitly logs out.');
      }

      if (ordersRes.ok) {
        const nextOrders = normalizeOrdersPayload(ordersRes.data);
        // Preserve optimistic local orders created client-side until server confirms them
        setOrders((prev) => {
          const localPending = Array.isArray(prev) ? prev.filter((o: any) => o && o._local) : [];
          const merged = [...nextOrders];
          for (const local of localPending) {
            if (!merged.some((m: any) => (m.order_number && local.order_number && m.order_number === local.order_number))) {
              merged.push(local);
            }
          }
          return merged;
        });
        ordersRequestRef.current = `orders:${token}:${selectedOrderStatus}:1`;
      }

      // Only surface a startup error if all primary home-data endpoints fail.
      const criticalResponses = [bannerRes, categoryRes, catalogRes];
      const successfulCriticalResponses = criticalResponses.filter((response) => response.ok).length;
      const failedCriticalResponses = criticalResponses.filter((response) => !response.ok).length;

      if (failedCriticalResponses === criticalResponses.length) {
        console.warn(`[ERROR] ${failedCriticalResponses} critical API calls failed`);
        setError(`Connection issue: ${failedCriticalResponses} data source${failedCriticalResponses > 1 ? 's' : ''} unavailable. Retry by pulling down.`);
      } else if (failedCriticalResponses > 0) {
        console.warn(`[WARN] ${failedCriticalResponses} home API calls failed; showing available content`);
        setError(null);
      } else {
        console.log('[INFO] Data load successful');
        setError(null);
      }
    } catch (e: any) {
      console.error('[ERROR] Unexpected error during data load:', e.message);
      const errorMsg = e.message || 'Unable to connect to server';
      setError(`Connection failed: ${errorMsg}. Make sure the backend is running at ${API_BASE_URLS[0] || 'http://127.0.0.1:8000'}`);
      setBanners([]);
      setCategories([]);
      setBrands([]);
      setProducts([]);
      if (!authToken) {
        setCart({ items: [] });
        setProfile(null);
      }
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedOrderStatus(selectedOrderStatus);
    }, 250);
    return () => clearTimeout(timeoutId);
  }, [selectedOrderStatus]);

  useEffect(() => {
    if (activeTab !== 'Orders') return;
    if (!authToken) return;
    setOrdersPage(1);
    setOrdersHasMore(true);
    fetchOrders({ page: 1, refresh: true });
  }, [activeTab, authToken, debouncedOrderStatus]);

  useEffect(() => {
    const persistAuthToken = async () => {
      try {
        if (authToken) {
          await AsyncStorage.setItem(AUTH_TOKEN_STORAGE_KEY, authToken);
        } else {
          await AsyncStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
        }
      } catch (err) {
        console.warn('[AUTH] Unable to persist token state', err);
      }
    };
    void persistAuthToken();
  }, [authToken]);

  useEffect(() => {
    const restorePersistedCart = async () => {
      try {
        const raw = await AsyncStorage.getItem(CART_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.items)) {
            setCart(parsed);
          }
        }
      } catch (error) {
        console.warn('[CART] Unable to restore persisted cart', error);
      } finally {
        setCartHydrated(true);
      }
    };

    const restorePersistedProducts = async () => {
      try {
        const raw = await AsyncStorage.getItem(PRODUCTS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed)) {
            setProducts(parsed);
            // attempt to prefetch images for quicker resume
            (async () => {
              try {
                await prefetchProductImages(parsed, { concurrency: 3, totalLimit: 80 }, prefetchedImagesRef);
              } catch (err) {
                // ignore
              }
            })();
          }
        }
      } catch (err) {
        console.warn('[CACHE] unable to restore persisted products', err);
      }
    };

    const restoreAuthToken = async () => {
      try {
        const rawToken = await AsyncStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
        if (rawToken) {
          setAuthToken(rawToken);
          await loadHomeData(false, rawToken);
          return;
        }
      } catch (err) {
        console.warn('[AUTH] Unable to restore auth token', err);
      }
      await loadHomeData(false);
    };

    restorePersistedCart();
    void restorePersistedProducts();
    restoreAuthToken();
  }, []);

  // Persist and restore sidebar visibility so users can hide and bring it back
  useEffect(() => {
    const loadSidebarPref = async () => {
      try {
        const raw = await AsyncStorage.getItem(SIDEBAR_PERSIST_KEY);
        if (raw !== null) setShowSidebar(raw === '1');
      } catch (err) {
        // ignore
      }
    };
    void loadSidebarPref();
  }, []);

  useEffect(() => {
    const persist = async () => {
      try {
        await AsyncStorage.setItem(SIDEBAR_PERSIST_KEY, showSidebar ? '1' : '0');
      } catch (err) {
        // ignore
      }
    };
    void persist();
  }, [showSidebar]);

  useEffect(() => {
    if (!cartHydrated) return;
    const persistCart = async () => {
      try {
        await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
      } catch (error) {
        console.warn('[CART] Unable to persist cart', error);
      }
    };
    persistCart();
  }, [cart, cartHydrated]);

  useEffect(() => {
    if (!checkoutNotice) return;
    const timer = setTimeout(() => setCheckoutNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [checkoutNotice]);

  useEffect(() => {
    if (profile?.email) {
      setResetEmail(profile.email);
    }

    if (profile) {
      const salonName = profile.salon_name || profile.business_name || profile.salonName || '';
      setProfileDraft({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        email: profile.email || '',
        phone_number: profile.phone_number || '',
        salon_name: salonName,
      });
      setPaymentMethod('Cash on delivery');

      const normalizedAddresses = deriveSavedAddressesFromProfile(profile);

      setSavedAddresses(normalizedAddresses);
      const currentSelection = normalizedAddresses.find((entry: any) => String(entry.id) === String(selectedAddressId));
      if (!currentSelection) {
        const defaultAddress = normalizedAddresses.find((entry: any) => entry.isDefault) || normalizedAddresses[0];
        if (defaultAddress) {
          setSelectedAddressId(defaultAddress.id);
          setDeliveryAddress(defaultAddress.address || '');
        }
      }
    }
  }, [profile]);

  const getOrderTrackingSteps = (order: any) => {
    const status = (order?.order_status || 'Pending').toLowerCase();
    const isConfirmed = ['confirmed', 'processing', 'packed', 'out for delivery', 'delivered'].includes(status);
    const isProcessing = ['processing', 'packed', 'out for delivery', 'delivered'].includes(status);
    const isPacked = ['packed', 'out for delivery', 'delivered'].includes(status);
    const isOnWay = ['out for delivery', 'delivered'].includes(status);
    const isDelivered = status === 'delivered';

    return [
      { title: 'Order placed', description: 'Your order request is received.', active: true },
      { title: 'Seller confirmed', description: 'Seller confirmed your order and stock.', active: isConfirmed },
      { title: 'Packing in progress', description: 'Your items are being packed.', active: isPacked },
      { title: 'Out for delivery', description: 'A rider is heading your way.', active: isOnWay },
      { title: 'Delivered', description: 'Your package has arrived at your door.', active: isDelivered },
    ];
  };

  const getDeliveryEta = (order: any) => {
    const status = (order?.order_status || 'Pending').toLowerCase();
    const createdAt = order?.created_at ? new Date(order.created_at) : null;
    const formatClock = (date: Date) => date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    if (status === 'delivered') {
      if (createdAt && !Number.isNaN(createdAt.getTime())) {
        return `Delivered at ${formatClock(new Date(createdAt.getTime() + 7 * 60 * 60 * 1000))}`;
      }
      return 'Delivered today';
    }

    if (status === 'out for delivery') {
      if (createdAt && !Number.isNaN(createdAt.getTime())) {
        return `Arrives by ${formatClock(new Date(createdAt.getTime() + 9 * 60 * 60 * 1000))}`;
      }
      return 'Rider on the way';
    }

    if (status === 'packed') {
      if (createdAt && !Number.isNaN(createdAt.getTime())) {
        return `Ready for dispatch by ${formatClock(new Date(createdAt.getTime() + 6 * 60 * 60 * 1000))}`;
      }
      return 'Ready for dispatch';
    }

    if (status === 'processing') {
      if (createdAt && !Number.isNaN(createdAt.getTime())) {
        return `Packing expected by ${formatClock(new Date(createdAt.getTime() + 5 * 60 * 60 * 1000))}`;
      }
      return 'Preparing your items';
    }

    if (status === 'confirmed') {
      if (createdAt && !Number.isNaN(createdAt.getTime())) {
        return `Packing starts around ${formatClock(new Date(createdAt.getTime() + 4 * 60 * 60 * 1000))}`;
      }
      return 'Waiting for seller packing';
    }

    if (status === 'cancelled') return 'Order cancelled';
    if (createdAt && !Number.isNaN(createdAt.getTime())) {
      return `Awaiting confirmation by ${formatClock(new Date(createdAt.getTime() + 2 * 60 * 60 * 1000))}`;
    }
    return 'Waiting for seller confirmation';
  };

  const getTrackingHistory = (order: any) => {
    const status = (order?.order_status || 'Pending').toLowerCase();
    const createdAt = order?.created_at ? new Date(order.created_at) : new Date();
    const toHistoryTime = (minutesOffset: number) => {
      const eventTime = new Date(createdAt.getTime() + minutesOffset * 60 * 1000);
      return eventTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    if (status !== 'delivered') {
      return [];
    }

    return [
      { time: toHistoryTime(0), event: 'Order received', detail: 'Your order request is now in review with the seller.' },
      { time: toHistoryTime(30), event: 'Seller confirmed', detail: 'Your order has been confirmed and will move to packing.' },
      { time: toHistoryTime(120), event: 'Packing started', detail: 'The selected salon essentials are being prepared.' },
      { time: toHistoryTime(240), event: 'Packing complete', detail: 'Your order is ready for pickup by the delivery rider.' },
      { time: toHistoryTime(360), event: 'Picked up by rider', detail: 'Your package is now en route for delivery.' },
      { time: toHistoryTime(480), event: 'Delivered', detail: 'The order was handed over successfully.' },
    ];
  };

  // Admin helpers: update order status and cancel (admin endpoints)
  const adminUpdateOrderStatus = async (orderId: number, statusValue: string) => {
    if (!authToken) return { ok: false };
    try {
      const res = await requestJson(`/api/admin/orders/${orderId}/status/`, { method: 'PATCH', body: JSON.stringify({ status: statusValue }) }, authToken);
      if (res.ok) {
        // fetch updated order
        const orderRes = await requestJson(`/api/orders/${orderId}/`, {}, authToken);
        if (orderRes.ok && orderRes.data) {
          setOrders((prev) => (prev || []).map((o: any) => (o && (o.id === orderId || String(o.id) === String(orderId))) ? orderRes.data : o));
        }
      }
      return res;
    } catch (e) {
      console.error('adminUpdateOrderStatus error', e);
      return { ok: false };
    }
  };

  const adminCancelOrder = async (orderId: number) => {
    if (!authToken) return { ok: false };
    try {
      const res = await requestJson(`/api/admin/orders/${orderId}/cancel/`, { method: 'PATCH' }, authToken);
      if (res.ok) {
        const orderRes = await requestJson(`/api/orders/${orderId}/`, {}, authToken);
        if (orderRes.ok && orderRes.data) {
          setOrders((prev) => (prev || []).map((o: any) => (o && (o.id === orderId || String(o.id) === String(orderId))) ? orderRes.data : o));
        }
      }
      return res;
    } catch (e) {
      console.error('adminCancelOrder error', e);
      return { ok: false };
    }
  };

  // Retry a local failed order: re-attempt create
  const retryLocalOrder = async (localOrder: any) => {
    if (!authToken) {
      setCheckoutNotice({ type: 'error', message: 'Sign in to retry placing the order.' });
      return;
    }
    const selectedAddress = savedAddresses.find((entry: any) => String(entry.id) === String(selectedAddressId));
    if (!selectedAddress?.district || !selectedAddress?.village) {
      setCheckoutNotice({ type: 'error', message: 'Choose a district and village or area before retrying your order.' });
      return;
    }
    const retryPhone = String(selectedAddress.phone || profile?.phone_number || '').trim();
    if (!retryPhone) {
      setCheckoutNotice({ type: 'error', message: 'Add a contact phone number to your delivery address before retrying.' });
      return;
    }
    try {
      const payload = {
        district: selectedAddress.district,
        village: selectedAddress.village,
        phone_number: retryPhone,
        payment_method: mapPaymentMethodToApiValue(localOrder.payment_method || paymentMethod || ''),
        notes: localOrder.notes || '',
      };
      const res = await requestJson('/api/orders/create/', { method: 'POST', body: JSON.stringify(payload) }, authToken);
      if (res && (res.status === 201 || res.ok)) {
        const serverOrder = res.data?.order || res.data;
        setOrders((prev) => (prev || []).map((o: any) => (o && o._local && o.order_number === localOrder.order_number) ? serverOrder : o));
        setCart({ items: [] });
        setCheckoutNotice({ type: 'success', message: `Order ${serverOrder.order_number} placed.` });
      } else {
        setCheckoutNotice({ type: 'error', message: res?.data?.detail || 'Retry failed. Please try again.' });
      }
    } catch (e) {
      console.error('retryLocalOrder error', e);
      setCheckoutNotice({ type: 'error', message: 'Network error. Retry later.' });
    }
  };

  const renderOrderItem = useCallback(({ item }: { item: any }) => (
    <OrderItemCard item={item} onView={setSelectedOrderId} onRetry={retryLocalOrder} />
  ), [retryLocalOrder]);

  const openCartScreen = () => {
    setActiveTab('Cart');
    setProfileRoute('cart');
  };

  const toggleWishlist = (product: any) => {
    setWishlist((prev) => {
      const exists = prev.some((item) => item.id === product.id);
      if (exists) {
        return prev.filter((item) => item.id !== product.id);
      }
      return [product, ...prev];
    });
  };

  const openProductDetail = (product: any) => {
    setSelectedProduct(product);
    setSelectedProductImageIndex(0);
    setRecentlyViewed((prev) => {
      const filtered = prev.filter((item) => item.id !== product.id);
      return [product, ...filtered].slice(0, 6);
    });
    // Prefetch detail gallery images for faster viewing
    (async () => {
      try {
        const urls = getProductImageUrls(product).slice(0, 6);
        for (const url of urls) {
          if (!url) continue;
          if (prefetchedImagesRef.current.has(url)) continue;
          try {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            await Asset.fromURI(url).downloadAsync();
            prefetchedImagesRef.current.add(url);
          } catch (e) {
            // fallback
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            await Image.prefetch(url);
            prefetchedImagesRef.current.add(url);
          }
        }
      } catch (err) {
        // ignore
      }
    })();
  };

  const syncCartWithQuantity = (productId: number, nextQty: number, product?: any) => {
    setCart((prev: any) => {
      const items = Array.isArray(prev?.items) ? prev.items : [];
      const existing = items.find((item: any) => Number(item.product_id ?? item.id) === Number(productId));
      let nextCart;
      if (nextQty <= 0) {
        nextCart = { ...prev, items: items.filter((item: any) => Number(item.product_id ?? item.id) !== Number(productId)) };
        console.log('[CART] sync remove ->', productId, 'nextCart items:', nextCart.items.map((i: any) => Number(i.product_id ?? i.id)));
        return nextCart;
      }
      const cartItem = {
        product_id: productId,
        quantity: nextQty,
        product_name: product?.product_name || product?.name || existing?.product_name || `Product ${productId}`,
        image_url: product?.image_url || existing?.image_url || null,
        price: product?.selling_price ?? product?.price ?? existing?.price ?? null,
        category_name: product?.category_name || existing?.category_name || null,
      };
      if (existing) {
        nextCart = { ...prev, items: items.map((item: any) => Number(item.product_id ?? item.id) === Number(productId) ? { ...item, ...cartItem } : item) };
        console.log('[CART] sync update ->', productId, 'qty:', nextQty);
        return nextCart;
      }
      nextCart = { ...prev, items: [...items, cartItem] };
      console.log('[CART] sync add ->', productId, 'qty:', nextQty);
      return nextCart;
    });
  };

  const applyServerCart = (serverCart: any) => {
    if (!serverCart || !Array.isArray(serverCart.items)) return;
    setCart(serverCart);
    setCartQuantities(Object.fromEntries(serverCart.items.map((item: any) => [item.product_id ?? item.id, Number(item.quantity || 0)])));
  };

  const refreshServerCart = async (token: string) => {
    const response = await requestJson('/api/cart/', {}, token);
    console.log('[CART] refreshServerCart response:', response);
    if (response.ok) applyServerCart(response.data);
    return response;
  };

  const refreshProductById = async (productId: number) => {
    if (!productId) return null;
    const candidates = [
      `/api/catalog/products/${productId}/`,
      `/api/products/${productId}/`,
    ];
    for (const path of candidates) {
      try {
        const res = await requestJson(path, {}, authToken);
        console.log('[API] refreshProductById', path, res);
        if (res && res.ok && res.data) {
          const productData = res.data;
          setProducts((prev) => {
            const found = prev.some((p: any) => String(p.id) === String(productData.id));
            if (found) return prev.map((p: any) => (String(p.id) === String(productData.id) ? productData : p));
            return [productData, ...prev];
          });
          return productData;
        }
      } catch (err) {
        // ignore and try next
      }
    }
    return null;
  };

  const refreshProfile = async () => {
    if (!authToken) return null;
    try {
      const res = await requestJson('/api/profile/', {}, authToken);
      console.log('[API] refreshProfile response:', res);
      if (res.ok) {
        setProfile(res.data);
        setProfilePhoto(res.data?.profile_image || null);
        const derivedAddresses = deriveSavedAddressesFromProfile(res.data);
        setSavedAddresses(derivedAddresses);
        if (derivedAddresses.length && (!selectedAddressId || !derivedAddresses.some((entry: any) => String(entry.id) === String(selectedAddressId)))) {
          setSelectedAddressId(String(derivedAddresses[0].id));
        }
        return res.data;
      }
      if (res.status === 401 || res.status === 403) {
        console.warn('[AUTH] refreshProfile received 401/403; keeping the saved session until the user logs out explicitly.');
      }
      return null;
    } catch (err) {
      console.warn('[API] refreshProfile failed', err);
      return null;
    }
  };

  const handleAddToCart = async (productId: number, quantity: number = 1, product?: any) => {
    const productDetails = product || products.find((item: any) => Number(item.id) === Number(productId));
    const stock = productDetails ? getProductStockQuantity(productDetails) : null;
    const currentCartQty = Number((cart?.items || []).find((item: any) => Number(item.product_id ?? item.id) === Number(productId))?.quantity || 0);
    const currentQty = Math.max(cartQuantities[productId] || 0, currentCartQty);

    if (productDetails && isProductOutOfStock(productDetails)) {
      setError('This product is currently out of stock.');
      return;
    }
    if (stock !== null && Number.isFinite(stock) && currentQty + quantity > stock) {
      const available = Math.max(0, stock - currentQty);
      setError(available > 0 ? `Only ${available} item${available === 1 ? '' : 's'} left in stock.` : 'This product is currently out of stock.');
      return;
    }

    const nextQty = currentQty + quantity;
    setCartQuantities((prev) => ({ ...prev, [productId]: nextQty }));
    syncCartWithQuantity(productId, nextQty, productDetails || product);

    if (!authToken) {
      return;
    }

    try {
      const response = await requestJson('/api/cart/add/', {
        method: 'POST',
        body: JSON.stringify({ product_id: productId, quantity }),
      }, authToken);
      if (!response.ok) {
        await refreshServerCart(authToken);
        const message = getApiErrorMessage(response.data, 'Unable to add this product to your cart.');
        if (message.toLowerCase().includes('stock')) {
          await refreshProductById(productId);
          setError('This product has limited stock available. Please reduce the quantity and try again.');
        } else {
          setError(message);
        }
        return;
      }
      await refreshServerCart(authToken);
    } catch (e) {
      setError('Unable to sync cart to server right now.');
    }
  };

  const adjustProductQuantity = async (productId: number, delta: number, product?: any) => {
    const productDetails = product || products.find((item: any) => Number(item.id) === Number(productId));
    const stock = productDetails ? getProductStockQuantity(productDetails) : null;

    if (delta > 0 && productDetails && isProductOutOfStock(productDetails)) {
      setError('This product is currently out of stock.');
      return;
    }
    const currentQty = cartQuantities[productId] || 0;
    const nextQty = Math.max(0, currentQty + delta);
    if (stock !== null && Number.isFinite(stock) && nextQty > stock) {
      const available = Math.max(0, stock - currentQty);
      setError(available > 0 ? `Only ${available} item${available === 1 ? '' : 's'} left in stock.` : 'This product is currently out of stock.');
      return;
    }
    setCartQuantities((prev) => {
      if (nextQty <= 0) {
        const updated = { ...prev };
        delete updated[productId];
        return updated;
      }
      return { ...prev, [productId]: nextQty };
    });
    syncCartWithQuantity(productId, nextQty, productDetails || product);

    if (!authToken) return;
    try {
      if (delta > 0) {
        const response = await requestJson('/api/cart/add/', { method: 'POST', body: JSON.stringify({ product_id: productId, quantity: delta }) }, authToken);
        if (!response.ok) {
          const message = getApiErrorMessage(response.data, 'Unable to update cart quantity.');
          if (message.toLowerCase().includes('stock')) {
            await refreshProductById(productId);
            setError('This product has limited stock available. Please reduce the quantity and try again.');
          } else {
            setError(message);
          }
        }
      } else {
        const cartItem = (cart?.items || []).find((item: any) => Number(item.product_id ?? item.id) === Number(productId));
        if (!cartItem?.id) {
          await refreshServerCart(authToken);
          return;
        }
        const opId = String(cartItem.id);
        if (cartOpsRef.current[opId]) {
          console.log('[CART] update skipped, op already in-flight for', opId);
          return;
        }
        cartOpsRef.current[opId] = true;
        try {
          const response = await requestJson('/api/cart/update/', { method: 'PATCH', body: JSON.stringify({ cart_item_id: cartItem.id, quantity: nextQty }) }, authToken);
          if (response.ok) applyServerCart(response.data);
          else setError(getApiErrorMessage(response.data, 'Unable to update cart quantity.'));
        } finally {
          delete cartOpsRef.current[opId];
        }
      }
      await refreshServerCart(authToken);
    } catch {
      setError('Unable to sync cart to server right now.');
    }
  };

  const removeFromCart = async (productId: number, product?: any) => {
    console.log('[CART] removeFromCart called for', productId);
    // Optimistically remove locally
    setCartQuantities((prev) => {
      const updated = { ...prev };
      delete updated[productId];
      return updated;
    });
    syncCartWithQuantity(productId, 0, product);
    console.log('[CART] local cart after remove:', cart);

    if (!authToken) return;
    try {
      const cartItem = (cart?.items || []).find((item: any) => Number(item.product_id ?? item.id) === Number(productId));
      console.log('[CART] server sync attempt for cartItem:', cartItem);
      if (!cartItem?.id) {
        // If we don't have a cart_item id, just refresh from server and return
        await refreshServerCart(authToken);
        return;
      }
      const opId = String(cartItem.id);
      if (cartOpsRef.current[opId]) {
        console.log('[CART] remove skipped, op already in-flight for', opId);
        return;
      }
      cartOpsRef.current[opId] = true;
      // Try update to zero quantity first
      try {
        const response = await requestJson('/api/cart/update/', { method: 'PATCH', body: JSON.stringify({ cart_item_id: cartItem.id, quantity: 0 }) }, authToken);
        console.log('[CART] update->0 response:', response);
        if (response.ok) {
          console.log('[CART] server update->0 ok, applying server cart');
          applyServerCart(response.data);
          // Ensure server truly removed it; refresh and check
          const after = await refreshServerCart(authToken);
          const stillPresent = (after.data?.items || []).some((it: any) => Number(it.product_id ?? it.id) === Number(productId));
          if (stillPresent) {
            console.log('[CART] item still present after update->0, attempting DELETE fallback for cart_item id', cartItem.id);
            const del = await requestJson(`/api/cart/remove/${cartItem.id}/`, { method: 'DELETE' }, authToken);
            console.log('[CART] DELETE fallback response:', del);
            if (del.ok) {
              console.log('[CART] DELETE fallback ok, refreshing cart');
              await refreshServerCart(authToken);
            } else {
              console.warn('[CART] DELETE fallback failed', del);
            }
          }
        } else {
          console.warn('[CART] server update->0 failed', response);
          // Try explicit remove endpoint as fallback
          const del = await requestJson(`/api/cart/remove/${cartItem.id}/`, { method: 'DELETE' }, authToken);
          console.log('[CART] DELETE fallback response:', del);
          if (del.ok) {
            console.log('[CART] DELETE fallback ok, applying server cart');
            await refreshServerCart(authToken);
          } else {
            setError(getApiErrorMessage(response.data, 'Unable to remove item from cart.'));
            await refreshServerCart(authToken);
          }
        }
      } finally {
        delete cartOpsRef.current[opId];
      }
    } catch (err) {
      setError('Unable to sync cart to server right now.');
    }
  };

  const cartCount = (cart?.items || []).reduce((sum: number, item: any) => sum + Number(item.quantity || 1), 0);
  const getCartItemTotal = (item: any) => Number(item?.quantity || 1) * Number(item?.price ?? item?.selling_price ?? item?.product?.selling_price ?? 0);
  const cartSubtotal = (cart?.items || []).reduce((sum: number, item: any) => sum + getCartItemTotal(item), 0);

  const isAuthenticated = Boolean(authToken);
  const profileName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Guest User';
  const profileEmail = profile?.email || 'guest@growsalon.com';
  const profilePhone = profile?.phone_number || '+256 700 123 456';
  const orderCount = orders.length;
  const wishlistCount = wishlist.length;
  const addressCount = savedAddresses.length || (profile?.address ? 1 : 0);
  const reviewCount = 0;
  const filteredOrders = selectedOrderStatus === 'All'
    ? orders
    : orders.filter((order) => (order.order_status || '').toLowerCase() === selectedOrderStatus.toLowerCase());
  const selectedOrder = orders.find((order) => order.id === selectedOrderId) || null;

  const handleImagePicker = () => {
    Alert.alert('Photo picker', 'Expo image picker would open here to change your profile photo.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Use photo', onPress: () => setProfilePhoto('https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80') },
    ]);
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => {
          setActiveTab('Home');
          setProfileRoute('profile');
          setProfilePhoto(null);
          setAuthToken(null);
          setProfile(null);
          setOrders([]);
          try {
            await AsyncStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
          } catch (err) {
            console.warn('[AUTH] Failed to remove auth token', err);
          }
        } },
    ]);
  };

  const requireAuthenticatedCheckout = () => {
    if (!isAuthenticated) {
      setCheckoutNotice({ type: 'error', message: 'Sign in to place your order.' });
      setProfileAuthMode('login');
      setProfileAuthError(null);
      setPostLoginRoute('checkout');
      setActiveTab('Settings');
      setProfileRoute('login');
      return false;
    }
    return true;
  };

  // Orders are only confirmed after the signed-in customer's cart has been
  // accepted by the server; guests are directed to sign in first.
  const confirmCheckoutAuth = async (): Promise<boolean> => {
    if (isAuthenticated) return true;
    requireAuthenticatedCheckout();
    return false;
  };

  const requireAuthenticatedOrders = () => {
    if (isAuthenticated) return true;
    setProfileAuthMode('login');
    setProfileAuthError(null);
    setPostLoginRoute('orders');
    setActiveTab('Settings');
    setProfileRoute('login');
    return false;
  };

  const submitPasswordRecovery = async () => {
    setProfileAuthError(null);
    setProfileAuthLoading(true);
    try {
      if (!recoveryUid || !recoveryToken) {
        if (!recoveryIdentifier.trim()) {
          setProfileAuthError('Enter the email address or phone number on your account.');
          return;
        }
        const response = await requestJson('/api/auth/forgot-password/', {
          method: 'POST',
          body: JSON.stringify({ identifier: recoveryIdentifier.trim() }),
        });
        if (!response.ok) {
          setProfileAuthError(getApiErrorMessage(response.data, 'We could not start your password reset.'));
          return;
        }
        if (!response.data?.uid || !response.data?.token) {
          setProfileAuthError('If an account matches those details, password reset instructions will be available shortly.');
          return;
        }
        setRecoveryUid(response.data.uid);
        setRecoveryToken(response.data.token);
        return;
      }

      if (recoveryPassword.length < 8) {
        setProfileAuthError('Use at least 8 characters for your new password.');
        return;
      }
      if (recoveryPassword !== recoveryPasswordConfirm) {
        setProfileAuthError('The two new passwords do not match.');
        return;
      }
      const response = await requestJson('/api/auth/reset-password/', {
        method: 'POST',
        body: JSON.stringify({ uid: recoveryUid, token: recoveryToken, new_password: recoveryPassword, confirm_password: recoveryPasswordConfirm }),
      });
      if (!response.ok) {
        setProfileAuthError(getApiErrorMessage(response.data, 'We could not reset your password. Please try again.'));
        return;
      }
      setShowPasswordRecovery(false);
      setRecoveryUid('');
      setRecoveryToken('');
      setRecoveryPassword('');
      setRecoveryPasswordConfirm('');
      setProfileAuthMode('login');
      setProfileAuthError('Password updated. Sign in with your new password.');
    } finally {
      setProfileAuthLoading(false);
    }
  };

  const submitProfileAuth = async () => {
    const isLogin = profileAuthMode === 'login';
    const email = profileAuthEmail.trim();
    const password = profileAuthPassword;
    setProfileAuthError(null);

    if (!password || (!isLogin && (!profileAuthFirstName.trim() || !profileAuthLastName.trim() || !profileAuthSalonName.trim() || !profileAuthDistrict || !profileAuthVillage || (!email && !profileAuthPhone.trim())))) {
      setProfileAuthError(isLogin ? 'Enter your email or phone number and password.' : 'Enter your salon details, password, and at least an email address or phone number.');
      return;
    }

    setProfileAuthLoading(true);
    try {
      const response = isLogin
        ? await requestJson('/api/auth/login/', { method: 'POST', body: JSON.stringify({ email_or_phone: email, password }) })
        : await requestJson('/api/auth/register/', { method: 'POST', body: JSON.stringify({
            first_name: profileAuthFirstName.trim(),
            last_name: profileAuthLastName.trim(),
            email,
            phone_number: profileAuthPhone.trim(),
            password,
            salon_name: profileAuthSalonName.trim(),
            location: formatDeliveryLocation(profileAuthDistrict, profileAuthVillage),
            district: profileAuthDistrict,
            village: profileAuthVillage,
          }) });

      if (!response.ok) {
        setProfileAuthError(getApiErrorMessage(response.data, isLogin ? 'Login failed. Check your details and try again.' : 'Account creation failed. Try again.'));
        return;
      }

      const token = response.data?.access;
      if (!token) {
        setProfileAuthError(isLogin ? 'Login succeeded but no access token was returned.' : 'Account created but could not sign you in. Please sign in.');
        return;
      }

      setAuthToken(token);
      await AsyncStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
      await loadHomeData(false, token);
      if (!isLogin) {
        setProfileAuthFirstName('');
        setProfileAuthLastName('');
        setProfileAuthPhone('');
        setProfileAuthSalonName('');
        setProfileAuthDistrict('');
        setProfileAuthVillage('');
        setProfileAuthEmail('');
      }
      setProfileAuthPassword('');
      if (postLoginRoute === 'orders') {
        setActiveTab('Orders');
        setProfileRoute('profile');
      } else {
        setProfileRoute(postLoginRoute);
      }
      setPostLoginRoute('profile');
    } catch (error: any) {
      setProfileAuthError(error?.message || 'Unable to connect. Please try again.');
    } finally {
      setProfileAuthLoading(false);
    }
  };

  const syncLocalCartToBackend = async (items: any[]) => {
    if (!authToken || !items.length) return true;

    for (const item of items) {
      const productId = Number(item.product_id ?? item.id);
      const requestedQty = Number(item.quantity || 1);
      const existingCartQty = Number((cart?.items || []).find((cartItem: any) => Number(cartItem.product_id ?? cartItem.id) === productId)?.quantity || 0);
      const productDetails = products.find((product: any) => Number(product.id) === productId);
      const stock = productDetails ? getProductStockQuantity(productDetails) : null;

      if (stock !== null && Number.isFinite(stock) && existingCartQty + requestedQty > stock) {
        console.warn('[CART] skipping sync for product with insufficient stock', { productId, requestedQty, existingCartQty, stock });
        setError(existingCartQty > 0 ? `Only ${Math.max(0, stock - existingCartQty)} item${Math.max(0, stock - existingCartQty) === 1 ? '' : 's'} left in stock.` : 'This product is currently out of stock.');
        return false;
      }

      const payload = {
        product_id: productId,
        quantity: requestedQty,
      };

      const res = await requestJson('/api/cart/add/', { method: 'POST', body: JSON.stringify(payload) }, authToken);
      if (!res.ok) {
        console.error('cart sync failed', payload, res);
        setError(getApiErrorMessage(res.data, 'Unable to sync cart to server right now.'));
        return false;
      }
    }

    return true;
  };

  const renderCategoriesScreen = () => {
    const isBrandMode = catalogMode === 'brand';
    const catalogItems = isBrandMode ? brands : categories;
    const allLabel = isBrandMode ? 'All Brands' : 'All Categories';
    const selectedLabel = isBrandMode ? selectedBrand : selectedCategory;
    const selectedId = isBrandMode ? selectedBrandId : selectedCategoryId;
    const sidebarItems = [
      { id: null, title: allLabel, imageUrl: 'https://images.unsplash.com/photo-1527799820379-db61410e8c2e?auto=format&fit=crop&w=200&q=80', iconColor: '#F5821F', iconBg: 'rgba(245,130,31,0.16)' },
      ...catalogItems.map((item) => {
        const title = item.category_name || item.brand_name || item.name;
        const visual = getCategoryIconVisual(title);
        return { id: String(item.id ?? item.category_id ?? item.brand_id ?? title), title, imageUrl: getCategoryImageUrl(item, visual.imageUrl), iconColor: visual.color, iconBg: visual.bgColor };
      }),
    ];

    const productsForCatalog = products.filter((product: any) => {
      if (selectedLabel === allLabel) return true;
      return productMatchesCatalogItem(product, {
        id: selectedId,
        category_name: isBrandMode ? undefined : selectedLabel,
        brand_name: isBrandMode ? selectedLabel : undefined,
      }, isBrandMode ? 'brand' : 'category');
    });

    let filteredCategoryProducts = productsForCatalog.filter((product: any) => matchesProductSearch(product, searchTerm));

    // Apply availability filter from the new dropdown control
    if (categoryFilterMode === 'in_stock') {
      filteredCategoryProducts = filteredCategoryProducts.filter((p: any) => !isProductOutOfStock(p));
    } else if (categoryFilterMode === 'out_of_stock') {
      filteredCategoryProducts = filteredCategoryProducts.filter((p: any) => isProductOutOfStock(p));
    }

    const sortedCategoryProducts = [...filteredCategoryProducts].sort((a: any, b: any) => {
      if (categorySortMode === 'price') {
        return Number(b.selling_price ?? 0) - Number(a.selling_price ?? 0);
      }
      if (categorySortMode === 'name') {
        return (a.product_name || '').localeCompare(b.product_name || '');
      }
      return 0;
    });

    const catalogDescription = selectedLabel === allLabel
      ? `Discover premium salon essentials from every ${isBrandMode ? 'brand' : 'category'}.`
      : `Browse all products from ${selectedLabel}.`;
    const featuredProducts = sortedCategoryProducts.slice(0, 3);
    const sortOptions = [
      { key: 'featured' as const, label: 'Featured' },
      { key: 'price' as const, label: 'Price' },
      { key: 'name' as const, label: 'A–Z' },
    ];

    return (
      <View style={styles.categoryPage}>
        <View style={[styles.screenHeaderNavy, { paddingVertical: 18, minHeight: 84, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}>
          <TouchableOpacity style={[styles.sidebarToggleButton, { marginRight: 8 }]} onPress={() => setShowSidebar((s) => !s)} accessibilityRole="button">
            <Text style={styles.sidebarToggleText}>{showSidebar ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { fontSize: 20, fontWeight: '800' }]}>{isBrandMode ? 'Brands' : 'Categories'}</Text>
          <TouchableOpacity style={[styles.headerIconButton, { backgroundColor: 'transparent', borderWidth: 0, width: 36, height: 36 }]} onPress={openCartScreen}>
            <Text style={styles.headerIconText}>🛒</Text>
            {cartCount > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{cartCount}</Text></View> : null}
          </TouchableOpacity>
        </View>

        <View style={styles.categorySplitView}>
          {showSidebar ? (
            <ScrollView
              style={styles.categorySidebar}
              contentContainerStyle={styles.categorySidebarContent}
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
              {sidebarItems.map((item, index) => {
                const active = item.title === selectedLabel;
                return (
                  <TouchableOpacity key={getListItemKey(item, index, 'sidebar-catalog')} style={[styles.sidebarRow, active && styles.sidebarRowActive]} onPress={() => {
                    if (isBrandMode) {
                      setSelectedBrand(item.title);
                      setSelectedBrandId(item.id);
                    } else {
                      setSelectedCategory(item.title);
                      setSelectedCategoryId(item.id);
                    }
                  }}>
                    <View style={[styles.sidebarIconBadge, { backgroundColor: item.iconBg }]}> 
                      <Image source={{ uri: item.imageUrl }} style={styles.sidebarIconImage} />
                    </View>
                    <Text style={[styles.sidebarLabel, active && styles.sidebarLabelActive]} numberOfLines={2}>{item.title}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : null}
          <View style={styles.categoryContentArea}>
            <View style={styles.categoryIntroCard}>
              <View style={styles.categoryIntroHeaderRow}>
                <View style={styles.categoryIntroTextBlock}>
                  <Text style={styles.sectionTitle}>{selectedLabel}</Text>
                  <Text style={styles.categoryIntroText}>{catalogDescription}</Text>
                </View>
                  <View style={styles.categoryIntroMetaWrap}>
                  <View style={styles.categoryIntroSearchBox}>
                    <TextInput
                      style={styles.categoryIntroSearchInput}
                      placeholder="Search..."
                      placeholderTextColor="#9CA3AF"
                      value={searchTerm}
                      onChangeText={setSearchTerm}
                    />
                  </View>
                    <View style={styles.categoryIntroChipDropdown}>
                      <Text style={styles.categoryIntroChipIcon}>📁</Text>
                      <TouchableOpacity style={styles.categoryIntroChipButton} onPress={() => setCategoryFilterOpen(true)}>
                        <Text style={styles.categoryIntroChipText}>{categoryFilterMode === 'all' ? 'All products' : categoryFilterMode === 'in_stock' ? 'In stock' : 'Out of stock'}</Text>
                      </TouchableOpacity>
                      <Modal visible={categoryFilterOpen} transparent animationType="fade" onRequestClose={() => setCategoryFilterOpen(false)}>
                        <View style={styles.locationModalOverlay}>
                          <View style={[styles.locationModalCard, { width: 280 }] }>
                            <Text style={styles.locationModalTitle}>Filter products</Text>
                            <TouchableOpacity style={styles.locationOption} onPress={() => { setCategoryFilterMode('all'); setCategoryFilterOpen(false); }}>
                              <Text style={styles.locationOptionText}>All products</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.locationOption} onPress={() => { setCategoryFilterMode('in_stock'); setCategoryFilterOpen(false); }}>
                              <Text style={styles.locationOptionText}>In stock</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.locationOption} onPress={() => { setCategoryFilterMode('out_of_stock'); setCategoryFilterOpen(false); }}>
                              <Text style={styles.locationOptionText}>Out of stock</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.secondaryButton} onPress={() => setCategoryFilterOpen(false)}>
                              <Text style={styles.secondaryButtonText}>Cancel</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </Modal>
                    </View>
                </View>
              </View>
            </View>

            <View style={styles.categoryFilterRow}>
              {sortOptions.map((option) => {
                const active = categorySortMode === option.key;
                return (
                  <TouchableOpacity key={option.key} style={[styles.categoryFilterChip, active && styles.categoryFilterChipActive]} onPress={() => setCategorySortMode(option.key)}>
                    <Text style={[styles.categoryFilterChipText, active && styles.categoryFilterChipTextActive]}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {selectedLabel === allLabel ? (
              <ScrollView contentContainerStyle={styles.productGrid} showsVerticalScrollIndicator={false}>
                {catalogItems.map((item: any, index: number) => {
                  const title = item.category_name || item.brand_name || item.name;
                  const imageUrl = getCategoryImageUrl(item, getCategoryIconVisual(title).imageUrl);
                  return (
                    <TouchableOpacity key={getListItemKey(item, index, 'catalog-item')} style={styles.productGridCard} onPress={() => {
                      if (isBrandMode) {
                        setSelectedBrand(title);
                        setSelectedBrandId(String(item.id ?? item.brand_id ?? item.category_id ?? title));
                      } else {
                        setSelectedCategory(title);
                        setSelectedCategoryId(String(item.id ?? item.category_id ?? item.brand_id ?? title));
                      }
                    }}>
                      <CatalogImage uri={imageUrl} style={styles.productGridImage} />
                      <View style={styles.productGridContent}>
                        <Text style={styles.productGridName} numberOfLines={2}>{title}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <ScrollView contentContainerStyle={styles.gridContent} showsVerticalScrollIndicator={false}>
                {sortedCategoryProducts.length ? (
                  <>
                    <View style={styles.featuredStrip}>
                      <View style={styles.featuredStripContent}>
                        <Text style={styles.featuredStripTitle}>Spotlight picks</Text>
                        <Text style={styles.featuredStripText}>A refined selection designed to feel effortless to browse.</Text>
                      </View>
                      <View style={styles.featuredStripPills}>
                        {featuredProducts.map((item: any, index: number) => (
                          <View key={getListItemKey(item, index, 'featured-product')} style={styles.featuredStripPill}>
                            <Text style={styles.featuredStripPillText}>{item.product_name}</Text>
                          </View>
                        ))}
                      </View>
                    </View>

                    <View style={styles.productGrid}>
                      {sortedCategoryProducts.map((item: any, index: number) => {
                        const isSaved = wishlist.some((entry: any) => entry.id === item.id);
                        const outOfStock = isProductOutOfStock(item);
                        return (
                          <TouchableOpacity key={getListItemKey(item, index, 'category-product')} style={styles.productGridCard} onPress={() => openProductDetail(item)}>
                            <CatalogImage uri={getProductImageUrls(item)[0]} style={styles.productGridImage} />
                            <TouchableOpacity style={styles.favoriteButton} onPress={() => toggleWishlist(item)}>
                              <Text style={styles.favoriteButtonText}>{isSaved ? '♥' : '♡'}</Text>
                            </TouchableOpacity>
                            <View style={styles.productGridContent}>
                              <View style={styles.productGridMetaRow}>
                                <View style={styles.productGridBadge}>
                                  <Text style={styles.productGridBadgeText} numberOfLines={1}>{selectedLabel}</Text>
                                </View>
                                <Text style={[styles.productGridDeliveryText, outOfStock && styles.outOfStockText]} numberOfLines={1}>{outOfStock ? 'Out of stock' : 'In stock'}</Text>
                              </View>
                              <Text style={styles.productGridName} numberOfLines={2}>{item.product_name}</Text>
                              <Text style={styles.productGridPrice} numberOfLines={1}>UGX {Number(item.selling_price ?? 0).toLocaleString('en-US')}</Text>
                              <TouchableOpacity disabled={outOfStock} style={[styles.productGridCartButton, outOfStock && styles.productGridCartButtonDisabled]} onPress={(event: any) => { event?.stopPropagation?.(); handleAddToCart(item.id, 1, item); }}>
                                <Text style={styles.productGridCartButtonText}>{outOfStock ? 'Out of stock' : 'Add to cart'}</Text>
                              </TouchableOpacity>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                ) : (
                  <View style={styles.emptyStateCard}>
                    <Text style={styles.emptyStateTitle}>No products found</Text>
                    <Text style={styles.emptyStateText}>Try another category or search term.</Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderOrdersScreen = () => {
    if (!isAuthenticated) {
      return (
        <View style={styles.ordersPage}>
          <View style={[styles.screenHeaderNavy, { paddingVertical: 18, minHeight: 84 }]}> 
            <Text style={[styles.headerTitle, { fontSize: 20, fontWeight: '800' }]}>My Orders</Text>
            <View style={{ width: 36, height: 36 }} />
          </View>
          <View style={[styles.emptyStateCard, { margin: 16 }]}>
            <Text style={styles.emptyStateTitle}>Sign in to view your orders</Text>
            <Text style={styles.emptyStateText}>Track deliveries, see order details, and retry an order securely from one place.</Text>
            <TouchableOpacity style={styles.ordersEmptyActionButton} onPress={requireAuthenticatedOrders}>
              <Text style={styles.ordersEmptyActionText}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    const filteredOrders = orders.filter((order: any) => {
      const matchesStatus = order._local || selectedOrderStatus === 'All' || (order.order_status || '').toLowerCase() === selectedOrderStatus.toLowerCase();
      const matchesSearch = matchesOrderSearch(order, orderSearch);
      return matchesStatus && matchesSearch;
    });

    const selectedOrder = selectedOrderId != null
      ? orders.find((order: any) => String(order.id) === String(selectedOrderId)) || null
      : null;

    const selectedOrderHeader = selectedOrder ? (() => {
      const orderDate = selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Pending';
      const selectedSalonName = selectedOrder.salon_name || selectedOrder.business_name || selectedOrder.salonName || selectedOrder.customer?.salon_name || 'Salon order';
      const selectedDeliveryAddress = selectedOrder.delivery_address || selectedOrder.address || selectedOrder.shipping_address || selectedOrder.deliveryAddress || selectedOrder.location || selectedOrder.customer_address || 'Delivery address pending';
      const trackingSteps = getOrderTrackingSteps(selectedOrder);
      const eta = getDeliveryEta(selectedOrder);
      const trackingHistory = getTrackingHistory(selectedOrder);
      const showTrackingHistory = (selectedOrder.order_status || '').toLowerCase() === 'delivered';
      const statusMessage = (selectedOrder.order_status || 'Pending').toLowerCase() === 'pending'
        ? 'Your order is awaiting seller confirmation.'
        : (selectedOrder.order_status || 'Pending').toLowerCase() === 'confirmed'
          ? 'Your seller has confirmed the order and packing will begin shortly.'
          : 'Track the current order progress below.';
      return (
        <View style={{ marginBottom: 12 }}>
          <View style={styles.orderDetailCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.detailNumber}>{selectedOrder.order_number || `#${selectedOrder.id}`}</Text>
                <Text style={styles.detailMeta}>{orderDate}</Text>
                <Text style={styles.detailMeta}>{selectedSalonName}</Text>
                <Text style={styles.detailMeta}>{selectedDeliveryAddress}</Text>
                <Text style={styles.detailMeta}>{selectedOrder.payment_method || 'Pay on Delivery'}</Text>
              </View>
              <TouchableOpacity style={styles.detailCloseButton} onPress={() => setSelectedOrderId(null)}>
                <Text style={styles.detailCloseButtonText}>×</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.detailTotal}>{formatCurrency(selectedOrder.total_amount ?? selectedOrder.total ?? 0)}</Text>
            <View style={[styles.statusBadge, getOrderStatusStyle(selectedOrder.order_status)]}>
              <Text style={styles.statusBadgeText}>{selectedOrder.order_status || 'Pending'}</Text>
            </View>
            <Text style={[styles.detailMeta, { marginTop: 8 }]}>{statusMessage}</Text>
          </View>

          <View style={styles.trackingCard}>
            <View style={styles.trackingHeaderRow}>
              <View>
                <Text style={styles.trackingTitle}>Delivery ETA</Text>
                <Text style={styles.trackingSubtitle}>{eta}</Text>
              </View>
              <View style={styles.etaBadge}>
                <Text style={styles.etaBadgeText}>Live</Text>
              </View>
            </View>
            {trackingSteps.map((step, index) => (
              <View key={`${step.title}-${index}`} style={styles.timelineRow}>
                <View style={[styles.timelineDot, step.active && styles.timelineDotActive]} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineTitle}>{step.title}</Text>
                  <Text style={styles.timelineDescription}>{step.description}</Text>
                </View>
              </View>
            ))}
          </View>

          {showTrackingHistory ? (
            <View style={styles.trackingCard}>
              <Text style={styles.trackingTitle}>Tracking history</Text>
              {trackingHistory.map((entry, index) => (
                <View key={`${entry.time}-${index}`} style={styles.historyRow}>
                  <Text style={styles.historyTime}>{entry.time}</Text>
                  <View style={styles.historyContent}>
                    <Text style={styles.timelineTitle}>{entry.event}</Text>
                    <Text style={styles.timelineDescription}>{entry.detail}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      );
    })() : null;

    const ordersListHeader = (
      <View style={{ paddingTop: 0, paddingBottom: 4 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterTabsRow} contentContainerStyle={styles.filterTabsContent}>
          {orderStatusTabs.map((tab) => {
            const active = tab === selectedOrderStatus;
            return (
              <TouchableOpacity key={tab} style={styles.filterTab} onPress={() => { setSelectedOrderId(null); setSelectedOrderStatus(tab); }}>
                <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>{tab}</Text>
                {active ? <View style={styles.filterTabUnderline} /> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <TextInput
            style={styles.inputField}
            value={orderSearch}
            onChangeText={setOrderSearch}
            placeholder="Search by order number"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="characters"
            returnKeyType="search"
          />
          {ordersError ? (
            <View style={[styles.ordersIntroCard, { marginTop: 12, backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
              <Text style={[styles.ordersIntroTitle, { color: '#B91C1C' }]}>Orders unavailable</Text>
              <Text style={styles.ordersIntroText}>{ordersError}</Text>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => { setOrdersPage(1); setOrdersHasMore(true); fetchOrders({ page: 1, refresh: true }); }}>
                <Text style={styles.secondaryButtonText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
        {selectedOrderHeader}
      </View>
    );

    return (
      <View style={styles.ordersPage}>
        <View style={[styles.screenHeaderNavy, { paddingVertical: 18, minHeight: 84, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}>
          <Text style={[styles.headerTitle, { fontSize: 20, fontWeight: '800' }]}>My Orders</Text>
          <View style={{ width: 36, height: 36 }} />
        </View>

        {ordersLoading && !ordersRefreshing && !orders.length ? (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <ActivityIndicator color="#F5821F" />
          </View>
        ) : null}

        <FlatList
          data={filteredOrders}
          keyExtractor={(item, index) => getListItemKey(item, index, 'order')}
          renderItem={renderOrderItem}
          contentContainerStyle={styles.orderListContent}
          ListHeaderComponent={ordersListHeader}
          refreshControl={<RefreshControl refreshing={ordersRefreshing} onRefresh={() => { setOrdersPage(1); setOrdersHasMore(true); fetchOrders({ page: 1, refresh: true }); }} tintColor="#F5821F" />}
          onMomentumScrollBegin={() => {
            ordersEndReachedDuringMomentumRef.current = false;
          }}
          onEndReached={() => {
            if (ordersEndReachedDuringMomentumRef.current || !ordersHasMore || ordersLoading || ordersRefreshing || ordersLoadingMore) {
              return;
            }
            ordersEndReachedDuringMomentumRef.current = true;
            const nextPage = ordersPage + 1;
            setOrdersPage(nextPage);
            fetchOrders({ page: nextPage });
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={ordersLoadingMore ? (
            <View style={styles.listFooter}>
              <ActivityIndicator color="#F5821F" />
              <Text style={styles.listFooterText}>Loading more orders…</Text>
            </View>
          ) : null}
          ListEmptyComponent={
            <View style={styles.emptyStateCard}>
              <Text style={styles.emptyStateTitle}>{orderSearch || selectedOrderStatus !== 'All' ? 'No orders match your search yet' : 'No orders yet'}</Text>
              <Text style={styles.emptyStateText}>{orderSearch || selectedOrderStatus !== 'All' ? 'Try a different order number or filter.' : 'Place an order and it will appear here with delivery updates.'}</Text>
              <TouchableOpacity style={styles.ordersEmptyActionButton} onPress={() => setActiveTab('Home')}>
                <Text style={styles.ordersEmptyActionText}>Shop now</Text>
              </TouchableOpacity>
            </View>
          }
        />
      </View>
    );
  };

  const renderProfileScreen = () => {
    const cartItems = Array.isArray(cart?.items) ? cart.items : [];

    if (!isAuthenticated && profileRoute === 'login') {
      const isLogin = profileAuthMode === 'login';
      const isRecovery = showPasswordRecovery;
      return (
        <ScrollView style={styles.profilePage} contentContainerStyle={styles.profilePageContent} keyboardShouldPersistTaps="handled">
          <View style={styles.profileHeaderBlock}>
            <View style={styles.profileHeaderRow}>
              <View style={styles.profileHeaderBack} />
              <Text style={styles.profileHeaderTitle}>My Profile</Text>
              <View style={styles.profileHeaderBack} />
            </View>
            <View style={styles.profileAuthLogoRow}>
              <Image source={{ uri: SPLASH_LOGO_URL }} style={styles.profileAuthLogo} resizeMode="contain" />
              <View>
                <Text style={styles.profileAuthBrand}>GLOW</Text>
                <Text style={styles.profileAuthBrandNote}>SALON SUPPLIES, DELIVERED.</Text>
              </View>
            </View>
            <Text style={styles.profileHeaderScreenTitle}>{isRecovery ? 'Reset your password' : isLogin ? 'Welcome back' : 'Create your account'}</Text>
            <Text style={styles.profileHeaderSubtitle}>{isRecovery ? 'Choose a new password to get back into Glow.' : isLogin ? 'Sign in and continue where you left off.' : 'Set up your salon in a few simple steps.'}</Text>
          </View>
          <View style={styles.profileAuthCard}>
            <View style={styles.profileAuthPill}><Text style={styles.profileAuthPillText}>{isRecovery ? 'ACCOUNT RECOVERY' : isLogin ? 'MEMBER ACCESS' : 'SALON SETUP'}</Text></View>
            <Text style={styles.profileAuthTitle}>{isRecovery ? (recoveryUid ? 'Choose a new password' : 'Find your account') : isLogin ? 'Sign in to Glow' : 'Make your salon account'}</Text>
            <Text style={styles.profileAuthText}>{isRecovery ? (recoveryUid ? 'Use a secure password that you have not used before.' : 'Enter the email address or phone number used when you created your account.') : isLogin ? 'Use the email address or phone number on your account.' : 'Your salon name and location help us deliver the right supplies to you.'}</Text>
            {isRecovery ? (
              <>
                {!recoveryUid ? (
                  <>
                    <Text style={styles.profileAuthFieldLabel}>EMAIL OR PHONE NUMBER</Text>
                    <TextInput style={styles.inputField} value={recoveryIdentifier} onChangeText={setRecoveryIdentifier} placeholder="Email address or phone number" autoCapitalize="none" placeholderTextColor="#94A3B8" />
                  </>
                ) : (
                  <>
                    <Text style={styles.profileAuthFieldLabel}>NEW PASSWORD</Text>
                    <View style={styles.passwordInputRow}>
                      <TextInput style={[styles.inputField, styles.passwordInput]} value={recoveryPassword} onChangeText={setRecoveryPassword} placeholder="At least 8 characters" secureTextEntry={!showRecoveryPassword} placeholderTextColor="#94A3B8" />
                      <TouchableOpacity style={styles.passwordToggleButton} onPress={() => setShowRecoveryPassword((value) => !value)}>
                        <Text style={styles.passwordToggleText}>{showRecoveryPassword ? 'Hide' : 'Show'}</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.profileAuthFieldLabel}>CONFIRM NEW PASSWORD</Text>
                    <View style={styles.passwordInputRow}>
                      <TextInput style={[styles.inputField, styles.passwordInput]} value={recoveryPasswordConfirm} onChangeText={setRecoveryPasswordConfirm} placeholder="Enter the password again" secureTextEntry={!showRecoveryConfirmPassword} placeholderTextColor="#94A3B8" />
                      <TouchableOpacity style={styles.passwordToggleButton} onPress={() => setShowRecoveryConfirmPassword((value) => !value)}>
                        <Text style={styles.passwordToggleText}>{showRecoveryConfirmPassword ? 'Hide' : 'Show'}</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </>
            ) : !isLogin ? (
              <>
                <Text style={styles.profileAuthFieldLabel}>YOUR NAME</Text>
                <View style={styles.profileAuthInlineFields}>
                  <TextInput style={[styles.inputField, styles.profileAuthHalfField]} value={profileAuthFirstName} onChangeText={setProfileAuthFirstName} placeholder="First name" placeholderTextColor="#94A3B8" />
                  <TextInput style={[styles.inputField, styles.profileAuthHalfField]} value={profileAuthLastName} onChangeText={setProfileAuthLastName} placeholder="Last name" placeholderTextColor="#94A3B8" />
                </View>
                <Text style={styles.profileAuthFieldLabel}>YOUR SALON</Text>
                <TextInput style={styles.inputField} value={profileAuthSalonName} onChangeText={setProfileAuthSalonName} placeholder="Salon name" placeholderTextColor="#94A3B8" />
                <Text style={styles.profileAuthFieldLabel}>SALON DELIVERY LOCATION</Text>
                <DeliveryLocationSelector district={profileAuthDistrict} village={profileAuthVillage} onDistrictChange={setProfileAuthDistrict} onVillageChange={setProfileAuthVillage} />
              </>
            ) : null}
            {!isRecovery ? <>
              <Text style={styles.profileAuthFieldLabel}>{isLogin ? 'EMAIL OR PHONE NUMBER' : 'HOW WE CAN REACH YOU'}</Text>
              <TextInput style={styles.inputField} value={profileAuthEmail} onChangeText={setProfileAuthEmail} placeholder={isLogin ? 'Email address or phone number' : 'Email address (optional)'} keyboardType={isLogin ? 'default' : 'email-address'} autoCapitalize="none" placeholderTextColor="#94A3B8" />
              {!isLogin ? <TextInput style={styles.inputField} value={profileAuthPhone} onChangeText={setProfileAuthPhone} placeholder="Phone number (optional)" keyboardType="phone-pad" placeholderTextColor="#94A3B8" /> : null}
              <Text style={styles.profileAuthFieldLabel}>PASSWORD</Text>
              <View style={styles.passwordInputRow}>
                <TextInput style={[styles.inputField, styles.passwordInput]} value={profileAuthPassword} onChangeText={setProfileAuthPassword} placeholder="At least 8 characters" secureTextEntry={!showProfilePassword} placeholderTextColor="#94A3B8" />
                <TouchableOpacity style={styles.passwordToggleButton} onPress={() => setShowProfilePassword((value) => !value)}>
                  <Text style={styles.passwordToggleText}>{showProfilePassword ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>
              {!isLogin ? <Text style={styles.profileAuthHint}>Enter an email address, phone number, or both. You can use either one to sign in.</Text> : null}
            </> : null}
            {profileAuthError ? <Text style={styles.profileAuthError}>{profileAuthError}</Text> : null}
            <TouchableOpacity style={styles.profileAuthPrimaryButton} onPress={isRecovery ? submitPasswordRecovery : submitProfileAuth} disabled={profileAuthLoading}>
              {profileAuthLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>{isRecovery ? (recoveryUid ? 'Reset password' : 'Continue') : isLogin ? 'Login' : 'Create account'}</Text>}
            </TouchableOpacity>
            {isLogin && !isRecovery ? <TouchableOpacity style={styles.forgotPasswordButton} onPress={() => { setShowPasswordRecovery(true); setProfileAuthError(null); }}>
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity> : null}
            <TouchableOpacity style={styles.profileAuthSecondaryButton} onPress={() => {
              if (isRecovery) {
                setShowPasswordRecovery(false); setRecoveryUid(''); setRecoveryToken(''); setProfileAuthError(null);
              } else {
                setProfileAuthMode(isLogin ? 'signup' : 'login'); setProfileAuthError(null);
              }
            }}>
              <Text style={styles.profileAuthSecondaryText}>{isRecovery ? 'Back to sign in' : isLogin ? 'Create an account' : 'I already have an account'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      );
    }

    if (!isAuthenticated && profileRoute === 'profile') {
      return (
        <ScrollView style={styles.profilePage} contentContainerStyle={styles.profilePageContent}>
          <View style={styles.profileHeaderBlock}>
            <View style={styles.profileHeaderRow}>
              <View style={styles.profileHeaderBack} />
              <Text style={styles.profileHeaderTitle}>My Account</Text>
              <View style={styles.profileHeaderBack} />
            </View>
            <Text style={styles.profileHeaderScreenTitle}>Browse as a guest</Text>
          </View>
          <View style={styles.profileAuthCard}>
            <Text style={styles.profileAuthTitle}>Welcome to Glow</Text>
            <Text style={styles.profileAuthText}>Explore products, save favorites, and build your cart freely. We will only ask you to sign in when you are ready to checkout.</Text>
            <TouchableOpacity style={styles.profileAuthPrimaryButton} onPress={() => setActiveTab('Home')}>
              <Text style={styles.primaryButtonText}>Continue shopping</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.profileAuthSecondaryButton} onPress={() => { setProfileAuthMode('login'); setProfileAuthError(null); setPostLoginRoute('profile'); setProfileRoute('login'); }}>
              <Text style={styles.profileAuthSecondaryText}>Sign in or create an account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      );
    }

    const detailedRoutes: Record<string, { title: string; body: string }> = {
      personal_information: { title: 'Personal Information', body: 'Update your name, email, and delivery details from here.' },
      change_password: { title: 'Change Password', body: 'Set a new password to keep your account protected.' },
      payment_methods: { title: 'Payment Methods', body: 'Manage your preferred payment method for salon orders.' },
      addresses: { title: 'Addresses', body: 'Add or update where your salon essentials should be delivered.' },
      help: { title: 'Help & Support', body: 'Contact Glow support for quick assistance with your orders.' },
      about: { title: 'About Glow', body: 'Learn more about Glow, our promises, and delivery policies.' },
      settings: { title: 'Settings', body: 'Fine-tune your app experience and privacy preferences.' },
      security: { title: 'Security & Privacy', body: 'Protect your account with verification, password recovery, and secure sign-in controls.' },
      favorites: { title: 'Favorites', body: 'Save your most-loved salon essentials for faster reordering.' },
    };

    if (profileRoute === 'favorites') {
      return (
          <View style={styles.profilePage}>
            <View style={styles.profileHeaderBlock}>
            <View style={styles.profileHeaderRow}>
              <View style={styles.profileHeaderBack} />
              <Text style={styles.profileHeaderTitle}>Favorites</Text>
              <View style={styles.profileHeaderBack} />
            </View>
            <Text style={styles.profileHeaderScreenTitle}>Saved for later</Text>
          </View>
          <View style={styles.profileDetailCard}>
            {wishlist.length ? wishlist.map((item: any) => (
              <View key={`favorite-${item.id}`} style={styles.favoriteItemCard}>
                <CatalogImage uri={getProductImageUrls(item)[0]} style={styles.favoriteItemImage} />
                <View style={styles.favoriteItemTextBlock}>
                  <Text style={styles.infoValue}>{item.product_name || item.name}</Text>
                  <Text style={styles.cartItemPrice}>UGX {Number(item.selling_price ?? item.price ?? 0).toLocaleString('en-US')}</Text>
                </View>
                <TouchableOpacity style={styles.secondaryButton} onPress={() => toggleWishlist(item)}>
                  <Text style={styles.secondaryButtonText}>Remove</Text>
                </TouchableOpacity>
              </View>
            )) : (
              <Text style={styles.profileDetailBody}>You have no favorites yet. Save products from the shop to build your personal salon essentials list.</Text>
            )}
          </View>
        </View>
      );
    }

    if (profileRoute === 'cart') {
      const subtotal = cartSubtotal;
      const deliveryFee = 0;
      const total = subtotal + deliveryFee;
      const combinedRecentlyViewed = deduplicateItems(
        [...recentlyViewed, ...wishlist.filter((item: any) => item && (item.product_name || item.name))],
        (item: any) => `${item.id || item.product_id || item.product_name || item.name || 'saved'}::${item.product_name || item.name || 'saved'}`
      ).slice(0, 6);

      return (
        <ScrollView style={styles.profilePage} contentContainerStyle={styles.profilePageContent} showsVerticalScrollIndicator={false}>
          <View style={styles.profileHeaderBlock}>
            <View style={styles.profileHeaderRow}>
              <View style={styles.profileHeaderBack} />
              <Text style={styles.profileHeaderTitle}>My Cart</Text>
              <View style={styles.profileHeaderBack} />
            </View>
            <Text style={styles.profileHeaderScreenTitle}>{cartItems.length ? `${cartItems.length} item${cartItems.length > 1 ? 's' : ''} ready` : 'Your basket is empty'}</Text>
          </View>
          <View style={styles.profileDetailCard}>
            {cartItems.length ? (
              <>
                <View style={styles.cartSummaryCard}>
                  <Text style={styles.cartSummaryTitle}>Checkout ready</Text>
                  <Text style={styles.cartSummarySubtitle}>Your selected salon essentials are waiting for delivery.</Text>
                </View>
                <View style={styles.cartListContainer}>
                  {cartItems.map((item: any, index: number) => (
                    <View key={getListItemKey(item, index, 'cart-item')} style={styles.cartItemCard}>
                      <CatalogImage uri={getProductImageUrls(item)[0]} style={styles.cartItemImage} />
                      <View style={styles.cartItemTextBlock}>
                        <Text style={styles.infoLabel}>Item {index + 1}</Text>
                        <Text style={styles.infoValue}>{item.product_name || `Product ${index + 1}`}</Text>
                        {item.price ? <Text style={styles.cartItemPrice}>UGX {Number(item.price).toLocaleString('en-US')}</Text> : null}
                      </View>
                      <View style={styles.cartStepperBox}>
                        <TouchableOpacity style={styles.stepperButton} onPress={(event: any) => { event?.stopPropagation?.(); adjustProductQuantity(item.product_id ?? item.id, -1, item); }}>
                          <Text style={styles.stepperButtonText}>−</Text>
                        </TouchableOpacity>
                        <Text style={styles.stepperValue}>{item.quantity || 1}</Text>
                        <TouchableOpacity style={styles.stepperButton} onPress={(event: any) => { event?.stopPropagation?.(); adjustProductQuantity(item.product_id ?? item.id, 1, item); }}>
                          <Text style={styles.stepperButtonText}>+</Text>
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity style={styles.secondaryButton} onPress={(event: any) => { event?.stopPropagation?.(); removeFromCart(item.product_id ?? item.id, item); }}>
                        <Text style={styles.secondaryButtonText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
                <View style={styles.checkoutSummaryCard}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Subtotal</Text>
                    <Text style={styles.summaryValue}>UGX {subtotal.toLocaleString('en-US')}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Delivery</Text>
                    <Text style={styles.summaryValue}>Free</Text>
                  </View>
                  <View style={styles.summaryRowStrong}>
                    <Text style={styles.summaryLabelStrong}>Total</Text>
                    <Text style={styles.summaryValueStrong}>UGX {total.toLocaleString('en-US')}</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.primaryButton} onPress={() => {
                  if (!requireAuthenticatedCheckout()) return;
                  setProfileRoute('checkout');
                }}>
                  <Text style={styles.primaryButtonText}>Checkout</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.emptyStateCard}>
                  <Text style={styles.emptyStateTitle}>Your cart is empty</Text>
                  <Text style={styles.emptyStateText}>Pick salon essentials from the home page and they will appear here with a clear checkout summary.</Text>
                </View>
                <TouchableOpacity style={styles.primaryButton} onPress={() => { setProfileRoute('profile'); setActiveTab('Home'); }}>
                  <Text style={styles.primaryButtonText}>Start shopping</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
          {combinedRecentlyViewed.length ? (
            <View style={styles.recentlyViewedSection}>
              <Text style={styles.recentlyViewedTitle}>Recently viewed</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentlyViewedList}>
                {combinedRecentlyViewed.map((item: any, index: number) => (
                  <TouchableOpacity key={getListItemKey(item, index, 'cart-recently-viewed')} style={styles.recentlyViewedCard} onPress={() => openProductDetail(item)}>
                    <CatalogImage uri={getProductImageUrls(item)[0]} style={styles.recentlyViewedImage} />
                    <Text style={styles.recentlyViewedName} numberOfLines={2}>{item.product_name || item.name}</Text>
                    <Text style={styles.recentlyViewedPrice}>UGX {Number(item.selling_price ?? item.price ?? 0).toLocaleString('en-US')}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </ScrollView>
      );
    }

    if (profileRoute === 'checkout') {
      const subtotal = cartSubtotal;
      const deliveryFee = 0;
      const total = subtotal + deliveryFee;

      if (!isAuthenticated) {
        return (
          <View style={styles.profilePage}>
            <View style={styles.profileHeaderBlock}>
              <View style={styles.profileHeaderRow}>
                <View style={styles.profileHeaderBack} />
                <Text style={styles.profileHeaderTitle}>Checkout</Text>
                <View style={styles.profileHeaderBack} />
              </View>
              <Text style={styles.profileHeaderScreenTitle}>One quick step first</Text>
            </View>
            <View style={styles.checkoutAuthCard}>
              <Text style={styles.checkoutAuthIcon}>🔒</Text>
              <Text style={styles.checkoutAuthTitle}>Sign in to continue</Text>
              <Text style={styles.checkoutAuthText}>Your cart is saved. Sign in securely and we will bring you straight back to checkout.</Text>
              <TouchableOpacity style={styles.checkoutConfirmButton} onPress={requireAuthenticatedCheckout}>
                <Text style={styles.primaryButtonText}>Sign in to checkout</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }

      return (
        <View style={styles.profilePage}>
          <View style={styles.profileHeaderBlock}>
            <View style={styles.profileHeaderRow}>
              <View style={styles.profileHeaderBack} />
              <Text style={styles.profileHeaderTitle}>Checkout</Text>
              <View style={styles.profileHeaderBack} />
            </View>
            <Text style={styles.profileHeaderScreenTitle}>Secure checkout</Text>
          </View>
          <ScrollView contentContainerStyle={styles.checkoutPageContent} showsVerticalScrollIndicator={false}>
            <View style={styles.checkoutProgressRow}>
              <View style={[styles.checkoutProgressStep, styles.checkoutProgressStepActive]}><Text style={styles.checkoutProgressNumber}>1</Text><Text style={styles.checkoutProgressLabel}>Details</Text></View>
              <View style={styles.checkoutProgressLine} />
              <View style={styles.checkoutProgressStep}><Text style={styles.checkoutProgressNumber}>2</Text><Text style={styles.checkoutProgressLabel}>Confirm</Text></View>
            </View>
            <View style={styles.profileDetailCard}>
              <View style={styles.checkoutIntroCard}>
                <Text style={styles.checkoutIntroTitle}>Items ready for delivery</Text>
                <View style={styles.checkoutItemsList}>
                  {cartItems.map((item: any, index: number) => {
                    const productName = item.product_name || item.name || `Item ${index + 1}`;
                    const imageUri = getProductImageUrls(item)[0] || 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=400&q=80';
                    return (
                      <View key={`${productName}-${index}`} style={styles.checkoutItemRow}>
                        <Image source={{ uri: imageUri }} style={styles.checkoutItemImage} resizeMode="cover" />
                        <View style={styles.checkoutItemTextWrap}>
                          <Text style={styles.checkoutItemName} numberOfLines={2}>{productName}</Text>
                          <Text style={styles.checkoutItemMeta}>Qty {item.quantity || 1}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
                <Text style={styles.checkoutIntroText}>Your order is securely sent to the seller for confirmation.</Text>
              </View>
              <View style={styles.checkoutSectionHeader}><Text style={styles.checkoutSectionTitle}>Delivery address</Text><Text style={styles.checkoutSectionStatus}>Required</Text></View>
              <View style={styles.addressCard}>
                <Text style={styles.infoValue}>{profile?.first_name || 'Customer'} {profile?.last_name || ''}</Text>
                <Text style={styles.infoLabel}>{profile?.phone_number || '+256 700 123 456'}</Text>
                <Text style={styles.addressText}>{deliveryAddress || 'Choose a delivery address to continue.'}</Text>
                <TouchableOpacity style={styles.secondaryButton} onPress={() => openAddresses('checkout')}>
                  <Text style={styles.secondaryButtonText}>{deliveryAddress ? 'Change address' : 'Add delivery address'}</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.checkoutSectionHeader, { marginTop: 20 }]}><Text style={styles.checkoutSectionTitle}>Payment method</Text><Text style={styles.checkoutSectionStatus}>Selected</Text></View>
              {checkoutNotice ? (
                <View style={[styles.checkoutNoticeBox, checkoutNotice.type === 'error' ? styles.checkoutNoticeError : styles.checkoutNoticeSuccess]}>
                  <Text style={styles.checkoutNoticeText}>{checkoutNotice.message}</Text>
                </View>
              ) : null}
              <View style={styles.paymentCard}>
                <Text style={styles.paymentLabel}>Available option</Text>
                <View style={styles.paymentOptionRow}>
                  <View>
                    <Text style={styles.paymentMethodTitle}>{paymentMethod}</Text>
                    <Text style={styles.paymentMethodSubtitle}>Pay when the rider delivers your package</Text>
                  </View>
                  <View style={styles.paymentBadge}>
                    <Text style={styles.paymentBadgeText}>Selected</Text>
                  </View>
                </View>
              </View>
              <View style={styles.orderSummaryCard}>
                <Text style={styles.orderSummaryTitle}>Order summary</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Subtotal</Text>
                  <Text style={styles.summaryValue}>UGX {subtotal.toLocaleString('en-US')}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Delivery fee</Text>
                  <Text style={styles.summaryValue}>Free</Text>
                </View>
                <View style={styles.summaryRowStrong}>
                  <Text style={styles.summaryLabelStrong}>Total</Text>
                  <Text style={styles.summaryValueStrong}>UGX {total.toLocaleString('en-US')}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.checkoutConfirmButton} onPress={async () => {
                const proceedAuth = await confirmCheckoutAuth();
                if (!proceedAuth) return;

                const normalizedItems = (cart?.items || []).filter((item: any) => Number(item.quantity || 1) > 0);
                const hasValidQuantity = normalizedItems.every((item: any) => Number(item.quantity || 1) >= 1);
                let selectedAddress = savedAddresses.find((entry: any) => String(entry.id) === String(selectedAddressId));
                if (!selectedAddress && savedAddresses.length) {
                  selectedAddress = savedAddresses[0];
                  setSelectedAddressId(String(selectedAddress.id));
                }
                if (!selectedAddress && profile) {
                  const derivedAddresses = deriveSavedAddressesFromProfile(profile);
                  if (derivedAddresses.length) {
                    setSavedAddresses(derivedAddresses);
                    selectedAddress = derivedAddresses[0];
                    setSelectedAddressId(String(selectedAddress.id));
                  }
                }
                const trimmedAddress = formatDeliveryLocation(selectedAddress?.district || '', selectedAddress?.village || '');
                const checkoutPhone = String(selectedAddress?.phone || profile?.phone_number || '').trim();
                console.log('[CHECKOUT] selectedAddressId:', selectedAddressId, 'selectedAddress:', selectedAddress, 'savedAddresses:', savedAddresses);
                const trimmedPayment = paymentMethod.trim();

                if (!normalizedItems.length) {
                  setCheckoutNotice({ type: 'error', message: 'Your cart is empty. Add at least one item before checking out.' });
                  return;
                }

                if (!hasValidQuantity) {
                  setCheckoutNotice({ type: 'error', message: 'Please confirm each item quantity before placing the order.' });
                  return;
                }

                if (!selectedAddress || !trimmedAddress) {
                  setCheckoutNotice({ type: 'error', message: 'Please choose a district and village or area before confirming.' });
                  return;
                }

                if (!checkoutPhone) {
                  setCheckoutNotice({ type: 'error', message: 'Add a contact phone number to your delivery address before confirming.' });
                  return;
                }

                if (!trimmedPayment) {
                  setCheckoutNotice({ type: 'error', message: 'Please choose a payment method before confirming.' });
                  return;
                }

                const orderItems = normalizedItems.map((item: any) => ({
                  id: item.product_id ?? item.id,
                  product_name: item.product_name || item.name,
                  quantity: Number(item.quantity || 1),
                  image_url: item.image_url || item.product_image || item.image || null,
                }));

                const cartSynced = await syncLocalCartToBackend(normalizedItems);
                if (!cartSynced) {
                  setCheckoutNotice({ type: 'error', message: 'We could not sync your cart to the server. Please try again.' });
                  return;
                }

                const newOrder = {
                  id: Date.now(),
                  order_number: `ORD${Math.floor(Math.random() * 900000 + 100000)}`,
                  created_at: new Date().toISOString(),
                  payment_method: trimmedPayment,
                  total_amount: total,
                  order_status: 'Pending',
                  _local: true,
                  items: orderItems,
                  image_urls: orderItems.map((item: any) => item.image_url).filter(Boolean),
                };

                // Optimistically show the order locally while we attempt to create it on the server
                setOrders((prev) => [...prev, newOrder]);

                if (authToken) {
                  try {
                    const payload = {
                      district: selectedAddress.district,
                      village: selectedAddress.village,
                      phone_number: checkoutPhone,
                      payment_method: mapPaymentMethodToApiValue(trimmedPayment),
                      notes: '',
                    };

                    const res = await requestJson('/api/orders/create/', { method: 'POST', body: JSON.stringify(payload) }, authToken);

                    if (res && (res.status === 201 || res.ok)) {
                      const serverOrder = res.data?.order || res.data;
                      // Replace the optimistic local order with the server-provided order
                      setOrders((prev) => (prev || []).map((o: any) => (o && o._local && o.order_number === newOrder.order_number) ? serverOrder : o));
                      setCart({ items: [] });
                      setCartFeedback('Order confirmed');
                      setCheckoutNotice({ type: 'success', message: `Order ${serverOrder.order_number} placed.` });
                      setProfileRoute('order_success');
                    } else {
                      // Mark the local order as errored so the user can retry
                      setOrders((prev) => (prev || []).map((o: any) => (o && o._local && o.order_number === newOrder.order_number) ? { ...o, _error: true } : o));
                      setCheckoutNotice({ type: 'error', message: res?.data?.detail || 'Unable to place order. Please try again.' });
                    }
                  } catch (err) {
                    console.error('create order error', err);
                    setOrders((prev) => (prev || []).map((o: any) => (o && o._local && o.order_number === newOrder.order_number) ? { ...o, _error: true } : o));
                    setCheckoutNotice({ type: 'error', message: 'Network error placing order. Please try again.' });
                  }
                } else {
                  // Guest flow: persist locally and show success screen
                  setCart({ items: [] });
                  setCartFeedback('Order saved locally');
                  setCheckoutNotice({ type: 'success', message: `Order ${newOrder.order_number} created locally. Sign in to submit to the seller.` });
                  setProfileRoute('order_success');
                }
              }}>
                <Text style={styles.primaryButtonText}>Checkout · UGX {total.toLocaleString('en-US')}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      );
    }

    if (profileRoute === 'addresses') {
      return (
        <View style={styles.profilePage}>
          <View style={styles.profileHeaderBlock}>
            <View style={styles.profileHeaderRow}>
              <View style={styles.profileHeaderBack} />
              <Text style={styles.profileHeaderTitle}>Delivery Addresses</Text>
              <View style={styles.profileHeaderBack} />
            </View>
            <Text style={styles.profileHeaderScreenTitle}>Choose where your orders should go</Text>
          </View>
          <ScrollView contentContainerStyle={styles.profileDetailCard} showsVerticalScrollIndicator={false}>
            <Text style={styles.infoLabel}>Saved addresses</Text>
              {savedAddresses.map((entry: any, index: number) => {
              const isSelected = String(entry.id) === String(selectedAddressId);
              const isEditing = String(editingAddressId) === String(entry.id);
              return (
                <View key={getListItemKey(entry, index, 'address')} style={[styles.addressOptionCard, isSelected && styles.addressOptionCardActive]}>
                  {isEditing ? (
                    <>
                      <View style={styles.addressOptionHeaderRow}>
                        <TextInput style={[styles.inputField, { flex: 1, marginRight: 8 }]} value={editingAddressLabel} onChangeText={setEditingAddressLabel} placeholder="Label (Home, Office)" placeholderTextColor="#9CA3AF" />
                        <View style={{ flexDirection: 'row' }}>
                          <TouchableOpacity style={[styles.primaryButton, { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 }]} onPress={() => saveEditedAddress(entry.id)}>
                            <Text style={styles.primaryButtonText}>Save</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.secondaryButton, { marginLeft: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 }]} onPress={cancelEditAddress}>
                            <Text style={styles.secondaryButtonText}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      <DeliveryLocationSelector
                        district={editingAddressDistrict}
                        village={editingAddressVillage}
                        onDistrictChange={setEditingAddressDistrict}
                        onVillageChange={setEditingAddressVillage}
                      />
                      <TextInput style={styles.inputField} value={editingAddressPhone} onChangeText={setEditingAddressPhone} placeholder="Phone number" placeholderTextColor="#9CA3AF" keyboardType="phone-pad" />
                    </>
                  ) : (
                    <TouchableOpacity style={{}} onPress={() => selectAddress(entry)}>
                      <View style={styles.addressOptionHeaderRow}>
                        <Text style={styles.infoValue}>{entry.label}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          {isSelected ? <View style={styles.addressBadge}><Text style={styles.addressBadgeText}>Selected</Text></View> : null}
                          <TouchableOpacity style={{ marginLeft: 8, padding: 6 }} onPress={() => startEditAddress(entry)}>
                            <Text style={{ fontSize: 14, color: '#9CA3AF' }}>✏️</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={{ marginLeft: 8, padding: 6 }} onPress={() => {
                            Alert.alert('Delete address', `Remove \"${entry.label}\" from your saved addresses?`, [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Delete', style: 'destructive', onPress: () => deleteAddress(entry.id) },
                            ]);
                          }}>
                            <Text style={{ fontSize: 14, color: '#9CA3AF' }}>🗑</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      {entry.address ? <Text style={styles.addressText}>{entry.address}</Text> : null}
                      {entry.phone ? <Text style={styles.infoLabel}>{entry.phone}</Text> : null}
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}

            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Add a new address</Text>
              <TextInput
                style={styles.inputField}
                value={newAddressLabel}
                onChangeText={setNewAddressLabel}
                placeholder="Label (Home, Office, Salon)"
                placeholderTextColor="#9CA3AF"
              />
              <DeliveryLocationSelector district={newAddressDistrict} village={newAddressVillage} onDistrictChange={setNewAddressDistrict} onVillageChange={setNewAddressVillage} />
              <Text style={styles.locationHint}>All Uganda districts are available. Search for a village or type its exact name.</Text>
              <TextInput
                style={styles.inputField}
                value={newAddressPhone}
                onChangeText={setNewAddressPhone}
                placeholder="Phone number"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
              />
              <TouchableOpacity style={styles.primaryButton} onPress={saveNewAddress}>
                <Text style={styles.primaryButtonText}>{savedAddresses.length >= 5 ? 'Address limit reached (5 of 5)' : `Save new address (${savedAddresses.length}/5)`}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.secondaryButton} onPress={() => {
              const chosen = savedAddresses.find((a: any) => String(a.id) === String(selectedAddressId)) || savedAddresses[0];
              if (chosen) {
                selectAddress(chosen);
                setProfile((prev: any) => (prev ? { ...prev, address: chosen.address || deliveryAddress, district: chosen.district || prev.district, village: chosen.village || prev.village, phone_number: chosen.phone || prev.phone_number } : prev));
              } else {
                setProfile((prev: any) => (prev ? { ...prev, address: deliveryAddress } : prev));
              }
              setProfileRoute(addressRouteReturnTarget);
            }}>
              <Text style={styles.secondaryButtonText}>Use this address</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      );
    }

    if (profileRoute === 'order_success') {
      return (
        <View style={styles.profilePage}>
          <View style={styles.profileHeaderBlock}>
            <View style={styles.profileHeaderRow}>
              <View style={styles.profileHeaderBack} />
              <Text style={styles.profileHeaderTitle}>Order Confirmed</Text>
              <View style={styles.profileHeaderBack} />
            </View>
            <Text style={styles.profileHeaderScreenTitle}>Thank you for ordering</Text>
          </View>
          <View style={styles.profileDetailCard}>
            <View style={styles.successCard}>
              <Text style={styles.successIcon}>✅</Text>
              <Text style={styles.successTitle}>Order received</Text>
              <Text style={styles.successSubtitle}>Your order is now waiting for seller confirmation and will appear in My Orders.</Text>
              {checkoutNotice ? (
                <View style={[styles.checkoutNoticeBox, styles.checkoutNoticeSuccess, { marginTop: 12, width: '100%' }]}> 
                  <Text style={styles.checkoutNoticeText}>{checkoutNotice.message}</Text>
                </View>
              ) : null}
            </View>
            <TouchableOpacity style={styles.primaryButton} onPress={() => { setActiveTab('Orders'); setProfileRoute('profile'); setSelectedOrderId(null); }}>
              <Text style={styles.primaryButtonText}>View order status</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.primaryButton, { marginTop: 12 }]} onPress={() => { setProfileRoute('profile'); setActiveTab('Home'); }}>
              <Text style={styles.primaryButtonText}>Continue shopping</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (profileRoute === 'security') {
      return (
        <View style={styles.profilePage}>
          <View style={styles.profileHeaderBlock}>
            <View style={styles.profileHeaderRow}>
              <View style={styles.profileHeaderBack} />
              <Text style={styles.profileHeaderTitle}>Security</Text>
              <View style={styles.profileHeaderBack} />
            </View>
            <Text style={styles.profileHeaderScreenTitle}>Account protection</Text>
          </View>
          <View style={styles.profileDetailCard}>
            <Text style={styles.profileDetailBody}>Secure your Glow account with verification, password recovery, and proactive alerts.</Text>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Email verification</Text>
              <Text style={styles.infoValue}>{verificationSent ? 'Verification email sent' : 'Pending verification'}</Text>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => { setVerificationSent(true); Alert.alert('Email sent', 'A verification email has been queued for your inbox.'); }}>
                <Text style={styles.secondaryButtonText}>{verificationSent ? 'Resend email' : 'Verify email'}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Password reset</Text>
              <Text style={styles.profileDetailBody}>Reset your password using the email address or phone number on your Glow account.</Text>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => {
                setShowPasswordRecovery(true);
                setRecoveryIdentifier(profile?.email || profile?.phone_number || '');
                setProfileAuthError(null);
                setActiveTab('Settings');
                setProfileRoute('login');
              }}>
                <Text style={styles.secondaryButtonText}>Reset password</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.primaryButton} onPress={() => setProfileRoute('profile')}>
              <Text style={styles.primaryButtonText}>Back to Profile</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (profileRoute === 'personal_information') {
      return (
        <View style={styles.profilePage}>
          <View style={styles.profileHeaderBlock}>
            <View style={styles.profileHeaderRow}>
              <View style={styles.profileHeaderBack} />
              <Text style={styles.profileHeaderTitle}>Profile Details</Text>
              <View style={styles.profileHeaderBack} />
            </View>
            <Text style={styles.profileHeaderScreenTitle}>Keep the account details current</Text>
          </View>
          <View style={styles.profileDetailCard}>
            <Text style={styles.infoLabel}>First name</Text>
            <TextInput style={styles.inputField} value={profileDraft.first_name} onChangeText={(value) => setProfileDraft((prev) => ({ ...prev, first_name: value }))} placeholder="First name" placeholderTextColor="#9CA3AF" />
            <Text style={styles.infoLabel}>Last name</Text>
            <TextInput style={styles.inputField} value={profileDraft.last_name} onChangeText={(value) => setProfileDraft((prev) => ({ ...prev, last_name: value }))} placeholder="Last name" placeholderTextColor="#9CA3AF" />
            <Text style={styles.infoLabel}>Email</Text>
            <TextInput style={styles.inputField} value={profileDraft.email} onChangeText={(value) => setProfileDraft((prev) => ({ ...prev, email: value }))} placeholder="Email" keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#9CA3AF" />
            <Text style={styles.infoLabel}>Phone number</Text>
            <TextInput style={styles.inputField} value={profileDraft.phone_number} onChangeText={(value) => setProfileDraft((prev) => ({ ...prev, phone_number: value }))} placeholder="Phone number" keyboardType="phone-pad" placeholderTextColor="#9CA3AF" />
            <Text style={styles.infoLabel}>Salon name</Text>
            <TextInput style={styles.inputField} value={profileDraft.salon_name} onChangeText={(value) => setProfileDraft((prev) => ({ ...prev, salon_name: value }))} placeholder="Salon name" placeholderTextColor="#9CA3AF" />
            <TouchableOpacity style={styles.primaryButton} onPress={saveProfileDetails}>
              <Text style={styles.primaryButtonText}>Save changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (profileRoute === 'change_password') {
      const savePassword = () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
          setPasswordMessage('Complete all password fields.');
          return;
        }
        if (newPassword.length < 8) {
          setPasswordMessage('Use at least 8 characters for your new password.');
          return;
        }
        if (newPassword !== confirmPassword) {
          setPasswordMessage('Your new passwords do not match.');
          return;
        }
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPasswordMessage('Password updated successfully.');
      };

      return (
        <View style={styles.profilePage}>
          <View style={styles.profileHeaderBlock}>
            <View style={styles.profileHeaderRow}>
              <View style={styles.profileHeaderBack} />
              <Text style={styles.profileHeaderTitle}>Change Password</Text>
              <View style={styles.profileHeaderBack} />
            </View>
            <Text style={styles.profileHeaderScreenTitle}>Keep your account secure</Text>
          </View>
          <View style={styles.profileDetailCard}>
            <Text style={styles.infoLabel}>Current password</Text>
            <TextInput style={styles.inputField} value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry placeholder="Enter current password" placeholderTextColor="#9CA3AF" />
            <Text style={styles.infoLabel}>New password</Text>
            <TextInput style={styles.inputField} value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="At least 8 characters" placeholderTextColor="#9CA3AF" />
            <Text style={styles.infoLabel}>Confirm new password</Text>
            <TextInput style={styles.inputField} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholder="Re-enter new password" placeholderTextColor="#9CA3AF" />
            {passwordMessage ? <Text style={styles.passwordMessage}>{passwordMessage}</Text> : null}
            <TouchableOpacity style={styles.primaryButton} onPress={savePassword}>
              <Text style={styles.primaryButtonText}>Update password</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (profileRoute === 'about') {
      return (
        <View style={styles.profilePage}>
          <View style={styles.profileHeaderBlock}>
            <View style={styles.profileHeaderRow}>
              <View style={styles.profileHeaderBack} />
              <Text style={styles.profileHeaderTitle}>About Glow</Text>
              <View style={styles.profileHeaderBack} />
            </View>
            <Text style={styles.profileHeaderScreenTitle}>Who we are</Text>
          </View>
          <View style={styles.profileDetailCard}>
            <Text style={styles.profileDetailBody}>Glow connects professional salon supplies with fast local delivery. We partner with trusted suppliers to bring quality products to salons and stylists with transparent pricing and reliable delivery windows.</Text>
            <Text style={[styles.profileDetailBody, { marginTop: 12 }]}>Delivery: We offer same-day or next-day delivery depending on your location. Orders are tracked and you receive updates every step of the way.</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => setProfileRoute('profile')}>
              <Text style={styles.primaryButtonText}>Back to Profile</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (profileRoute === 'help') {
      return (
        <View style={styles.profilePage}>
          <View style={styles.profileHeaderBlock}>
            <View style={styles.profileHeaderRow}>
              <View style={styles.profileHeaderBack} />
              <Text style={styles.profileHeaderTitle}>Help & Support</Text>
              <View style={styles.profileHeaderBack} />
            </View>
            <Text style={styles.profileHeaderScreenTitle}>We’re here to help</Text>
          </View>
          <View style={styles.profileDetailCard}>
            <Text style={styles.profileDetailBody}>If you need assistance with orders, deliveries, or returns, reach out to our support team.</Text>
            <TouchableOpacity style={[styles.secondaryButton, { marginTop: 12 }]} onPress={() => Linking.openURL('mailto:support@glow.example.com')}>
              <Text style={styles.secondaryButtonText}>Email support@glow.example.com</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryButton, { marginTop: 8 }]} onPress={() => Linking.openURL('tel:+256700000000')}>
              <Text style={styles.secondaryButtonText}>Call +256 700 000 000</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.primaryButton, { marginTop: 14 }]} onPress={() => setProfileRoute('profile')}>
              <Text style={styles.primaryButtonText}>Back to Profile</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (profileRoute === 'payment_methods') {
      return (
        <View style={styles.profilePage}>
          <View style={styles.profileHeaderBlock}>
            <View style={styles.profileHeaderRow}>
              <View style={styles.profileHeaderBack} />
              <Text style={styles.profileHeaderTitle}>Payment Methods</Text>
              <View style={styles.profileHeaderBack} />
            </View>
            <Text style={styles.profileHeaderScreenTitle}>Choose how you’d like to pay</Text>
          </View>
          <View style={styles.profileDetailCard}>
            <Text style={styles.profileDetailBody}>Only Cash on Delivery is available right now for confirmed salon orders.</Text>

            {['Cash on delivery'].map((label) => (
              <TouchableOpacity key={label} style={[styles.menuRow, paymentMethod === label && { backgroundColor: '#FEF3E8' }]} onPress={() => setPaymentMethod('Cash on delivery')}>
                <View style={styles.menuLabelWrap}>
                  <View style={styles.menuIconShell}><Text style={styles.menuIcon}>{paymentMethod === label ? '◉' : '○'}</Text></View>
                  <Text style={styles.menuLabel}>{label}</Text>
                </View>
                <Text style={styles.menuChevron}>›</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.primaryButton} onPress={savePaymentMethod} disabled={savingPaymentMethod}>
              {savingPaymentMethod ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Save payment method</Text>}
            </TouchableOpacity>

            <Text style={[styles.profileDetailBody, { marginTop: 12, fontSize: 13 }]}>Cash on delivery is the active method for orders placed from this account.</Text>

            <TouchableOpacity style={[styles.primaryButton, { marginTop: 14 }]} onPress={() => setProfileRoute('profile')}>
              <Text style={styles.primaryButtonText}>Back to Profile</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (profileRoute !== 'profile') {
      const routeDetails = detailedRoutes[profileRoute] || detailedRoutes.settings;
      return (
        <View style={styles.profilePage}>
          <View style={styles.profileHeaderBlock}>
            <View style={styles.profileHeaderRow}>
              <View style={styles.profileHeaderBack} />
              <Text style={styles.profileHeaderTitle}>My Profile</Text>
              <View style={styles.profileHeaderBack} />
            </View>
            <Text style={styles.profileHeaderScreenTitle}>{routeDetails.title}</Text>
          </View>
          <View style={styles.profileDetailCard}>
            <Text style={styles.profileDetailBody}>{routeDetails.body}</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => setProfileRoute('profile')}>
              <Text style={styles.primaryButtonText}>Back to Profile</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <ScrollView style={styles.profilePage} contentContainerStyle={styles.profilePageContent} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeaderBlock}>
          <View style={styles.profileHeaderRow}>
            <View style={styles.profileHeaderBack} />
            <Text style={styles.profileHeaderTitle}>My Profile</Text>
            <TouchableOpacity style={styles.profileSettingsButton} onPress={() => setProfileRoute('settings')}>
              <Text style={styles.profileHeaderIcon}>⚙</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.profileIdentityRow}>
            <TouchableOpacity style={styles.profilePhotoShell} onPress={handleImagePicker}>
              {profilePhoto ? <Image source={{ uri: profilePhoto }} style={styles.profileImage} /> : <Text style={styles.profilePhotoText}>👤</Text>}
              <View style={styles.photoBadgeButton}>
                <Text style={styles.photoBadgeText}>📷</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.profileIdentity}>
              <Text style={styles.profileName}>{profileName}</Text>
              <Text style={styles.profileEmail}>{profileEmail}</Text>
              <Text style={styles.profilePhone}>{profilePhone}</Text>
            </View>
          </View>
          <View style={styles.memberBadgeRow}>
            <View style={styles.memberBadge}>
              <Text style={styles.memberBadgeText}>GLOW MEMBER</Text>
            </View>
            <Text style={styles.memberSinceText}>Member since {profile?.created_at ? new Date(profile.created_at).getFullYear() : '2025'}</Text>
          </View>
        </View>

        <View style={styles.accountOverviewCard}>
          <View style={styles.accountOverviewHeaderRow}>
            <View>
              <Text style={styles.accountOverviewTitle}>Account Overview</Text>
            </View>
          </View>
          <View style={styles.statGrid}>
            <TouchableOpacity style={styles.statBox} onPress={() => setActiveTab('Orders')}>
              <Text style={styles.statIcon}>📦</Text>
              <Text style={styles.statLabel}>Orders</Text>
              <Text style={styles.statValue}>{orderCount}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.statBox} onPress={() => setProfileRoute('favorites')}>
              <Text style={styles.statIcon}>♥</Text>
              <Text style={styles.statLabel}>Wishlist</Text>
              <Text style={styles.statValue}>{wishlistCount}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.statBox} onPress={() => openAddresses('profile')}>
              <Text style={styles.statIcon}>📍</Text>
              <Text style={styles.statLabel}>Addresses</Text>
              <Text style={styles.statValue}>{addressCount}</Text>
            </TouchableOpacity>
            <View style={styles.statBox}>
              <Text style={styles.statIcon}>★</Text>
              <Text style={styles.statLabel}>Reviews</Text>
              <Text style={styles.statValue}>{reviewCount}</Text>
            </View>
          </View>
        </View>

        <View style={styles.quickActionsCard}>
          <Text style={styles.quickActionsTitle}>Quick access</Text>
          <View style={styles.quickActionsGrid}>
            {[
              { label: 'Security', subtitle: 'Protect your account', route: 'security', icon: '🔒' },
              { label: 'Addresses', subtitle: 'Delivery details', route: 'addresses', icon: '📍' },
              { label: 'Favorites', subtitle: 'Saved essentials', route: 'favorites', icon: '♥' },
              { label: 'Support', subtitle: 'Get help fast', route: 'help', icon: '❓' },
            ].map((item) => (
              <TouchableOpacity
                key={item.route}
                style={styles.quickActionCard}
                onPress={() => {
                  if (item.route === 'addresses') {
                    openAddresses('profile');
                  } else {
                    setProfileRoute(item.route as any);
                  }
                }}
              >
                <View style={styles.quickActionIconShell}>
                  <Text style={styles.quickActionIcon}>{item.icon}</Text>
                </View>
                <Text style={styles.quickActionTitle}>{item.label}</Text>
                <Text style={styles.quickActionSubtitle}>{item.subtitle}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.profilePreferenceCard}>
          <View style={styles.profilePreferenceHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.quickActionsTitle}>Delivery preferences</Text>
              <Text style={styles.profilePreferenceText}>{deliveryAddress || 'Add your preferred delivery address to get started.'}</Text>
              <Text style={styles.profilePreferenceMeta}>Preferred payment: {paymentMethod}</Text>
            </View>
            <View style={styles.profilePreferenceBadge}>
              <Text style={styles.profilePreferenceBadgeText}>Updated</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => openAddresses('profile')}>
            <Text style={styles.secondaryButtonText}>Manage address</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.recentOrdersCard}>
          <View style={styles.recentOrdersHeaderRow}>
            <View>
              <Text style={styles.quickActionsTitle}>Recent orders</Text>
              <Text style={styles.accountOverviewCaption}>Track your latest deliveries in one place</Text>
            </View>
            <TouchableOpacity onPress={() => setActiveTab('Orders')}>
              <Text style={styles.viewAll}>View all</Text>
            </TouchableOpacity>
          </View>
          {orders.length ? orders.slice(0, 2).map((order: any, index: number) => (
            <View key={getListItemKey(order, index, 'recent-order')} style={styles.recentOrderRow}>
              <View style={styles.recentOrderTextBlock}>
                <Text style={styles.infoValue}>{order.order_number || 'Order'}</Text>
                <Text style={styles.accountOverviewCaption}>{order.order_status || 'Processing'}</Text>
              </View>
              <Text style={styles.detailPriceText}>UGX {Number(order.total_amount ?? 0).toLocaleString('en-US')}</Text>
            </View>
          )) : <Text style={styles.profileDetailBody}>Your recent orders will appear here once you place your first delivery.</Text>}
        </View>

        <View style={styles.menuList}>
          <View style={styles.menuListHeader}>
            <Text style={styles.menuListTitle}>Account settings</Text>
            <Text style={styles.menuListHint}>Manage your personal and delivery preferences</Text>
          </View>
          {[
            { label: 'Personal Information', route: 'personal_information', icon: '👤' },
            { label: 'Change Password', route: 'change_password', icon: '🔒' },
            { label: 'Payment Methods', route: 'payment_methods', icon: '▣' },
            { label: 'Addresses', route: 'addresses', icon: '📍' },
            { label: 'Help & Support', route: 'help', icon: '❓' },
            { label: 'About Glow', route: 'about', icon: 'ⓘ' },
          ].map((item) => (
            <TouchableOpacity
              key={item.route}
              style={styles.menuRow}
              onPress={() => {
                if (item.route === 'addresses') {
                  openAddresses('profile');
                } else {
                  setProfileRoute(item.route as any);
                }
              }}
            >
              <View style={styles.menuLabelWrap}>
                <View style={styles.menuIconShell}>
                  <Text style={styles.menuIcon}>{item.icon}</Text>
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
              </View>
              <Text style={styles.menuChevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

const renderHomeBody = () => {
    const categoryProductGroups = categories
      .map((category) => {
        const categoryName = category.category_name || category.name;
        const items = products.filter((product: any) => productMatchesCatalogItem(product, category, 'category'));

        return {
          categoryName,
          items,
        };
      })
      .filter((group) => group.items.length > 0);

    const mixedCategoryProducts: any[] = [];
    const discoverMoreProductIds = new Set<string>();
    const longestCategoryGroup = Math.max(0, ...categoryProductGroups.map((group) => group.items.length));

    // Take one product from each category at a time so the grid stays varied,
    // while still allowing up to 60 products to be discovered.
    for (let productIndex = 0; productIndex < longestCategoryGroup && mixedCategoryProducts.length < DISCOVER_MORE_PRODUCT_LIMIT; productIndex += 1) {
      for (const group of categoryProductGroups) {
        const item = group.items[productIndex];
        const itemId = item?.id ?? item?.product_id ?? item?.sku ?? item?.product_name;
        const productId = itemId === undefined || itemId === null ? '' : String(itemId);
        if (!item || !productId || discoverMoreProductIds.has(productId)) continue;

        discoverMoreProductIds.add(productId);
        mixedCategoryProducts.push({ ...item, __categoryName: group.categoryName });
        if (mixedCategoryProducts.length === DISCOVER_MORE_PRODUCT_LIMIT) break;
      }
    }

    // Keep browsing useful even while categories are still loading or products
    // have not yet been assigned to one.
    for (const item of products) {
      if (mixedCategoryProducts.length === DISCOVER_MORE_PRODUCT_LIMIT) break;
      const itemId = item?.id ?? item?.product_id ?? item?.sku ?? item?.product_name;
      const productId = itemId === undefined || itemId === null ? '' : String(itemId);
      if (!productId || discoverMoreProductIds.has(productId)) continue;

      discoverMoreProductIds.add(productId);
      mixedCategoryProducts.push(item);
    }

    const numberFromProduct = (product: any, keys: string[]) => {
      for (const key of keys) {
        const value = Number(product?.[key]);
        if (Number.isFinite(value)) return value;
      }
      return 0;
    };
    const profitFor = (product: any) => {
      const sellingPrice = numberFromProduct(product, ['selling_price', 'price', 'discount_price']);
      const buyingPrice = numberFromProduct(product, ['buying_price', 'cost_price', 'purchase_price']);
      return sellingPrice - buyingPrice;
    };
    const salesCountFor = (product: any) => numberFromProduct(product, [
      'sales_count',
      'units_sold',
      'active_order_count',
      'current_order_count',
      'orders_in_progress',
      'orders_today',
      'order_count',
    ]);
    const productKey = (product: any) => String(product?.id ?? product?.product_id ?? product?.sku ?? product?.product_name ?? '');
    const takeUnassignedProducts = (candidates: any[], assigned: Set<string>, limit = 4) => {
      const selection: any[] = [];
      for (const product of candidates) {
        const key = productKey(product);
        if (!key || assigned.has(key)) continue;
        assigned.add(key);
        selection.push(product);
        if (selection.length === limit) break;
      }
      return selection;
    };

    // Keep the curated rails separate: the same item never appears in more than one.
    const assignedHomeProductKeys = new Set<string>();
    const allCatalogProducts = [...products];
    const searchQuery = (searchTerm || '').trim().toLowerCase();
    const bestSellingProducts = takeUnassignedProducts(
      [...allCatalogProducts].filter((product) => matchesProductSearch(product, searchQuery)).sort((a, b) => {
        const salesDifference = salesCountFor(b) - salesCountFor(a);
        if (salesDifference) return salesDifference;
        return new Date(b?.updated_at || b?.created_at || 0).getTime() - new Date(a?.updated_at || a?.created_at || 0).getTime();
      }),
      assignedHomeProductKeys,
      Math.max(12, Math.ceil(allCatalogProducts.length * 0.35)),
    );
    const dealsOfTheDay = takeUnassignedProducts(
      [...allCatalogProducts].filter((product) => matchesProductSearch(product, searchQuery)).sort((a, b) => profitFor(b) - profitFor(a)),
      assignedHomeProductKeys,
      Math.max(12, Math.ceil(allCatalogProducts.length * 0.35)),
    );
    const freshPicks = takeUnassignedProducts(
      [...allCatalogProducts].filter((product) => matchesProductSearch(product, searchQuery)).sort((a, b) => profitFor(a) - profitFor(b)),
      assignedHomeProductKeys,
      Math.max(12, Math.ceil(allCatalogProducts.length * 0.35)),
    );

    const remainingFeaturedProducts = allCatalogProducts.filter((product) => {
      const key = productKey(product);
      return key && !assignedHomeProductKeys.has(key);
    });

    const discoverMorePool = [...mixedCategoryProducts, ...remainingFeaturedProducts];
    const discoverMoreUnique = Array.from(new Map(discoverMorePool.map((item) => [productKey(item) || `${Math.random()}`, item])).values());
    const discoverMoreProducts = discoverMoreUnique.filter((item) => item && productKey(item) && matchesProductSearch(item, searchQuery));

    const heroBanner = banners[0];
    // Force the hero background to the given Cloudinary image (ignore banner overrides)
    const HERO_IMAGE_URL = 'https://res.cloudinary.com/h78tlu47/image/upload/v1786139191/ChatGPT_Image_Aug_8_2026_12_45_24_AM_xlnfsk.png';
    const heroImageSource = { uri: HERO_IMAGE_URL };
    const heroImageKey = 'hero-forced';

    // Image resize/focal options:
    // - HERO_IMAGE_RESIZE_MODE: 'cover' or 'contain'
    // - HERO_IMAGE_FOCUS: 'top' | 'center' | 'bottom'
    const HERO_IMAGE_RESIZE_MODE: 'cover' | 'contain' = 'cover';
    const HERO_IMAGE_FOCUS = (process.env.EXPO_PUBLIC_HERO_IMAGE_FOCUS || 'center') as 'top' | 'center' | 'bottom';

    // Compute imageStyle to nudge the focal point when using 'cover'.
    // translateY values are small adjustments to change visible focal area.
    const heroImageTransform: any[] = [];
    if (HERO_IMAGE_RESIZE_MODE === 'cover') {
      if (HERO_IMAGE_FOCUS === 'top') heroImageTransform.push({ translateY: -32 });
      if (HERO_IMAGE_FOCUS === 'bottom') heroImageTransform.push({ translateY: 32 });
    }
    const heroImageStyle = [styles.heroBackgroundImage, { transform: heroImageTransform }];

    return (
      <View style={styles.homePageShell}>
        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

        <View style={[styles.contentSectionWhite, styles.heroBodyShell]}>
          <View style={styles.heroCardShell}>
            <ImageBackground
              source={heroImageSource}
              style={[styles.heroCard, isCompact && styles.heroCardCompact]}
              imageStyle={heroImageStyle}
              resizeMode={HERO_IMAGE_RESIZE_MODE}
            >
              <View style={styles.heroOverlay} />
              <View style={styles.heroTextContainer}>
                <Text style={styles.heroLine}>Everything your salon needs.</Text>
                <Text style={styles.heroDelivered}>Free delivery</Text>
                <TouchableOpacity style={styles.shopButton} onPress={() => setActiveTab('Categories')}>
                  <Text style={styles.shopButtonText}>Shop Now</Text>
                </TouchableOpacity>
              </View>
            </ImageBackground>
          </View>

          <View style={styles.heroBodyContent}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Shop by Brand</Text>
              <TouchableOpacity onPress={() => { setCatalogMode('brand'); setSelectedBrand('All Brands'); setSelectedBrandId(null); setActiveTab('Categories'); }}>
                <Text style={styles.viewAll}>View all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal nestedScrollEnabled directionalLockEnabled showsHorizontalScrollIndicator={false} style={styles.horizontalList} contentContainerStyle={styles.horizontalListContent}>
              {brands.map((item, index) => {
                const brandName = item.brand_name || item.name;
                const visual = getCategoryIconVisual(brandName);
                const brandImageUrl = getCategoryImageUrl(item, visual.imageUrl);
                return (
                  <TouchableOpacity key={getListItemKey(item, index, 'brand')} style={[styles.categoryCard, { width: categoryCardWidth }]} onPress={() => {
                    setCatalogMode('brand');
                    setSelectedBrand(brandName);
                    setSelectedBrandId(String(item.id ?? item.brand_id ?? ''));
                    setActiveTab('Categories');
                  }}>
                    <View style={[styles.categoryIconBadge, { backgroundColor: visual.bgColor }]}>
                      <CatalogImage uri={brandImageUrl} style={styles.categoryIconImage} />
                    </View>
                    <Text style={styles.categoryName} numberOfLines={2}>{brandName}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Shop by Category</Text>
            <TouchableOpacity onPress={() => { setCatalogMode('category'); setSelectedCategory('All Categories'); setSelectedCategoryId(null); setActiveTab('Categories'); }}><Text style={styles.viewAll}>View all</Text></TouchableOpacity>
          </View>
          <ScrollView horizontal nestedScrollEnabled directionalLockEnabled showsHorizontalScrollIndicator={false} style={styles.horizontalList} contentContainerStyle={styles.horizontalListContent}>
            {categories.map((item, index) => {
              const categoryName = item.category_name || item.name;
              const visual = getCategoryIconVisual(categoryName);
              const categoryImageUrl = getCategoryImageUrl(item, visual.imageUrl);
              return (
                <TouchableOpacity key={getListItemKey(item, index, 'category')} style={[styles.categoryCard, { width: categoryCardWidth }]} onPress={() => {
                  setCatalogMode('category');
                  setSelectedCategory(categoryName);
                  setSelectedCategoryId(String(item.id ?? item.category_id ?? ''));
                  setActiveTab('Categories');
                }}>
                  <View style={[styles.categoryIconBadge, { backgroundColor: visual.bgColor }]}> 
                    <CatalogImage uri={categoryImageUrl} style={styles.categoryIconImage} />
                  </View>
                  <Text style={styles.categoryName} numberOfLines={2}>{categoryName}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Best Selling</Text>
            <TouchableOpacity><Text style={styles.viewAll}>View all</Text></TouchableOpacity>
          </View>
          <ScrollView horizontal nestedScrollEnabled directionalLockEnabled showsHorizontalScrollIndicator={false} style={styles.horizontalList} contentContainerStyle={styles.horizontalListContent}>
            {bestSellingProducts.map((item, index) => {
              const isSaved = wishlist.some((entry: any) => entry.id === item.id);
              const soldQuantity = salesCountFor(item);
              return (
                <TouchableOpacity key={getListItemKey(item, index, 'best-seller')} activeOpacity={0.95} style={[styles.productCard, { width: productCardWidth }]} onPress={() => openProductDetail(item)}>
                  <CatalogImage uri={getProductImageUrls(item)[0]} style={styles.productImage} />
                  <TouchableOpacity style={styles.favoriteButton} onPress={() => toggleWishlist(item)}>
                    <Text style={styles.favoriteButtonText}>{isSaved ? '♥' : '♡'}</Text>
                  </TouchableOpacity>
                  <View style={styles.productContent}>
                    <View style={styles.productMetaRow}>
                      <View style={styles.productBadge}>
                        <Text style={styles.productBadgeText}>Fast moving</Text>
                      </View>
                      <Text style={styles.productDeliveryText} numberOfLines={1}>{soldQuantity ? `${soldQuantity} sold` : 'Popular'}</Text>
                    </View>
                    <Text style={styles.productName} numberOfLines={2}>{item.product_name}</Text>
                    <Text style={styles.productPrice} numberOfLines={1}>UGX {Number(item.selling_price ?? 0).toLocaleString('en-US')}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Deals of the Day</Text>
            <TouchableOpacity onPress={() => setActiveTab('Categories')}><Text style={styles.viewAll}>Browse all</Text></TouchableOpacity>
          </View>
          <ScrollView horizontal nestedScrollEnabled directionalLockEnabled showsHorizontalScrollIndicator={false} style={styles.horizontalList} contentContainerStyle={styles.horizontalListContent}>
            {dealsOfTheDay.map((item, index) => {
              const isSaved = wishlist.some((entry: any) => entry.id === item.id);
              return (
                <TouchableOpacity key={getListItemKey(item, index, 'new-arrival')} activeOpacity={0.95} style={[styles.miniProductCard, { width: miniProductCardWidth }]} onPress={() => openProductDetail(item)}>
                  <CatalogImage uri={getProductImageUrls(item)[0]} style={styles.miniProductImage} />
                  <View style={styles.miniProductContent}>
                    <Text style={styles.miniProductTag}>High margin</Text>
                    <Text style={styles.miniProductName} numberOfLines={2}>{item.product_name}</Text>
                    <Text style={styles.miniProductPrice} numberOfLines={1}>UGX {Number(item.selling_price ?? 0).toLocaleString('en-US')}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Fresh Picks for You</Text>
            <TouchableOpacity onPress={() => setActiveTab('Categories')}><Text style={styles.viewAll}>See more</Text></TouchableOpacity>
          </View>
          <ScrollView horizontal nestedScrollEnabled directionalLockEnabled showsHorizontalScrollIndicator={false} style={styles.horizontalList} contentContainerStyle={styles.horizontalListContent}>
            {freshPicks.map((item, index) => {
              const isSaved = wishlist.some((entry: any) => entry.id === item.id);
              return (
                <TouchableOpacity key={getListItemKey(item, index, 'fresh-pick')} activeOpacity={0.95} style={[styles.miniProductCard, { width: miniProductCardWidth }]} onPress={() => openProductDetail(item)}>
                  <CatalogImage uri={getProductImageUrls(item)[0]} style={styles.miniProductImage} />
                  <View style={styles.miniProductContent}>
                    <Text style={styles.miniProductTag}>Low margin</Text>
                    <Text style={styles.miniProductName} numberOfLines={2}>{item.product_name}</Text>
                    <Text style={styles.miniProductPrice} numberOfLines={1}>UGX {Number(item.selling_price ?? 0).toLocaleString('en-US')}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Discover more</Text>
            <Text style={styles.viewAll}>{discoverMoreProducts.length} items</Text>
          </View>
          <View style={styles.productGrid}>
            {discoverMoreProducts.map((item: any, index: number) => {
              const isSaved = wishlist.some((entry: any) => entry.id === item.id);
              const outOfStock = isProductOutOfStock(item);
              return (
                <TouchableOpacity key={getListItemKey(item, index, 'home-product')} activeOpacity={0.95} style={styles.productGridCard} onPress={() => openProductDetail(item)}>
                  <CatalogImage uri={getProductImageUrls(item)[0]} style={styles.productGridImage} />
                  <TouchableOpacity style={styles.favoriteButton} onPress={() => toggleWishlist(item)}>
                    <Text style={styles.favoriteButtonText}>{isSaved ? '♥' : '♡'}</Text>
                  </TouchableOpacity>
                  <View style={styles.productGridContent}>
                    <View style={styles.productGridMetaRow}>
                      <View style={styles.productGridBadge}>
                        <Text style={styles.productGridBadgeText} numberOfLines={1}>{item.__categoryName || 'Featured'}</Text>
                      </View>
                      <Text style={[styles.productGridDeliveryText, outOfStock && styles.outOfStockText]} numberOfLines={1}>{outOfStock ? 'Out of stock' : 'In stock'}</Text>
                    </View>
                    <Text style={styles.productGridName} numberOfLines={2}>{item.product_name}</Text>
                    <Text style={styles.productGridPrice} numberOfLines={1}>UGX {Number(item.selling_price ?? 0).toLocaleString('en-US')}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          </View>
        </View>

        {wishlist.length ? (
          <View style={styles.contentSectionWhite}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Saved for later</Text>
              <Text style={styles.viewAll}>{wishlist.length} items</Text>
            </View>
            <ScrollView horizontal nestedScrollEnabled directionalLockEnabled showsHorizontalScrollIndicator={false} style={styles.horizontalList} contentContainerStyle={styles.horizontalListContent}>
              {wishlist.map((item: any, index: number) => (
                <TouchableOpacity key={getListItemKey(item, index, 'wishlist')} activeOpacity={0.95} style={[styles.miniProductCard, { width: miniProductCardWidth }]} onPress={() => openProductDetail(item)}>
                  <CatalogImage uri={getProductImageUrls(item)[0]} style={styles.miniProductImage} />
                  <View style={styles.miniProductContent}>
                  <Text style={styles.miniProductName} numberOfLines={2}>{item.product_name}</Text>
                    <Text style={styles.miniProductPrice} numberOfLines={1}>UGX {Number(item.selling_price ?? 0).toLocaleString('en-US')}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}

      </View>
    );
  };

  const renderMainContent = () => {
    const heroBanner = banners[0];
    if (activeTab === 'Categories') return renderCategoriesScreen();
    if (activeTab === 'Orders') return renderOrdersScreen();
    if (activeTab === 'Settings' || activeTab === 'Profile' || activeTab === 'Cart') return renderProfileScreen();
    return renderHomeBody();
  };

  const detailGallery = selectedProduct ? getProductImageUrls(selectedProduct) : [];
  const activeDetailImage = detailGallery[selectedProductImageIndex] || detailGallery[0] || '';
  const isSelectedWishlisted = selectedProduct ? wishlist.some((item: any) => item.id === selectedProduct.id) : false;
  const selectedProductQty = selectedProduct ? (cartQuantities[selectedProduct.id] || 0) : 0;
  const selectedProductOutOfStock = selectedProduct ? isProductOutOfStock(selectedProduct) : false;

  if (loading) {
    return (
      <SafeAreaProvider>
        <SplashScreen />
      </SafeAreaProvider>
    );
  }

  if (false) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.loaderScreen}>
          <ActivityIndicator size="large" color="#F5821F" />
          <Text style={styles.loaderText}>Loading your salon essentials…</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={['Home', 'Categories', 'Orders', 'Settings', 'Profile', 'Cart'].includes(activeTab) ? 'light-content' : 'dark-content'} backgroundColor={['Home', 'Categories', 'Orders', 'Settings', 'Profile', 'Cart'].includes(activeTab) ? '#01143F' : '#F8FAFC'} />
      <SafeAreaView style={[styles.container, ['Home', 'Categories', 'Orders', 'Settings', 'Profile', 'Cart'].includes(activeTab) && styles.containerNavy]}>
        <View style={styles.screenRoot}>
          {activeTab === 'Home' ? (
          <View style={styles.homeScreenRoot}>
            <View style={styles.topBar}>
              <View style={styles.logoBox}>
                <View style={styles.logoTextBlock}>
                  <View style={styles.logoImageWrapper}>
                    <Image source={{ uri: 'https://res.cloudinary.com/h78tlu47/image/upload/v1784708343/icon_sotujz.jpg' }} style={styles.logoImage} />
                  </View>
                </View>
                <Text style={styles.tagline}>SALON SUPPLIES, DELIVERED.</Text>
              </View>
              <TouchableOpacity style={styles.iconButton} onPress={openCartScreen}>
                <Text style={styles.headerIconText}>🛒</Text>
                {cartCount > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{cartCount}</Text></View> : null}
              </TouchableOpacity>
            </View>
            <ScrollView
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              style={styles.homeScroll}
              contentContainerStyle={styles.scrollContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadHomeData(true); }} tintColor="#F5821F" />}
            >
              <View style={styles.searchBar}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search for products..."
                  placeholderTextColor="#9CA3AF"
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                />
                <TouchableOpacity style={styles.searchButton} onPress={() => setActiveTab('Categories')}>
                  <Text style={styles.searchButtonIcon}>🔍</Text>
                </TouchableOpacity>
              </View>
              {renderMainContent()}
            </ScrollView>
          </View>
        ) : (
          <View style={styles.fullScreenPanel}>{renderMainContent()}</View>
        )}

        {selectedProduct ? (
          <View style={styles.detailOverlay}>
            <TouchableOpacity style={styles.detailOverlayBackdrop} activeOpacity={1} onPress={() => setSelectedProduct(null)} />
            <View style={styles.detailSheet}>
              <View style={styles.detailSheetHandle} />
              <View style={styles.detailSheetHeader}>
                <TouchableOpacity style={styles.detailCloseButton} onPress={() => setSelectedProduct(null)}>
                  <Text style={styles.detailCloseButtonText}>✕</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.detailFavoriteButton} onPress={() => toggleWishlist(selectedProduct)}>
                  <Text style={styles.detailFavoriteButtonText}>{isSelectedWishlisted ? '♥' : '♡'}</Text>
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={styles.detailScrollContent} showsVerticalScrollIndicator={false}>
                <CatalogImage uri={activeDetailImage} style={styles.detailHeroImage} />
                <View style={styles.detailGalleryRow}>
                  {detailGallery.map((image, index) => (
                    <TouchableOpacity key={`${image}-${index}`} style={[styles.detailThumbCard, index === selectedProductImageIndex && styles.detailThumbCardActive]} onPress={() => setSelectedProductImageIndex(index)}>
                      <CatalogImage uri={image} style={styles.detailThumbImage} />
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.detailTitleRow}>
                  <View style={styles.detailTitleBlock}>
                    <Text style={styles.detailTitle}>{selectedProduct.product_name}</Text>
                    <Text style={styles.detailCategory}>{selectedProduct.category_name || 'Salon essentials'}</Text>
                  </View>
                  <View style={styles.detailPriceChip}>
                    <Text style={styles.detailPriceText}>UGX {Number(selectedProduct.selling_price ?? selectedProduct.price ?? 0).toLocaleString('en-US')}</Text>
                  </View>
                </View>
                <Text style={styles.detailDescription}>
                  {selectedProduct.description || 'Premium salon care essentials designed for professional results at home. Crafted for comfort, performance, and a polished finish.'}
                </Text>
                <View style={styles.detailHighlightsRow}>
                  <View style={styles.detailHighlightBox}>
                    <Text style={styles.detailHighlightLabel}>Availability</Text>
                    <Text style={[styles.detailHighlightValue, selectedProductOutOfStock && styles.outOfStockText]}>{selectedProductOutOfStock ? 'Out of stock' : 'In stock'}</Text>
                  </View>
                  <View style={styles.detailHighlightBox}>
                    <Text style={styles.detailHighlightLabel}>Delivery</Text>
                    <Text style={styles.detailHighlightValue}>Express today</Text>
                  </View>
                </View>
                <View style={styles.detailActionRow}>
                  <TouchableOpacity style={styles.secondaryActionButton} onPress={(event: any) => { event?.stopPropagation?.(); toggleWishlist(selectedProduct); }}>
                    <Text style={styles.secondaryActionButtonText}>{isSelectedWishlisted ? 'Saved for later' : 'Save for later'}</Text>
                  </TouchableOpacity>
                  <View style={styles.detailPrimaryActions}>
                    <TouchableOpacity
                      disabled={selectedProductOutOfStock}
                      style={[styles.primaryActionButton, selectedProductOutOfStock && styles.primaryActionButtonDisabled]}
                      onPress={(event: any) => {
                        event?.stopPropagation?.();
                        if (selectedProductQty > 0) {
                          setSelectedProduct(null);
                          openCartScreen();
                          return;
                        }
                        handleAddToCart(selectedProduct.id, 1, selectedProduct);
                      }}
                    >
                      <Text style={styles.primaryActionButtonText}>{selectedProductOutOfStock ? 'Out of stock' : selectedProductQty > 0 ? 'View cart' : 'Add to cart'}</Text>
                    </TouchableOpacity>
                    {!selectedProductOutOfStock ? <View style={styles.detailQuantityControl}>
                      <TouchableOpacity style={styles.quantityButton} onPress={(event: any) => { event?.stopPropagation?.(); adjustProductQuantity(selectedProduct.id, -1, selectedProduct); }}>
                        <Text style={styles.quantityButtonText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.quantityValue}>{selectedProductQty}</Text>
                      <TouchableOpacity style={styles.quantityButton} onPress={(event: any) => { event?.stopPropagation?.(); adjustProductQuantity(selectedProduct.id, 1, selectedProduct); }}>
                        <Text style={styles.quantityButtonText}>+</Text>
                      </TouchableOpacity>
                    </View> : null}
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        ) : null}

          <View style={styles.bottomNav}>
            {navItems.map((tab) => {
              const isSelected = activeTab === tab.key;
              return (
                <TouchableOpacity key={tab.key} style={[styles.navItem, isSelected && styles.navItemSelected]} onPress={() => {
                  if (tab.key === 'Categories') {
                    setCatalogMode('category');
                    setSelectedCategory('All Categories');
                    setSelectedCategoryId(null);
                  }
                  if (tab.key === 'Cart') {
                    setProfileRoute('cart');
                  }
                  if (tab.key === 'Settings') {
                    setProfileRoute('profile');
                  }
                  setActiveTab(tab.key);
                }}>
                  <View style={[styles.navIconBadge, isSelected && styles.navIconBadgeSelected]}>
                    <Text style={[styles.navIcon, isSelected && styles.navIconSelected]}>{tab.icon}</Text>
                    {tab.key === 'Cart' && cartCount > 0 ? <View style={styles.navCartBadge}><Text style={styles.navCartBadgeText}>{cartCount}</Text></View> : null}
                  </View>
                  <Text style={[styles.navText, isSelected && styles.navTextSelected]}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  containerNavy: { backgroundColor: '#01143F' },
  fullScreenPanel: { flex: 1, paddingBottom: 96, backgroundColor: '#F8FAFC' },
  splashContainer: {
    flex: 1,
    backgroundColor: '#01143F',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 42,
    paddingBottom: 48,
  },
  splashLogoImage: { width: 190, height: 78, marginTop: 18 },
  splashDeliveryImage: { width: '100%', height: 265, marginVertical: 6 },
  splashCopy: { alignItems: 'center', marginTop: -4 },
  splashLoader: { marginTop: 8 },
  logoStack: { display: 'none' },
  logoBadgeCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: -10,
    right: 15,
    elevation: 2,
  },
  logoBadgeCircleText: { fontSize: 12, color: '#FFFFFF' },
  splashLogo: { fontSize: 52, fontWeight: '800', color: '#1B2A4A', letterSpacing: 2.2 },
  splashTagline: { display: 'none' },
  splashImage: { display: 'none' },
  riderIllustration: { width: 220, height: 140, marginVertical: 24, justifyContent: 'center' },
  motorcycleBody: { position: 'absolute', bottom: 34, left: 40, width: 120, height: 38, borderRadius: 20, backgroundColor: '#F5821F' },
  motorcycleWheel: { position: 'absolute', bottom: 20, left: 54, width: 38, height: 38, borderRadius: 19, borderWidth: 8, borderColor: '#F7F7F9' },
  motorcycleWheelFront: { position: 'absolute', bottom: 20, right: 42, width: 38, height: 38, borderRadius: 19, borderWidth: 8, borderColor: '#F7F7F9' },
  helmet: { position: 'absolute', top: 20, right: 64, width: 42, height: 34, borderRadius: 16, backgroundColor: '#F5821F' },
  riderBody: { position: 'absolute', bottom: 32, right: 70, width: 54, height: 44, borderRadius: 24, backgroundColor: '#1B2A4A', borderWidth: 3, borderColor: '#F7F7F9' },
  deliveryBox: { position: 'absolute', bottom: 46, left: 80, width: 54, height: 40, borderRadius: 10, backgroundColor: '#F5821F', justifyContent: 'center', alignItems: 'center', padding: 6 },
  logoBadgeSmall: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFFFFF' },
  splashHeading: { fontSize: 25, fontWeight: '800', color: '#FFFFFF', textAlign: 'center', marginTop: 4 },
  splashSubtext: { color: '#D9E5F5', fontSize: 14, textAlign: 'center', marginTop: 10, lineHeight: 22 },
  screenRoot: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { flexGrow: 1, paddingBottom: 112, paddingHorizontal: 16, backgroundColor: '#F8FAFC' },
  loaderScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F7F7F9' },
  loaderText: { marginTop: 12, color: '#1B2A4A', fontSize: 14 },
  authRoot: { flex: 1, backgroundColor: '#F8FAFC', justifyContent: 'center', paddingHorizontal: 20 },
  authCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 8 }, shadowRadius: 20 },
  authTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  authSubtitle: { fontSize: 14, color: '#64748B', marginBottom: 20, lineHeight: 20 },
  authInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12, color: '#0F172A' },
  authErrorText: { color: '#B91C1C', fontSize: 13, marginBottom: 12 },
  authToggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  authToggleText: { color: '#475569', fontSize: 13 },
  authToggleLink: { color: '#2563EB', fontWeight: '700', marginLeft: 6 },
  // Header: deep navy background with white logo and icons
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12, backgroundColor: '#01143F', borderBottomWidth: 0 },
  // Icon button uses subtle translucent white on navy header
  iconButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', elevation: 0, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  headerIconText: { fontSize: 22, color: '#FFFFFF' },
  logoBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  logoTextBlock: { flexDirection: 'row', alignItems: 'center', position: 'relative', backgroundColor: 'transparent', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 12 },
  // Slightly larger logo container for the increased header
  logoImageWrapper: { width: 78, height: 30, borderRadius: 8, overflow: 'hidden', backgroundColor: 'transparent' },
  logoImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  productPlaceholder: { backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  tagline: { marginTop: 2, color: '#E6EEF6', fontSize: 8, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase' },
  sidebarToggleButton: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' },
  sidebarToggleText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  logoBadge: { position: 'absolute', top: -7, right: 12, width: 14, height: 14, borderRadius: 7, backgroundColor: '#2563EB' },
  badge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#F5821F', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: '#01143F' },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  errorBox: { marginHorizontal: 16, marginBottom: 10, padding: 10, borderRadius: 12, backgroundColor: '#FFF2E6' },
  errorText: { color: '#A25A00', fontSize: 12 },
  screenContent: { paddingHorizontal: 16, paddingTop: 4 },
  screenHeaderBox: { marginBottom: 12, padding: 14, borderRadius: 18, backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  screenTitle: { fontSize: 18, fontWeight: '800', color: '#1B2A4A' },
  screenSubtitle: { marginTop: 4, fontSize: 13, color: '#6B7280' },
  gridLayout: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  categoryScreenCard: { width: '48%', backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  categoryScreenIcon: { fontSize: 28, marginBottom: 4 },
  categoryScreenName: { fontSize: 14, fontWeight: '800', color: '#1B2A4A', marginTop: 8 },
  categoryScreenMeta: { marginTop: 6, fontSize: 12, color: '#F5821F', fontWeight: '700' },
  orderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  orderBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: '#FFF2E6' },
  orderBadgeText: { color: '#F5821F', fontSize: 11, fontWeight: '700' },
  orderMeta: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  orderTotal: { fontSize: 15, fontWeight: '800', color: '#1B2A4A' },
  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  avatarCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#1B2A4A', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  profileDetails: { flex: 1 },
  infoCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  infoLabel: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  infoValue: { fontSize: 14, fontWeight: '700', color: '#1B2A4A' },
  cartSummaryCard: { backgroundColor: '#F7F7F9', borderRadius: 16, padding: 12, marginBottom: 12 },
  cartSummaryTitle: { fontSize: 15, fontWeight: '800', color: '#1B2A4A' },
  cartSummarySubtitle: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  cartItemCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#F0F2F5' },
  cartItemImage: { width: 52, height: 52, borderRadius: 10, marginRight: 10, backgroundColor: '#FFFFFF' },
  cartItemImagePlaceholder: { width: 52, height: 52, borderRadius: 10, marginRight: 10, backgroundColor: '#FFFFFF' },
  cartItemTextBlock: { flex: 1, paddingRight: 8 },
  cartItemPrice: { marginTop: 4, fontSize: 12, fontWeight: '700', color: '#F5821F' },
  cartItemQtyBox: { backgroundColor: '#FFF2E6', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  cartItemQtyText: { color: '#F5821F', fontWeight: '700', fontSize: 12 },
  cartStepperBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F7F9', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 4 },
  stepperButton: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  stepperButtonText: { color: '#1B2A4A', fontSize: 16, fontWeight: '700' },
  stepperValue: { minWidth: 24, textAlign: 'center', fontSize: 13, fontWeight: '800', color: '#1B2A4A', marginHorizontal: 6 },
  checkoutSummaryCard: { backgroundColor: '#F7F7F9', borderRadius: 16, padding: 12, marginTop: 8, marginBottom: 12 },
  orderSummaryCard: { backgroundColor: '#F7F7F9', borderRadius: 16, padding: 14, marginTop: 16, marginBottom: 16 },
  orderSummaryTitle: { fontSize: 15, fontWeight: '800', color: '#1B2A4A', marginBottom: 10 },
  checkoutSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  checkoutSectionTitle: { fontSize: 16, fontWeight: '800', color: '#1B2A4A', marginBottom: 0 },
  checkoutSectionStatus: { color: '#F5821F', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  addressCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  addressText: { fontSize: 13, color: '#6B7280', lineHeight: 20, marginTop: 8 },
  addressInput: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, color: '#111827', minHeight: 120, textAlignVertical: 'top', marginBottom: 16 },
  locationHint: { fontSize: 12, color: '#94A3B8', marginTop: 6, marginBottom: 6 },
  locationTypeInput: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, color: '#111827', marginBottom: 10 },
  locationSelectDisabled: { opacity: 0.5 },
  paymentCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  paymentLabel: { fontSize: 12, color: '#6B7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  paymentOptionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  paymentMethodTitle: { fontSize: 15, fontWeight: '800', color: '#1B2A4A' },
  paymentMethodSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  paymentBadge: { backgroundColor: '#EAFBF2', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  paymentBadgeText: { color: '#166534', fontSize: 11, fontWeight: '800' },
  checkoutPageContent: { paddingHorizontal: 16, paddingBottom: 32 },
  checkoutProgressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 18, paddingBottom: 4 },
  checkoutProgressStep: { alignItems: 'center', gap: 4 },
  checkoutProgressStepActive: {},
  checkoutProgressNumber: { width: 26, height: 26, borderRadius: 13, overflow: 'hidden', textAlign: 'center', paddingTop: 5, backgroundColor: '#E2E8F0', color: '#64748B', fontSize: 12, fontWeight: '800' },
  checkoutProgressLabel: { color: '#64748B', fontSize: 11, fontWeight: '700' },
  checkoutProgressLine: { width: 88, height: 2, backgroundColor: '#E2E8F0', marginHorizontal: 8, marginTop: -17 },
  checkoutAuthCard: { margin: 16, marginTop: 22, alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  checkoutAuthIcon: { fontSize: 30, marginBottom: 12 },
  checkoutAuthTitle: { color: '#0F172A', fontSize: 20, fontWeight: '800' },
  checkoutAuthText: { color: '#64748B', fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 8, marginBottom: 18 },
  checkoutConfirmButton: { marginTop: 18, backgroundColor: '#F5821F', borderRadius: 14, paddingVertical: 15, paddingHorizontal: 18, alignItems: 'center', shadowColor: '#F5821F', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  successCard: { backgroundColor: '#F7F7F9', borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 24 },
  successIcon: { fontSize: 38, marginBottom: 14 },
  successTitle: { fontSize: 20, fontWeight: '800', color: '#1B2A4A', textAlign: 'center' },
  successSubtitle: { marginTop: 8, fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  summaryLabel: { color: '#6B7280', fontSize: 13 },
  summaryValue: { color: '#1B2A4A', fontSize: 13, fontWeight: '700' },
  summaryRowStrong: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  summaryLabelStrong: { color: '#1B2A4A', fontSize: 14, fontWeight: '800' },
  summaryValueStrong: { color: '#F5821F', fontSize: 15, fontWeight: '800' },
  // Floating, white search bar that sits below the navy header (reduced size)
  searchBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 0, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  homeScreenRoot: { flex: 1, backgroundColor: '#01143F' },
  homeTopStatic: { backgroundColor: '#01143F', zIndex: 2 },
  homeScroll: { flex: 1, backgroundColor: 'transparent' },
  homePageShell: { backgroundColor: 'transparent' },
  contentSectionWhite: { backgroundColor: '#FFFFFF', paddingBottom: 12, marginHorizontal: -16, paddingHorizontal: 0 },
  cartFeedbackBar: { marginHorizontal: 16, marginBottom: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: '#EAFBF2', borderWidth: 1, borderColor: '#BFE9CF' },
  cartFeedbackText: { color: '#166534', fontSize: 13, fontWeight: '700' },
  checkoutNoticeBox: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12, width: '100%' },
  checkoutNoticeSuccess: { backgroundColor: '#EAFBF2', borderWidth: 1, borderColor: '#BFE9CF' },
  checkoutNoticeError: { backgroundColor: '#FFF1F2', borderWidth: 1, borderColor: '#FECACA' },
  checkoutNoticeText: { color: '#1B2A4A', fontSize: 13, fontWeight: '700' },
  searchInput: { flex: 1, color: '#111827', fontSize: 13, paddingVertical: 0 },
  // Orange search action to match accent color
  searchButton: { marginLeft: 8, width: 42, height: 42, borderRadius: 21, backgroundColor: '#F5821F', justifyContent: 'center', alignItems: 'center' },
  searchButtonIcon: { fontSize: 18, color: '#FFFFFF' },
  heroCardShell: { width: '100%', marginHorizontal: 0, marginBottom: 20, borderRadius: 16, backgroundColor: 'transparent', padding: 0, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  heroBodyShell: { marginHorizontal: -16, borderRadius: 16, backgroundColor: 'transparent', paddingHorizontal: 0, paddingVertical: 0, overflow: 'hidden' },
  heroBodyContent: { paddingHorizontal: 16, paddingTop: 0 },
  promoBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#EFF6FF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginTop: 14, marginBottom: 4, borderWidth: 1, borderColor: '#BFDBFE' },
  promoBannerTextWrap: { flex: 1, paddingRight: 10 },
  promoBannerTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  promoBannerSubtitle: { marginTop: 2, fontSize: 12, color: '#64748B' },
  promoBannerButton: { backgroundColor: '#2563EB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  promoBannerButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  // Hero card: dark navy panel to match the mockup
  heroCard: { width: '100%', borderRadius: 12, backgroundColor: '#1B2A4A', paddingHorizontal: 0, paddingVertical: 0, flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', minHeight: 220, position: 'relative', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)' },
  heroCardCompact: { alignItems: 'flex-start' },
  heroTextContainer: { position: 'absolute', zIndex: 1, left: 18, top: 18, bottom: 18, width: '52%', justifyContent: 'center', alignItems: 'flex-start' },
  heroImageWrapper: { width: 120, height: 170, borderRadius: 18, overflow: 'hidden', backgroundColor: 'transparent', borderWidth: 0, marginLeft: 12 },
  heroImage: { width: '100%', height: '100%' },
  heroBackgroundImage: { borderRadius: 12, position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  heroOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(15, 23, 42, 0.18)' },
  heroPill: { alignSelf: 'flex-start', backgroundColor: 'rgba(245,130,31,0.18)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10 },
  heroPillText: { color: '#FDC38B', fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  heroLine: { alignSelf: 'flex-start', color: '#FFFFFF', fontSize: 28, lineHeight: 36, fontWeight: '800', marginBottom: 6, textAlign: 'left' },
  heroDelivered: { alignSelf: 'flex-start', color: '#BFDBFE', fontSize: 15, lineHeight: 22, fontWeight: '700', marginTop: 6, marginBottom: 12, maxWidth: '100%', textAlign: 'left' },
  // Prominent orange CTA button
  shopButton: { marginTop: 0, backgroundColor: '#F5821F', alignSelf: 'flex-start', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10, shadowColor: '#F5821F', shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  shopButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 18, paddingBottom: 10, marginHorizontal: 0 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  viewAll: { color: '#2563EB', fontSize: 13, fontWeight: '700' },
  horizontalList: { paddingLeft: 16, paddingRight: 16 },
  horizontalListContent: { paddingRight: 16 },
  categoryCard: { width: 78, height: 102, backgroundColor: '#FFFFFF', borderRadius: 10, padding: 6, marginRight: 8, alignItems: 'stretch', justifyContent: 'flex-start', shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2, borderWidth: 1, borderColor: '#F1F5F9' },
  categoryIconBadge: { width: '100%', height: 54, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 5, overflow: 'hidden', backgroundColor: '#F8FAFC' },
  categoryIconGlyph: { fontSize: 20 },
  categoryIconImage: { width: '100%', height: '100%' },
  sidebarIconImage: { width: 24, height: 24, borderRadius: 6 },
  categoryName: { fontSize: 10, color: '#0F172A', fontWeight: '700', textAlign: 'center', marginTop: 'auto', lineHeight: 13, paddingHorizontal: 0, paddingBottom: 0 },
  productCard: { width: 170, backgroundColor: '#FFFFFF', borderRadius: 12, marginRight: 12, overflow: 'hidden', shadowOpacity: 0, elevation: 0, borderWidth: 0, borderColor: 'transparent', position: 'relative' },
  productImage: { width: '100%', aspectRatio: 1.25, backgroundColor: '#F8FAFC' },
  productContent: { padding: 10 },
  productMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  productBadge: { flexShrink: 1, backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  productBadgeText: { color: '#2563EB', fontSize: 10, fontWeight: '800' },
  productDeliveryText: { marginLeft: 6, flexShrink: 1, color: '#64748B', fontSize: 10, fontWeight: '700', textAlign: 'right' },
  productName: { minHeight: 34, flexShrink: 1, fontSize: 13, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  // Make price accent orange like the mock
  productPrice: { marginTop: 6, flexShrink: 1, fontSize: 13, fontWeight: '800', color: '#F5821F' },
  productActions: { marginTop: 'auto', paddingTop: 14, alignItems: 'center', justifyContent: 'center', width: '100%' },
  cartButton: { marginTop: 'auto', backgroundColor: '#2563EB', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 20, alignItems: 'center', alignSelf: 'center', minWidth: 140 },
  cartButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 0, paddingBottom: 18 },
  productGridCard: { width: '48%', backgroundColor: '#FFFFFF', borderRadius: 12, marginBottom: 12, overflow: 'hidden', shadowOpacity: 0, elevation: 0, borderWidth: 0, borderColor: 'transparent', position: 'relative' },
  productGridImage: { width: '100%', aspectRatio: 1, backgroundColor: '#F8FAFC' },
  productGridContent: { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 12 },
  productGridMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  productGridBadge: { flexShrink: 1, backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  productGridBadgeText: { color: '#2563EB', fontSize: 9, fontWeight: '800' },
  productGridDeliveryText: { marginLeft: 6, flexShrink: 1, color: '#64748B', fontSize: 10, fontWeight: '700', textAlign: 'right' },
  outOfStockText: { color: '#B91C1C' },
  productGridName: { minHeight: 34, flexShrink: 1, fontSize: 13, fontWeight: '800', color: '#0F172A', marginBottom: 6 },
  productGridPrice: { marginTop: 6, flexShrink: 1, fontSize: 13, fontWeight: '800', color: '#2563EB' },
  productGridCartButton: { marginTop: 10, backgroundColor: '#2563EB', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center', width: '100%' },
  productGridCartButtonDisabled: { backgroundColor: '#94A3B8' },
  productGridCartButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  categoryIntroCard: { backgroundColor: '#F8FAFC', borderRadius: 18, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  categoryIntroHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  categoryIntroTextBlock: { flex: 1, paddingRight: 8 },
  categoryIntroText: { marginTop: 4, color: '#6B7280', fontSize: 12, lineHeight: 18 },
  categoryIntroMetaWrap: { width: 150, alignItems: 'flex-end' },
  categoryIntroSearchBox: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8 },
  categoryIntroSearchInput: { color: '#111827', fontSize: 12, paddingVertical: 0 },
  categoryIntroChip: { alignSelf: 'flex-end', backgroundColor: '#2563EB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  categoryIntroChipText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  categoryIntroChipDropdown: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', backgroundColor: '#2563EB', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
  categoryIntroChipIcon: { marginRight: 6, fontSize: 14 },
  categoryIntroChipButton: { paddingHorizontal: 6 },
  categoryFilterRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  categoryFilterChip: { marginRight: 8, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  categoryFilterChipActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  categoryFilterChipText: { color: '#64748B', fontSize: 12, fontWeight: '700' },
  categoryFilterChipTextActive: { color: '#2563EB' },
  featuredStrip: { backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#BFDBFE' },
  featuredStripContent: { marginBottom: 8 },
  featuredStripTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  featuredStripText: { marginTop: 2, fontSize: 12, color: '#64748B', lineHeight: 18 },
  featuredStripPills: { flexDirection: 'row', flexWrap: 'wrap' },
  featuredStripPill: { marginRight: 8, marginBottom: 8, backgroundColor: '#FFFFFF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#BFDBFE' },
  featuredStripPillText: { color: '#0F172A', fontSize: 11, fontWeight: '700' },
  quantityControl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F7F9', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 4, alignSelf: 'center' },
  quantityButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#2563EB' },
  quantityButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  quantityValue: { minWidth: 24, textAlign: 'center', fontSize: 13, fontWeight: '800', color: '#1B2A4A', marginHorizontal: 8 },
  favoriteButton: { position: 'absolute', top: 10, right: 10, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.92)', justifyContent: 'center', alignItems: 'center' },
  favoriteButtonText: { fontSize: 16, color: '#2563EB' },
  miniProductCard: { width: 140, backgroundColor: '#FFFFFF', borderRadius: 12, marginRight: 10, overflow: 'hidden', shadowOpacity: 0, elevation: 0, borderWidth: 0, borderColor: 'transparent' },
  miniProductImage: { width: '100%', aspectRatio: 1.3, backgroundColor: '#F8FAFC' },
  miniProductContent: { padding: 10 },
  miniProductTag: { color: '#2563EB', fontSize: 10, fontWeight: '800' },
  miniProductName: { minHeight: 34, flexShrink: 1, marginTop: 6, fontSize: 13, fontWeight: '700', color: '#0F172A' },
  miniProductPrice: { marginTop: 6, flexShrink: 1, fontSize: 12, fontWeight: '700', color: '#64748B' },
  recentlyViewedSection: { marginTop: 18, paddingHorizontal: 16 },
  recentlyViewedTitle: { color: '#0F172A', fontSize: 17, fontWeight: '800', marginBottom: 10 },
  recentlyViewedList: { paddingRight: 4 },
  recentlyViewedCard: { width: 126, marginRight: 10, backgroundColor: '#FFFFFF', borderRadius: 12, overflow: 'hidden', borderWidth: 0 },
  recentlyViewedImage: { width: '100%', height: 92, backgroundColor: '#FFFFFF' },
  recentlyViewedName: { minHeight: 34, marginHorizontal: 9, marginTop: 8, color: '#0F172A', fontSize: 12, fontWeight: '700' },
  recentlyViewedPrice: { marginHorizontal: 9, marginTop: 3, marginBottom: 10, color: '#2563EB', fontSize: 11, fontWeight: '800' },
  detailOverlay: { ...StyleSheet.absoluteFill, zIndex: 20, justifyContent: 'flex-end' },
  detailOverlayBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(3, 8, 20, 0.45)' },
  detailSheet: { backgroundColor: '#F8FAFC', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 24, height: '92%', overflow: 'hidden' },
  detailSheetHandle: { width: 48, height: 5, borderRadius: 999, backgroundColor: '#1B2A4A', alignSelf: 'center', marginTop: 10 },
  detailSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  detailCloseButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  detailCloseButtonText: { fontSize: 16, color: '#1B2A4A' },
  detailButton: { marginTop: 16, backgroundColor: '#EFF6FF', borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#BFDBFE' },
  detailButtonText: { color: '#2563EB', fontWeight: '700', fontSize: 14 },
  detailFavoriteButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF2E6', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FEDDC2' },
  detailFavoriteButtonText: { fontSize: 16, color: '#F5821F' },
  detailScrollContent: { paddingHorizontal: 16, paddingBottom: 12 },
  detailHeroImage: { width: '100%', height: 220, borderRadius: 20, backgroundColor: '#FFFFFF' },
  detailGalleryRow: { flexDirection: 'row', marginTop: 12 },
  detailThumbCard: { width: 74, height: 56, borderRadius: 12, overflow: 'hidden', marginRight: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB' },
  detailThumbCardActive: { borderColor: '#F5821F', borderWidth: 2 },
  detailThumbImage: { width: '100%', height: '100%' },
  detailTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 14 },
  detailTitleBlock: { flex: 1, paddingRight: 8 },
  detailTitle: { fontSize: 20, fontWeight: '800', color: '#1B2A4A' },
  detailCategory: { marginTop: 4, fontSize: 13, color: '#6B7280' },
  detailPriceChip: { backgroundColor: '#FFF2E6', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  detailPriceText: { fontSize: 13, fontWeight: '800', color: '#F5821F' },
  detailDescription: { marginTop: 12, fontSize: 14, lineHeight: 22, color: '#4B5563' },
  detailHighlightsRow: { flexDirection: 'row', marginTop: 16 },
  detailHighlightBox: { flex: 1, backgroundColor: '#FFF2E6', borderRadius: 14, padding: 12, marginRight: 8, borderWidth: 1, borderColor: '#FEDDC2' },
  detailHighlightLabel: { fontSize: 11, color: '#F5821F', fontWeight: '700' },
  detailHighlightValue: { marginTop: 4, fontSize: 13, fontWeight: '700', color: '#1B2A4A' },
  detailActionRow: { flexDirection: 'column', marginTop: 18, gap: 10 },
  detailPrimaryActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  detailQuantityControl: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF6FF', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 6, borderWidth: 1, borderColor: '#BFDBFE' },
  secondaryActionButton: { backgroundColor: '#EFF6FF', borderRadius: 999, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center', borderWidth: 1, borderColor: '#BFDBFE' },
  secondaryActionButtonText: { color: '#2563EB', fontWeight: '700', fontSize: 13 },
  primaryActionButton: { flex: 1, backgroundColor: '#2563EB', borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
  primaryActionButtonDisabled: { backgroundColor: '#94A3B8' },
  primaryActionButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  categoryPage: { flex: 1, backgroundColor: '#F8FAFC' },
  screenHeaderNavy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#01143F', borderBottomWidth: 0 },
  headerIconButton: { width: 40, height: 40, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  headerBackArrow: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  searchBarCategories: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 12, marginBottom: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB' },
  headerActionsRow: { flexDirection: 'row', alignItems: 'center' },
  categorySplitView: { flex: 1, flexDirection: 'row' },
  categorySidebar: { width: 150, flexGrow: 0, backgroundColor: '#FFFFFF', borderRightWidth: 1, borderRightColor: '#E2E8F0' },
  categorySidebarContent: { paddingVertical: 8 },
  sidebarRow: { paddingVertical: 10, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 3, borderLeftColor: 'transparent', minHeight: 52 },
  sidebarRowActive: { backgroundColor: '#EFF6FF', borderLeftColor: '#2563EB' },
  sidebarIconBadge: { width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 8, overflow: 'hidden', flexShrink: 0 },
  sidebarIconText: { marginRight: 8, fontSize: 16 },
  sidebarLabel: { flexShrink: 1, color: '#64748B', fontSize: 12, fontWeight: '700', lineHeight: 15, maxWidth: 92 },
  sidebarLabelActive: { color: '#2563EB', fontWeight: '800' },
  categoryContentArea: { flex: 1, backgroundColor: '#F8FAFC', padding: 12 },
  gridContent: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingBottom: 16 },
  emptyStateCard: { width: '100%', backgroundColor: '#F7F7F9', borderRadius: 18, padding: 18, marginTop: 6, borderWidth: 1, borderColor: '#E5E7EB' },
  emptyStateTitle: { fontSize: 15, fontWeight: '800', color: '#1B2A4A', marginBottom: 6 },
  emptyStateText: { fontSize: 13, color: '#6B7280', lineHeight: 20 },
  categoryGridCard: { width: '31%', backgroundColor: '#FFFFFF', borderRadius: 18, padding: 10, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  categoryGridIconBadge: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  gridImage: { width: '100%', height: 90, borderRadius: 12, backgroundColor: '#F5F5F5' },
  gridCardTitle: { fontSize: 13, fontWeight: '800', color: '#1B2A4A', marginTop: 10 },
  gridCardCount: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  ordersPage: { flex: 1, backgroundColor: '#F5F7FB' },
  filterTabsRow: { backgroundColor: '#01143F', paddingVertical: 4, marginTop: 0 },
  filterTabsContent: { paddingHorizontal: 16, paddingVertical: 0, flexGrow: 1, justifyContent: 'space-between' },
  filterTab: { alignItems: 'center', paddingHorizontal: 8, paddingBottom: 7 },
  filterTabText: { color: '#D7E1F0', fontWeight: '700', fontSize: 13 },
  filterTabTextActive: { color: '#F5821F' },
  filterTabUnderline: { marginTop: 4, width: '100%', height: 2, backgroundColor: '#F5821F', borderRadius: 999 },
  orderListContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 },
  listFooter: { paddingVertical: 16, alignItems: 'center' },
  listFooterText: { marginTop: 8, color: '#6B7280', fontSize: 12 },
  ordersIntroCard: { backgroundColor: '#FFF7ED', borderRadius: 16, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#FDE3C5' },
  ordersIntroTitle: { color: '#1B2A4A', fontSize: 14, fontWeight: '800', marginBottom: 4 },
  ordersIntroText: { color: '#6B7280', fontSize: 12, lineHeight: 18 },
  orderCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E6EAF0', shadowColor: '#1B2A4A', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  orderCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  orderCardHeaderLeft: { flex: 1, paddingRight: 12 },
  orderNumber: { fontSize: 14, fontWeight: '800', color: '#1B2A4A', marginBottom: 3 },
  orderDate: { color: '#64748B', fontSize: 11, marginTop: 1 },
  thumbnailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  thumbBox: { width: 34, height: 34, borderRadius: 6, backgroundColor: '#F1F5F9', marginRight: 8 },
  thumbImage: { width: 34, height: 34, borderRadius: 6, marginRight: 8, backgroundColor: '#FFFFFF' },
  moreThumbBadge: { width: 34, height: 34, borderRadius: 6, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9' },
  moreThumbText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  orderSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  orderItemCount: { color: '#1B2A4A', fontSize: 13, fontWeight: '800' },
  orderDetailItem: { flex: 1 },
  orderDetailLabel: { fontSize: 11, color: '#64748B', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  orderDetailValue: { fontSize: 14, fontWeight: '700', color: '#1B2A4A' },
  orderTotalAmount: { fontSize: 13, fontWeight: '800', color: '#1B2A4A', textAlign: 'right' },
  orderTagRow: { marginBottom: 14 },
  orderLocalTag: { alignSelf: 'flex-start', backgroundColor: '#FEF3F2', color: '#DC2626', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, fontWeight: '700', fontSize: 12 },
  retryButton: { backgroundColor: '#DC2626', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center', marginLeft: 8 },
  retryButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  viewButton: { width: '100%', borderWidth: 1, borderColor: '#D7DDE7', borderRadius: 7, paddingVertical: 8, alignItems: 'center' },
  viewButtonText: { color: '#1B2A4A', fontWeight: '700', fontSize: 12 },
  reorderButton: { flex: 1, backgroundColor: '#F5821F', borderRadius: 999, paddingVertical: 12, alignItems: 'center', shadowColor: '#F5821F', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  reorderButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  ordersEmptyActionButton: { marginTop: 16, backgroundColor: '#F5821F', borderRadius: 999, paddingVertical: 12, paddingHorizontal: 20, alignSelf: 'flex-start', shadowColor: '#F5821F', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  ordersEmptyActionText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  orderActionsRow: { flexDirection: 'row', alignItems: 'center' },
  trackingCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, marginTop: 16, shadowColor: '#1B2A4A', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  trackingHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  trackingTitle: { fontSize: 16, fontWeight: '800', color: '#1B2A4A' },
  trackingSubtitle: { fontSize: 13, color: '#F5821F', marginTop: 4, fontWeight: '700' },
  etaBadge: { backgroundColor: '#FFF2E6', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  etaBadgeText: { color: '#F5821F', fontSize: 12, fontWeight: '800' },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 10 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#D1D5DB', marginTop: 4, marginRight: 10 },
  timelineDotActive: { backgroundColor: '#F5821F' },
  timelineContent: { flex: 1 },
  timelineTitle: { fontSize: 14, fontWeight: '700', color: '#1B2A4A' },
  timelineDescription: { fontSize: 12, color: '#6B7280', marginTop: 3, lineHeight: 18 },
  historyRow: { flexDirection: 'row', marginTop: 12, alignItems: 'flex-start' },
  historyTime: { width: 48, color: '#F5821F', fontSize: 12, fontWeight: '800', marginRight: 8 },
  historyContent: { flex: 1 },
  secondaryButton: { marginTop: 10, borderWidth: 1, borderColor: '#F5821F', borderRadius: 999, paddingVertical: 10, alignItems: 'center' },
  secondaryButtonText: { color: '#F5821F', fontWeight: '700', fontSize: 13 },
  inputField: { borderWidth: 1, borderColor: '#DCE5F1', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, marginTop: 8, color: '#0F172A', fontSize: 14, backgroundColor: '#F8FAFC' },
  passwordInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  passwordInput: { flex: 1, marginTop: 0 },
  passwordToggleButton: { marginLeft: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: '#FFF3E9', borderWidth: 1, borderColor: '#F8C9A2' },
  passwordToggleText: { color: '#D8650D', fontSize: 12, fontWeight: '800' },
  locationLabel: { color: '#64748B', fontSize: 12, fontWeight: '700', marginTop: 12, marginBottom: 4 },
  locationSelect: { minHeight: 50, borderWidth: 1, borderColor: '#DCE5F1', borderRadius: 14, paddingHorizontal: 14, backgroundColor: '#F8FAFC', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  locationSelectValue: { color: '#0F172A', fontSize: 14, fontWeight: '600' },
  locationSelectPlaceholder: { color: '#94A3B8', fontSize: 14 },
  locationSelectArrow: { color: '#F5821F', fontSize: 20, fontWeight: '800' },
  locationModalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'center', padding: 24 },
  locationModalCard: { maxHeight: '75%', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18 },
  locationModalTitle: { color: '#0F172A', fontSize: 18, fontWeight: '800', marginBottom: 10, textTransform: 'capitalize' },
  locationSearchInput: { borderWidth: 1, borderColor: '#DCE5F1', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, color: '#0F172A', fontSize: 14, backgroundColor: '#F8FAFC', marginBottom: 8 },
  locationOptions: { maxHeight: 360 },
  locationOption: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#EEF2F7' },
  locationOptionText: { color: '#1B2A4A', fontSize: 15, fontWeight: '600' },
  passwordMessage: { marginTop: 12, color: '#F5821F', fontSize: 13, fontWeight: '700' },
  notificationCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F7F7F9', borderRadius: 16, padding: 12, marginBottom: 12 },
  notificationTextArea: { flex: 1, paddingRight: 12 },
  notificationList: { gap: 8, marginBottom: 12 },
  inAppNotification: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, backgroundColor: '#FFFFFF', padding: 12 },
  inAppNotificationUnread: { borderColor: '#FDC38B', backgroundColor: '#FFF7ED' },
  inAppNotificationTitle: { color: '#1B2A4A', fontSize: 14, fontWeight: '800' },
  inAppNotificationMessage: { color: '#64748B', fontSize: 13, lineHeight: 19, marginTop: 4 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  statusPending: { backgroundColor: '#FFF2E6' },
  statusConfirmed: { backgroundColor: '#EFF6FF' },
  statusDelivered: { backgroundColor: '#EAFBF2' },
  statusBadgeText: { color: '#1B2A4A', fontSize: 11, fontWeight: '700' },
  orderDetailCard: { margin: 16, padding: 16, borderRadius: 20, backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  detailNumber: { fontSize: 17, fontWeight: '800', color: '#1B2A4A' },
  detailMeta: { fontSize: 13, color: '#6B7280', marginTop: 6 },
  detailTotal: { fontSize: 20, fontWeight: '800', color: '#1B2A4A', marginTop: 12 },
  profilePage: { flex: 1, backgroundColor: '#F7F7F9', paddingBottom: 24 },
  profileHeaderBlock: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 24, backgroundColor: '#01143F', borderBottomLeftRadius: 32, borderBottomRightRadius: 32, minHeight: 126 },
  profileHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  profileHeaderBack: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  profileHeaderBackText: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  profileHeaderTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  profileHeaderScreenTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginTop: 10, letterSpacing: -0.5 },
  profileHeaderSubtitle: { color: '#B8C8E5', fontSize: 13, marginTop: 6, lineHeight: 19 },
  profileAuthLogoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  profileAuthLogo: { width: 38, height: 38, borderRadius: 12, marginRight: 10, backgroundColor: '#FFFFFF' },
  profileAuthBrand: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: 2 },
  profileAuthBrandNote: { color: '#F7B06C', fontSize: 8, marginTop: 2, fontWeight: '800', letterSpacing: 0.4 },
  profileHeaderIcon: { fontSize: 18 },
  profileSettingsButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  profileIdentityRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, paddingRight: 8 },
  profilePhotoShell: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', position: 'relative' },
  profileImage: { width: 72, height: 72, borderRadius: 36 },
  profilePhotoText: { fontSize: 30, color: '#1B2A4A' },
  photoBadgeButton: { position: 'absolute', bottom: 2, right: -2, width: 28, height: 28, borderRadius: 14, backgroundColor: '#F5821F', justifyContent: 'center', alignItems: 'center' },
  photoBadgeText: { fontSize: 12 },
  profileIdentity: { flex: 1, marginLeft: 14 },
  profileName: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  profileEmail: { color: '#D1D5DB', fontSize: 13, marginTop: 4 },
  profilePhone: { color: '#F5821F', fontSize: 13, marginTop: 4, fontWeight: '700' },
  memberBadgeRow: { display: 'none' },
  memberBadge: { backgroundColor: 'rgba(245,130,31,0.18)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(245,130,31,0.35)' },
  memberBadgeText: { color: '#FDC38B', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  memberSinceText: { color: '#D1D5DB', fontSize: 11, marginLeft: 10 },
  accountOverviewCard: { marginTop: -20, marginHorizontal: 16, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  accountOverviewHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  accountOverviewTitle: { fontSize: 16, fontWeight: '800', color: '#1B2A4A' },
  accountOverviewCaption: { marginTop: 4, fontSize: 12, color: '#6B7280' },
  accountOverviewBadge: { backgroundColor: '#EAFBF2', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  accountOverviewBadgeText: { color: '#166534', fontSize: 11, fontWeight: '800' },
  statGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  statBox: { width: '24%', alignItems: 'center' },
  statIcon: { fontSize: 23, color: '#F5821F', marginBottom: 6 },
  statValue: { color: '#1B2A4A', fontSize: 14, fontWeight: '800', marginTop: 4 },
  statLabel: { color: '#1B2A4A', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  quickActionsCard: { display: 'none' },
  quickActionsTitle: { fontSize: 15, fontWeight: '800', color: '#1B2A4A' },
  quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 12 },
  quickActionCard: { width: '48%', backgroundColor: '#F7F7F9', borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#F0F2F5' },
  quickActionIconShell: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  quickActionIcon: { fontSize: 16 },
  profilePreferenceCard: { display: 'none' },
  profilePreferenceHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  profilePreferenceText: { marginTop: 6, color: '#4B5563', fontSize: 13, lineHeight: 20 },
  profilePreferenceMeta: { marginTop: 4, color: '#F5821F', fontSize: 12, fontWeight: '700' },
  profilePreferenceBadge: { backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, marginLeft: 8 },
  profilePreferenceBadgeText: { color: '#1B2A4A', fontSize: 10, fontWeight: '800' },
  quickActionTitle: { color: '#1B2A4A', fontSize: 13, fontWeight: '800' },
  quickActionSubtitle: { color: '#6B7280', fontSize: 11, marginTop: 4 },
  menuList: { marginTop: 14, marginHorizontal: 16, backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  menuListHeader: { display: 'none' },
  menuListTitle: { color: '#1B2A4A', fontSize: 15, fontWeight: '800' },
  menuListHint: { color: '#6B7280', fontSize: 12, marginTop: 4 },
  menuRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  recentOrdersCard: { display: 'none' },
  recentOrdersHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  recentOrderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  recentOrderTextBlock: { flex: 1, paddingRight: 10 },
  favoriteItemCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  favoriteItemImage: { width: 48, height: 48, borderRadius: 12, marginRight: 12, backgroundColor: '#FFFFFF' },
  favoriteItemImagePlaceholder: { width: 48, height: 48, borderRadius: 12, marginRight: 12, backgroundColor: '#FFFFFF' },
  favoriteItemTextBlock: { flex: 1, paddingRight: 8 },
  addressOptionCard: { backgroundColor: '#F7F7F9', borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  addressOptionCardActive: { borderColor: '#F5821F', backgroundColor: '#FFF7ED' },
  addressOptionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addressBadge: { backgroundColor: '#EAFBF2', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  addressBadgeText: { color: '#166534', fontSize: 10, fontWeight: '800' },
  
  menuLabelWrap: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  menuIconShell: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F7F7F9', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  menuIcon: { fontSize: 14 },
  menuLabel: { color: '#111827', fontSize: 14, fontWeight: '700' },
  menuChevron: { color: '#9CA3AF', fontSize: 18 },
  primaryButton: { marginTop: 16, marginHorizontal: 16, backgroundColor: '#F5821F', borderRadius: 999, paddingVertical: 12, alignItems: 'center', shadowColor: '#F5821F', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  logoutButton: { marginTop: 16, marginHorizontal: 16, backgroundColor: '#FF6400', borderRadius: 10, paddingVertical: 15, alignItems: 'center', shadowColor: '#F5821F', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  logoutButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  checkoutIntroCard: { backgroundColor: '#FFF7ED', borderRadius: 16, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#FDE3C5' },
  checkoutIntroTitle: { color: '#1B2A4A', fontSize: 14, fontWeight: '800', marginBottom: 8 },
  checkoutItemsList: { gap: 8, marginBottom: 8 },
  checkoutItemRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 8, borderWidth: 1, borderColor: '#FDE3C5' },
  checkoutItemImage: { width: 42, height: 42, borderRadius: 10, marginRight: 10, backgroundColor: '#F8FAFC' },
  checkoutItemTextWrap: { flex: 1 },
  checkoutItemName: { color: '#1B2A4A', fontSize: 12, fontWeight: '700' },
  checkoutItemMeta: { color: '#64748B', fontSize: 11, marginTop: 2 },
  checkoutIntroText: { color: '#6B7280', fontSize: 12, lineHeight: 18 },
  profileDetailCard: { marginTop: 20, marginHorizontal: 16, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  profileAuthCard: { marginTop: -26, marginHorizontal: 16, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, shadowColor: '#1B2A4A', shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  profileAuthPill: { alignSelf: 'flex-start', backgroundColor: '#FFF1E5', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 10 },
  profileAuthPillText: { color: '#D8650D', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  profileAuthTitle: { color: '#0B1F44', fontSize: 22, fontWeight: '900', letterSpacing: -0.4 },
  profileAuthText: { color: '#64748B', fontSize: 13, lineHeight: 20, marginTop: 7, marginBottom: 10 },
  profileAuthFieldLabel: { color: '#64748B', fontSize: 10, fontWeight: '900', letterSpacing: 0.8, marginTop: 16 },
  profileAuthInlineFields: { flexDirection: 'row', gap: 8 },
  profileAuthHalfField: { flex: 1 },
  profileAuthHint: { color: '#64748B', fontSize: 11, lineHeight: 16, marginTop: 8 },
  profileAuthError: { color: '#B42318', fontSize: 12, fontWeight: '700', marginTop: 14, padding: 10, borderRadius: 10, backgroundColor: '#FEF3F2' },
  profileAuthPrimaryButton: { marginTop: 20, backgroundColor: '#F5821F', borderRadius: 14, paddingVertical: 15, alignItems: 'center', shadowColor: '#F5821F', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  profileAuthSecondaryButton: { marginTop: 12, borderWidth: 1, borderColor: '#F1B177', borderRadius: 14, paddingVertical: 13, alignItems: 'center', backgroundColor: '#FFFDFC' },
  forgotPasswordButton: { alignSelf: 'flex-end', paddingVertical: 12, paddingHorizontal: 2 },
  forgotPasswordText: { color: '#D8650D', fontSize: 13, fontWeight: '800' },
  profileAuthSecondaryText: { color: '#F5821F', fontSize: 13, fontWeight: '800' },
  profileDetailBody: { color: '#4B5563', fontSize: 14, lineHeight: 22, marginBottom: 16 },
  profilePageContent: { paddingBottom: 120 },
  cartListContainer: { gap: 10 },
  cartSummaryBar: { position: 'absolute', left: 16, right: 16, bottom: 90, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, backgroundColor: '#01143F', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  cartSummaryBarTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  cartSummaryBarSubtitle: { color: '#F5CBA7', fontSize: 12, marginTop: 2 },
  cartSummaryButton: { backgroundColor: '#F5821F', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  cartSummaryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  bottomNav: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 6, paddingBottom: 14, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#EEF2F7' },
  navItem: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 14, marginHorizontal: 1 },
  navItemSelected: { backgroundColor: '#EFF6FF' },
  navIconBadge: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9' },
  navIconBadgeSelected: { backgroundColor: '#DBEAFE' },
  navIcon: { fontSize: 20, color: '#64748B' },
  // Bottom nav active color switched to orange accent
  navIconSelected: { color: '#F5821F' },
  navText: { color: '#64748B', fontSize: 11, fontWeight: '700', marginTop: 4 },
  navCartBadge: { position: 'absolute', top: -5, right: -7, minWidth: 17, height: 17, paddingHorizontal: 4, borderRadius: 9, backgroundColor: '#FF6400', justifyContent: 'center', alignItems: 'center' },
  navCartBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  navTextSelected: { color: '#F5821F' },
});

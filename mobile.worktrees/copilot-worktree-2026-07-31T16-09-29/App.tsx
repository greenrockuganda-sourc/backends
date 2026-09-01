import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  NativeModules,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
  Switch,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { formatCurrency, getOrderImageUrls } from './utils';

const resolveBackendHost = () => {
  const scriptURL = NativeModules.SourceCode?.scriptURL as string | undefined;
  if (scriptURL) {
    const match = scriptURL.match(/https?:\/\/([^:/]+)(?::\d+)?/);
    if (match) {
      return match[1];
    }
  }
  return Platform.OS === 'android' ? '10.0.2.2' : '192.168.1.10';
};

const API_BASE_URL = `http://${resolveBackendHost()}:8000`;

const buildUrl = (path: string) => `${API_BASE_URL}${path}`;
const CART_STORAGE_KEY = '@glow-cart-v1';

const normalizeOrdersPayload = (payload: any) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.orders)) return payload.orders;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
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

const deduplicateItems = <T extends Record<string, any>>(items: T[], getKey: (item: T) => string): T[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item);
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const normalizeCategoriesPayload = (payload: any) => {
  const items = Array.isArray(payload) ? payload : [];
  return deduplicateItems(items, (item) => {
    const id = item?.id ?? item?.category_id ?? '';
    const name = item?.category_name || item?.name || '';
    return [id, name].filter(Boolean).join('::');
  });
};

const normalizeProductsPayload = (payload: any) => {
  const items = Array.isArray(payload) ? payload : [];
  return deduplicateItems(items, (item) => {
    const id = item?.id ?? item?.product_id ?? item?.sku ?? '';
    const name = item?.product_name || item?.name || '';
    return [id, name, item?.sku].filter(Boolean).join('::');
  });
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

const getCategoryIconVisual = (categoryName: string) => {
  const normalized = (categoryName || '').toLowerCase();

  if (/(shampoo|conditioner|treatment|serum|hair|care|oil)/.test(normalized)) {
    return { emoji: '🧴', color: '#1B2A4A', bgColor: '#EAF0FF' };
  }
  if (/(nail|manicure|pedicure|cosmetic|makeup|beauty)/.test(normalized)) {
    return { emoji: '💅', color: '#A23C79', bgColor: '#FCE7F3' };
  }
  if (/(skin|face|cream|mask|cleanser|serum)/.test(normalized)) {
    return { emoji: '🌿', color: '#2F7A4A', bgColor: '#EAF8EF' };
  }
  if (/(tool|scissor|clipper|brush|comb|accessory|barber)/.test(normalized)) {
    return { emoji: '✂️', color: '#8B5CF6', bgColor: '#F3E8FF' };
  }
  if (/(sanitizer|clean|disinfect|wipe)/.test(normalized)) {
    return { emoji: '🧼', color: '#0F766E', bgColor: '#E6FFFB' };
  }
  if (/(salon|spa|massage|towel|hotel)/.test(normalized)) {
    return { emoji: '✨', color: '#F5821F', bgColor: '#FFF2E6' };
  }

  return { emoji: '🧺', color: '#1B2A4A', bgColor: '#F3F4F6' };
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
        await new Promise((resolve) => setTimeout(resolve, delayMs));
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    console.log(`[API] request -> ${buildUrl(path)} (timeout ${timeoutMs}ms)`);
    console.log('[API] request options:', options);
    const response = await retryFetch(
      () =>
        fetch(buildUrl(path), {
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
    console.error(`API Error [${path}]:`, error?.message || error);
    console.error(error);
    if (error?.name === 'AbortError') {
      return { ok: false, status: 408, data: { error: 'Request timeout' } };
    }
    return {
      ok: false,
      status: 0,
      data: { error: (error && error.message) || 'Network error' },
    };
  } finally {
    clearTimeout(timeoutId);
  }
};

const navItems = [
  { key: 'Home', label: 'Home', icon: '⌂' },
  { key: 'Categories', label: 'Categories', icon: '◫' },
  { key: 'Orders', label: 'Orders', icon: '☰' },
  { key: 'Profile', label: 'Profile', icon: '◔' },
];

const orderStatusTabs = ['All', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

const getOrderStatusStyle = (status?: string | null) => {
  switch ((status || 'Pending').toLowerCase()) {
    case 'processing':
      return styles.statusProcessing;
    case 'shipped':
      return styles.statusShipped;
    case 'delivered':
      return styles.statusDelivered;
    case 'cancelled':
      return styles.statusCancelled;
    default:
      return styles.statusPending;
  }
};

function SplashScreen({ onFinish }: { onFinish: () => void }) {
  return (
    <TouchableWithoutFeedback onPress={onFinish}>
      <View style={styles.splashContainer}>
        <StatusBar barStyle="light-content" />
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
      </View>
    </TouchableWithoutFeedback>
  );
}

export default function App() {
  const { width } = useWindowDimensions();
  const isCompact = width < 380;
  const productCardWidth = Math.min(174, width - 44);
  const categoryCardWidth = Math.min(96, Math.max(76, width * 0.24));
  const [banners, setBanners] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [cart, setCart] = useState<any>({ items: [] });
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('Home');
  const [searchTerm, setSearchTerm] = useState('');
  const [showSplash, setShowSplash] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedOrderStatus, setSelectedOrderStatus] = useState('All');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersRefreshing, setOrdersRefreshing] = useState(false);
  const [orderSearch, setOrderSearch] = useState('');
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersHasMore, setOrdersHasMore] = useState(true);
  const [profileRoute, setProfileRoute] = useState<'profile' | 'settings' | 'personal_information' | 'change_password' | 'payment_methods' | 'addresses' | 'notification_settings' | 'help' | 'about' | 'cart' | 'checkout' | 'order_success' | 'security' | 'notifications' | 'favorites'>('profile');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [wishlist, setWishlist] = useState<any[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<any[]>([]);
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [cartFeedback, setCartFeedback] = useState<string | null>(null);
  const [cartQuantities, setCartQuantities] = useState<Record<number, number>>({});
  const [showCartSummary, setShowCartSummary] = useState(false);
  const [cartHydrated, setCartHydrated] = useState(false);
  const [checkoutNotice, setCheckoutNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash on delivery');
  const [addressRouteReturnTarget, setAddressRouteReturnTarget] = useState<'profile' | 'checkout'>('profile');
  const [profileDraft, setProfileDraft] = useState({ first_name: '', last_name: '', email: '', phone_number: '' });
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [newAddressLabel, setNewAddressLabel] = useState('Home');
  const [newAddressLine, setNewAddressLine] = useState('');
  const [newAddressPhone, setNewAddressPhone] = useState('');
  const ordersRequestRef = useRef<string | null>(null);
  const ordersFetchInFlightRef = useRef(false);

  const openAddresses = (target: 'profile' | 'checkout') => {
    setAddressRouteReturnTarget(target);
    setProfileRoute('addresses');
  };

  const selectAddress = (address: any) => {
    setSelectedAddressId(address.id);
    setDeliveryAddress(address.address || '');
    setProfile((prev: any) => (prev ? { ...prev, address: address.address || prev.address } : prev));
  };

  const saveProfileDetails = () => {
    const nextProfile = {
      ...(profile || {}),
      ...profileDraft,
      email: profileDraft.email || profile?.email || '',
      phone_number: profileDraft.phone_number || profile?.phone_number || '',
    };
    setProfile(nextProfile);
    setProfileRoute('profile');
    Alert.alert('Profile updated', 'Your account information has been saved.');
  };

  const saveNewAddress = () => {
    if (!newAddressLine.trim()) {
      Alert.alert('Address required', 'Please enter a delivery address before saving.');
      return;
    }

    const addressEntry = {
      id: `addr-${Date.now()}`,
      label: newAddressLabel.trim() || 'Home',
      address: newAddressLine.trim(),
      phone: newAddressPhone.trim(),
      isDefault: savedAddresses.length === 0,
    };

    setSavedAddresses((prev) => [addressEntry, ...prev]);
    setSelectedAddressId(addressEntry.id);
    setDeliveryAddress(addressEntry.address);
    setProfile((prev: any) => (prev ? { ...prev, address: addressEntry.address } : prev));
    setNewAddressLabel('Home');
    setNewAddressLine('');
    setNewAddressPhone('');
    Alert.alert('Address saved', 'Your new address has been added and selected for delivery.');
  };

  const fetchOrders = async ({ page = 1, refresh = false } = {}) => {
    if (!authToken || ordersFetchInFlightRef.current) return;

    const requestKey = `orders:${authToken}:${selectedOrderStatus}:${page}`;
    if (!refresh && page === 1 && ordersRequestRef.current === requestKey) return;

    ordersFetchInFlightRef.current = true;
    if (refresh) {
      setOrdersRefreshing(true);
    } else {
      setOrdersLoading(true);
    }

    try {
      const statusParam = selectedOrderStatus && selectedOrderStatus !== 'All' ? `&status=${encodeURIComponent(selectedOrderStatus)}` : '';
      const res = await requestJson(`/api/orders/?page=${page}${statusParam}`, {}, authToken);
      if (res.ok) {
        const nextOrders = normalizeOrdersPayload(res.data);
        setOrders((prev) => (page === 1 || refresh ? nextOrders : [...prev, ...nextOrders]));
        setOrdersHasMore(nextOrders.length > 0);
        ordersRequestRef.current = requestKey;
      }
    } catch (e) {
      console.error('fetchOrders error', e);
    } finally {
      ordersFetchInFlightRef.current = false;
      setOrdersLoading(false);
      setOrdersRefreshing(false);
    }
  };

  const loadHomeData = async (isRefresh = false) => {
    try {
      console.log(`[INFO] Starting data load from ${API_BASE_URL}`);
      
      let token = authToken;
      if (!token) {
        console.log('[AUTH] No token found, attempting login...');
        const authRes = await requestJson('/api/auth/login/', {
          method: 'POST',
          body: JSON.stringify({
            email: 'joshuajessey3@gmail.com',
            password: 'changemenow@',
          }),
        });
        
        if (authRes.ok && authRes.data?.access) {
          token = authRes.data.access;
          setAuthToken(token);
          console.log('[AUTH] Login successful');
        } else {
          console.warn('[AUTH] Login failed:', authRes.data?.error || 'Unknown error');
          setError('Unable to authenticate. Please check your credentials.');
          setLoading(false);
          return;
        }
      }

      // Fetch all data in parallel
      console.log('[API] Fetching banners, categories, products, cart, profile, and orders...');
      const [bannerRes, categoryRes, productRes, cartRes, profileRes, ordersRes] = await Promise.all([
        requestJson('/api/banners/'),
        requestJson('/api/categories/'),
        requestJson('/api/products/?page_size=30', {}, token),
        requestJson('/api/cart/'),
        requestJson('/api/profile/', {}, token),
        requestJson('/api/orders/', {}, token),
      ]);

      // Log responses for debugging
      console.log('[API] Banners:', bannerRes.ok ? '✓' : `✗ (${bannerRes.status})`);
      console.log('[API] Categories:', categoryRes.ok ? '✓' : `✗ (${categoryRes.status})`);
      console.log('[API] Products:', productRes.ok ? '✓' : `✗ (${productRes.status})`);
      console.log('[API] Cart:', cartRes.ok ? '✓' : `✗ (${cartRes.status})`);
      console.log('[API] Profile:', profileRes.ok ? '✓' : `✗ (${profileRes.status})`);
      console.log('[API] Orders:', ordersRes.ok ? '✓' : `✗ (${ordersRes.status})`);

      // Update state with responses (show partial data if some calls fail)
      setBanners(Array.isArray(bannerRes.data) ? bannerRes.data : (bannerRes.data ? [bannerRes.data] : []));
      setCategories(normalizeCategoriesPayload(Array.isArray(categoryRes.data) ? categoryRes.data : (categoryRes.data?.results || [])));
      setProducts(normalizeProductsPayload(Array.isArray(productRes.data?.results) ? productRes.data.results : (Array.isArray(productRes.data) ? productRes.data : [])));
      setCart(cartRes.data || { items: [] });
      
      const profileData = profileRes.data || null;
      setProfile(profileData);
      setProfilePhoto(profileData?.profile_image || null);
      if (ordersRes.ok) {
        setOrders(normalizeOrdersPayload(ordersRes.data));
        ordersRequestRef.current = `orders:${token}:${selectedOrderStatus}:1`;
      }

      // Check if critical endpoints failed
      const criticalFailures = [!bannerRes.ok, !categoryRes.ok, !productRes.ok].filter(Boolean).length;
      
      if (criticalFailures > 0) {
        console.warn(`[ERROR] ${criticalFailures} critical API calls failed`);
        setError(`Connection issue: ${criticalFailures} data source${criticalFailures > 1 ? 's' : ''} unavailable. Retry by pulling down.`);
      } else {
        console.log('[INFO] Data load successful');
        setError(null);
      }
    } catch (e: any) {
      console.error('[ERROR] Unexpected error during data load:', e.message);
      const errorMsg = e.message || 'Unable to connect to server';
      setError(`Connection failed: ${errorMsg}. Make sure the backend is running at ${API_BASE_URL}`);
      setBanners([]);
      setCategories([]);
      setProducts([]);
      setCart({ items: [] });
      setProfile(null);
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (activeTab !== 'Orders') return;
    if (!authToken) return;
    setOrdersPage(1);
    setOrdersHasMore(true);
    fetchOrders({ page: 1, refresh: true });
  }, [activeTab, authToken, selectedOrderStatus]);

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

    restorePersistedCart();
    loadHomeData(false);
  }, []);

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
    const timer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!cartFeedback) return;
    const timer = setTimeout(() => setCartFeedback(null), 1800);
    return () => clearTimeout(timer);
  }, [cartFeedback]);

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
      setProfileDraft({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        email: profile.email || '',
        phone_number: profile.phone_number || '',
      });

      const normalizedAddresses = Array.isArray(profile.addresses) && profile.addresses.length
        ? profile.addresses.map((entry: any, index: number) => ({
            id: entry.id || `addr-${index}`,
            label: entry.label || entry.name || 'Saved address',
            address: entry.address || entry.line || entry.location || '',
            phone: entry.phone || entry.phone_number || '',
            isDefault: Boolean(entry.is_default || entry.default || index === 0),
          }))
        : [];

      if (profile.address && !normalizedAddresses.some((entry: any) => entry.address === profile.address)) {
        normalizedAddresses.unshift({
          id: 'profile-address',
          label: 'Primary',
          address: profile.address,
          phone: profile.phone_number || '',
          isDefault: true,
        });
      }

      if (!normalizedAddresses.length) {
        normalizedAddresses.push({
          id: 'default-address',
          label: 'Default',
          address: profile.address || 'Plot 12, Kisementi Road, Kampala',
          phone: profile.phone_number || '+256 700 123 456',
          isDefault: true,
        });
      }

      setSavedAddresses(normalizedAddresses);
      const currentSelection = normalizedAddresses.find((entry: any) => entry.id === selectedAddressId);
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
    const isComplete = ['shipped', 'delivered'].includes(status);
    const isPacked = ['processing', 'shipped', 'delivered'].includes(status);
    const isOnWay = ['shipped', 'delivered'].includes(status);
    const isDelivered = status === 'delivered';

    return [
      { title: 'Order placed', description: 'Your order request is confirmed.', active: true },
      { title: 'Packing in progress', description: 'Your salon essentials are being prepared.', active: isPacked },
      { title: 'Out for delivery', description: 'A rider is heading your way.', active: isOnWay },
      { title: 'Delivered', description: 'Your package has arrived at your door.', active: isDelivered },
    ];
  };

  const getDeliveryEta = (order: any) => {
    const status = (order?.order_status || 'Pending').toLowerCase();
    if (status === 'delivered') return 'Delivered this morning';
    if (status === 'shipped') return 'Arriving today by 6:00 PM';
    if (status === 'processing') return 'Expected by tomorrow afternoon';
    if (status === 'cancelled') return 'Cancelled';
    return 'Estimated within 24 hours';
  };

  const getTrackingHistory = (order: any) => {
    const status = (order?.order_status || 'Pending').toLowerCase();
    const base = [
      { time: '09:20', event: 'Order confirmed', detail: 'Payment was received and your order was accepted.' },
      { time: '10:05', event: 'Packing started', detail: 'The selected salon essentials are being prepared.' },
    ];

    if (status === 'shipped' || status === 'delivered') {
      base.push({ time: '13:45', event: 'Picked up by rider', detail: 'Your package is now on route for delivery.' });
    }

    if (status === 'delivered') {
      base.push({ time: '16:10', event: 'Delivered', detail: 'The order was handed over successfully.' });
    }

    return base;
  };

  const openCartScreen = () => {
    setActiveTab('Profile');
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
    setRecentlyViewed((prev) => {
      const filtered = prev.filter((item) => item.id !== product.id);
      return [product, ...filtered].slice(0, 6);
    });
  };

  const syncCartWithQuantity = (productId: number, nextQty: number, product?: any) => {
    setCart((prev: any) => {
      const items = Array.isArray(prev?.items) ? prev.items : [];
      const existing = items.find((item: any) => item.product_id === productId);
      if (nextQty <= 0) {
        return { ...prev, items: items.filter((item: any) => item.product_id !== productId) };
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
        return { ...prev, items: items.map((item: any) => item.product_id === productId ? { ...item, ...cartItem } : item) };
      }
      return { ...prev, items: [...items, cartItem] };
    });
  };

  const handleAddToCart = async (productId: number, quantity: number = 1, product?: any) => {
    const currentQty = cartQuantities[productId] || 0;
    const nextQty = currentQty + quantity;
    setCartQuantities((prev) => ({ ...prev, [productId]: nextQty }));
    syncCartWithQuantity(productId, nextQty, product);
    setCartFeedback('Added to cart');
    try {
      await fetch(buildUrl('/api/cart/add/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId, quantity }),
      });
    } catch (e) {
      setError('Unable to add the item to cart right now.');
    }
  };

  const adjustProductQuantity = (productId: number, delta: number, product?: any) => {
    const currentQty = cartQuantities[productId] || 0;
    const nextQty = Math.max(0, currentQty + delta);
    setCartQuantities((prev) => {
      if (nextQty <= 0) {
        const updated = { ...prev };
        delete updated[productId];
        return updated;
      }
      return { ...prev, [productId]: nextQty };
    });
    syncCartWithQuantity(productId, nextQty, product);
    if (nextQty > 0) {
      setCartFeedback('Quantity updated');
    }
  };

  const cartCount = (cart?.items || []).reduce((sum: number, item: any) => sum + Number(item.quantity || 1), 0);

  useEffect(() => {
    setShowCartSummary(cartCount > 0);
  }, [cartCount]);

  const isAuthenticated = Boolean(authToken && profile);
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
      { text: 'Logout', style: 'destructive', onPress: () => {
          setShowSplash(true);
          setActiveTab('Home');
          setProfileRoute('profile');
          setProfilePhoto(null);
          setAuthToken(null);
          setProfile(null);
          setOrders([]);
        } },
    ]);
  };

  const requireAuthenticatedCheckout = () => {
    if (!isAuthenticated) {
      setCheckoutNotice({ type: 'error', message: 'Please sign in to continue checkout.' });
      setProfileRoute('profile');
      setActiveTab('Profile');
      return false;
    }
    return true;
  };

  const renderCategoriesScreen = () => {
    const sidebarCategories = [
      { title: 'All Categories', icon: '🧺', iconColor: '#F5821F', iconBg: 'rgba(245,130,31,0.16)' },
      ...categories.map((item) => {
        const title = item.category_name || item.name;
        const visual = getCategoryIconVisual(title);
        return { title, icon: visual.emoji, iconColor: visual.color, iconBg: visual.bgColor };
      }),
    ];

    const selectedCategoryLabel = selectedCategory === 'All Categories' ? 'All Categories' : selectedCategory;
    const productsForCategory = products.filter((product: any) => {
      if (selectedCategory === 'All Categories') return true;
      const normalizedSelectedCategory = selectedCategory.toLowerCase();
      const productCategoryText = getProductCategoryMatchText(product);
      return productCategoryText.includes(normalizedSelectedCategory) || normalizedSelectedCategory.includes(productCategoryText);
    });

    const filteredCategoryProducts = productsForCategory.filter((product: any) => {
      const search = (searchTerm || '').trim().toLowerCase();
      if (!search) return true;
      const productName = `${product.product_name || ''} ${product.description || ''}`.toLowerCase();
      return productName.includes(search);
    });

    return (
      <View style={styles.categoryPage}>
        <View style={styles.screenHeaderNavy}>
          <TouchableOpacity style={styles.headerIconButton} onPress={() => setActiveTab('Home')}>
            <Text style={styles.headerBackArrow}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Categories</Text>
          <View style={styles.headerActionsRow}>
            <TouchableOpacity style={styles.headerIconButton} onPress={() => setShowSidebar((prev) => !prev)}>
              <Text style={styles.headerBackArrow}>{showSidebar ? '◀' : '☰'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIconButton} onPress={openCartScreen}>
              <Text style={styles.headerIconText}>🛒</Text>
              {cartCount > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{cartCount}</Text></View> : null}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchBarCategories}>
          <TextInput style={styles.searchInput} placeholder="Search categories..." placeholderTextColor="#9CA3AF" value={searchTerm} onChangeText={setSearchTerm} />
          <TouchableOpacity style={styles.searchButton}>
            <Text style={styles.searchButtonIcon}>🔍</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sidebarToggleButton} onPress={() => setShowSidebar((prev) => !prev)}>
            <Text style={styles.searchButtonIcon}>{showSidebar ? '◀' : '☰'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.categorySplitView}>
          {showSidebar ? (
            <View style={styles.categorySidebar}>
              {sidebarCategories.map((item) => {
                const active = item.title === selectedCategory;
                return (
                  <TouchableOpacity key={item.title} style={[styles.sidebarRow, active && styles.sidebarRowActive]} onPress={() => setSelectedCategory(item.title)}>
                    <View style={[styles.sidebarIconBadge, { backgroundColor: item.iconBg }]}> 
                      <Text style={[styles.categoryIconGlyph, { color: item.iconColor }]}>{item.icon}</Text>
                    </View>
                    <Text style={[styles.sidebarLabel, active && styles.sidebarLabelActive]}>{item.title}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}
          <View style={styles.categoryContentArea}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{selectedCategoryLabel}</Text>
              <Text style={styles.viewAll}>{filteredCategoryProducts.length} items</Text>
            </View>
            <ScrollView contentContainerStyle={styles.gridContent} showsVerticalScrollIndicator={false}>
              {filteredCategoryProducts.length ? (
                <View style={styles.productGrid}>
                  {filteredCategoryProducts.map((item: any) => {
                    const isSaved = wishlist.some((entry: any) => entry.id === item.id);
                    const currentQty = cartQuantities[item.id] || 0;
                    return (
                      <TouchableOpacity key={`${item.id}-${item.product_name}`} style={styles.productGridCard} onPress={() => openProductDetail(item)}>
                        <Image source={{ uri: item.image_url || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80' }} style={styles.productGridImage} />
                        <TouchableOpacity style={styles.favoriteButton} onPress={() => toggleWishlist(item)}>
                          <Text style={styles.favoriteButtonText}>{isSaved ? '♥' : '♡'}</Text>
                        </TouchableOpacity>
                        <View style={styles.productGridContent}>
                          <View style={styles.productGridMetaRow}>
                            <View style={styles.productGridBadge}>
                              <Text style={styles.productGridBadgeText}>{selectedCategoryLabel}</Text>
                            </View>
                            <Text style={styles.productGridDeliveryText}>In stock</Text>
                          </View>
                          <Text style={styles.productGridName}>{item.product_name}</Text>
                          <Text style={styles.productGridPrice}>UGX {Number(item.selling_price ?? 0).toLocaleString('en-US')}</Text>
                          <TouchableOpacity style={styles.productGridCartButton} onPress={(event: any) => { event?.stopPropagation?.(); handleAddToCart(item.id, 1, item); }}>
                            <Text style={styles.productGridCartButtonText}>{currentQty > 0 ? 'Add another' : 'Add to cart'}</Text>
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyStateCard}>
                  <Text style={styles.emptyStateTitle}>No products found</Text>
                  <Text style={styles.emptyStateText}>Try another category or search term.</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </View>
    );
  };

  const renderOrdersScreen = () => {
    const filteredOrders = orders.filter((order: any) => {
      const matchesStatus = selectedOrderStatus === 'All' || (order.order_status || '').toLowerCase() === selectedOrderStatus.toLowerCase();
      const matchesSearch = !orderSearch || (order.order_number || '').toLowerCase().includes(orderSearch.toLowerCase());
      return matchesStatus && matchesSearch;
    });

    const selectedOrder = selectedOrderId != null
      ? orders.find((order: any) => String(order.id) === String(selectedOrderId)) || null
      : null;

    const renderOrderItem = ({ item }: { item: any }) => {
      const status = item.order_status || 'Pending';
      const orderDate = item.created_at ? new Date(item.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Pending';
      const orderImages = getOrderImageUrls(item);
      const visibleImages = orderImages.slice(0, 3);
      return (
        <View style={styles.orderCard}>
          <View style={styles.orderCardTopRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.orderNumber}>{item.order_number || `#${item.id}`}</Text>
              <Text style={styles.orderDate}>{orderDate}</Text>
            </View>
            <View style={[styles.statusBadge, getOrderStatusStyle(status)]}>
              <Text style={styles.statusBadgeText}>{status}</Text>
            </View>
          </View>

          <View style={styles.thumbnailRow}>
            {visibleImages.length ? visibleImages.map((imageUrl, index) => (
              <Image key={`${item.id}-${index}`} source={{ uri: imageUrl }} style={styles.thumbImage} />
            )) : (
              <><View style={styles.thumbBox} /><View style={styles.thumbBox} /><View style={styles.thumbBox} /></>
            )}
            {orderImages.length > 3 ? (
              <View style={styles.moreThumbBadge}>
                <Text style={styles.moreThumbText}>+{orderImages.length - 3}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.orderMetaRow}>
            <Text style={styles.orderMetaText}>{item.payment_method || 'Pay on Delivery'}</Text>
            <Text style={styles.orderTotalText}>{formatCurrency(item.total_amount ?? item.total ?? 0)}</Text>
          </View>

          <View style={styles.orderActionsRow}>
            <TouchableOpacity style={styles.detailButton} onPress={() => setSelectedOrderId(item.id)}>
              <Text style={styles.detailButtonText}>View</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => Alert.alert('Support', 'A Glow support agent will assist shortly.')}>
              <Text style={styles.secondaryButtonText}>Support</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.trackButton} onPress={() => Alert.alert('Reorder', 'Reorder request received (demo).')}>
              <Text style={styles.trackButtonText}>Reorder</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    };

    const selectedOrderHeader = selectedOrder ? (() => {
      const orderDate = selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Pending';
      const trackingSteps = getOrderTrackingSteps(selectedOrder);
      const eta = getDeliveryEta(selectedOrder);
      const trackingHistory = getTrackingHistory(selectedOrder);
      return (
        <View style={{ marginBottom: 12 }}>
          <View style={styles.orderDetailCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.detailNumber}>{selectedOrder.order_number || `#${selectedOrder.id}`}</Text>
                <Text style={styles.detailMeta}>{orderDate}</Text>
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

          <TouchableOpacity style={styles.detailButton} onPress={() => Alert.alert('Support', 'A Glow support agent will assist with your delivery update shortly.') }>
            <Text style={styles.detailButtonText}>Need help with this delivery?</Text>
          </TouchableOpacity>
        </View>
      );
    })() : null;

    const ordersListHeader = (
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterTabsRow} contentContainerStyle={styles.filterTabsContent}>
          {orderStatusTabs.map((tab) => {
            const active = tab === selectedOrderStatus;
            return (
              <TouchableOpacity key={tab} style={styles.filterTab} onPress={() => setSelectedOrderStatus(tab)}>
                <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>{tab}</Text>
                {active ? <View style={styles.filterTabUnderline} /> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {selectedOrderHeader}
      </View>
    );

    return (
      <View style={styles.ordersPage}>
        <View style={styles.screenHeaderNavy}>
          <TouchableOpacity style={styles.headerIconButton} onPress={() => setActiveTab('Home')}>
            <Text style={styles.headerBackArrow}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Orders</Text>
          <View style={styles.headerIconButton} />
        </View>

        {ordersLoading && !ordersRefreshing && !orders.length ? (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <ActivityIndicator color="#F5821F" />
          </View>
        ) : null}

        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => String(item.id || item.order_number || Math.random())}
          renderItem={renderOrderItem}
          contentContainerStyle={styles.orderListContent}
          ListHeaderComponent={ordersListHeader}
          refreshControl={<RefreshControl refreshing={ordersRefreshing} onRefresh={() => { setOrdersPage(1); fetchOrders({ page: 1, refresh: true }); }} tintColor="#F5821F" />}
          onEndReached={() => {
            if (ordersHasMore && !ordersLoading) {
              const nextPage = ordersPage + 1;
              setOrdersPage(nextPage);
              fetchOrders({ page: nextPage });
            }
          }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <View style={styles.emptyStateCard}>
              <Text style={styles.emptyStateTitle}>No orders match your search yet</Text>
              <Text style={styles.emptyStateText}>Place a new order or switch filters to view your recent deliveries.</Text>
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
    const detailedRoutes: Record<string, { title: string; body: string }> = {
      personal_information: { title: 'Personal Information', body: 'Update your name, email, and delivery details from here.' },
      change_password: { title: 'Change Password', body: 'Set a new password to keep your account protected.' },
      payment_methods: { title: 'Payment Methods', body: 'Manage your preferred payment method for salon orders.' },
      addresses: { title: 'Addresses', body: 'Add or update where your salon essentials should be delivered.' },
      notification_settings: { title: 'Notification Settings', body: 'Toggle reminders, offers, and delivery updates.' },
      help: { title: 'Help & Support', body: 'Contact Glow support for quick assistance with your orders.' },
      about: { title: 'About Glow', body: 'Learn more about Glow, our promises, and delivery policies.' },
      settings: { title: 'Settings', body: 'Fine-tune your app experience, notifications, and privacy preferences.' },
      security: { title: 'Security & Privacy', body: 'Protect your account with verification, password recovery, and secure sign-in controls.' },
      notifications: { title: 'Push Notifications', body: 'Stay updated on deliveries, tracking changes, promotions, and order milestones.' },
      favorites: { title: 'Favorites', body: 'Save your most-loved salon essentials for faster reordering.' },
    };

    if (profileRoute === 'favorites') {
      return (
        <View style={styles.profilePage}>
          <View style={styles.profileHeaderBlock}>
            <View style={styles.profileHeaderRow}>
              <TouchableOpacity style={styles.profileHeaderBack} onPress={() => setProfileRoute('profile')}>
                <Text style={styles.profileHeaderBackText}>←</Text>
              </TouchableOpacity>
              <Text style={styles.profileHeaderTitle}>Favorites</Text>
              <View style={styles.profileHeaderBack} />
            </View>
            <Text style={styles.profileHeaderScreenTitle}>Saved for later</Text>
          </View>
          <View style={styles.profileDetailCard}>
            {wishlist.length ? wishlist.map((item: any) => (
              <View key={`favorite-${item.id}`} style={styles.favoriteItemCard}>
                {item.image_url ? <Image source={{ uri: item.image_url }} style={styles.favoriteItemImage} /> : <View style={styles.favoriteItemImagePlaceholder} />}
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
      const subtotal = cartItems.reduce((sum: number, item: any) => sum + Number(item.quantity || 1) * 25000, 0);
      const deliveryFee = subtotal > 0 ? 5000 : 0;
      const total = subtotal + deliveryFee;

      return (
        <ScrollView style={styles.profilePage} contentContainerStyle={styles.profilePageContent} showsVerticalScrollIndicator={false}>
          <View style={styles.profileHeaderBlock}>
            <View style={styles.profileHeaderRow}>
              <TouchableOpacity style={styles.profileHeaderBack} onPress={() => setProfileRoute('profile')}>
                <Text style={styles.profileHeaderBackText}>←</Text>
              </TouchableOpacity>
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
                    <View key={`${item.product_id ?? item.id ?? index}`} style={styles.cartItemCard}>
                      {item.image_url ? (
                        <Image source={{ uri: item.image_url }} style={styles.cartItemImage} />
                      ) : (
                        <View style={styles.cartItemImagePlaceholder} />
                      )}
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
                    <Text style={styles.summaryValue}>UGX {deliveryFee.toLocaleString('en-US')}</Text>
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
                  <Text style={styles.primaryButtonText}>Proceed to checkout</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.emptyStateCard}>
                  <Text style={styles.emptyStateTitle}>Your cart is ready for your first order</Text>
                  <Text style={styles.emptyStateText}>Pick salon essentials from the home page and they will appear here with a clear checkout summary.</Text>
                </View>
                <TouchableOpacity style={styles.primaryButton} onPress={() => { setProfileRoute('profile'); setActiveTab('Home'); }}>
                  <Text style={styles.primaryButtonText}>Browse products</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      );
    }

    if (profileRoute === 'checkout') {
      const subtotal = cartItems.reduce((sum: number, item: any) => sum + Number(item.quantity || 1) * 25000, 0);
      const deliveryFee = subtotal > 0 ? 5000 : 0;
      const total = subtotal + deliveryFee;
      return (
        <View style={styles.profilePage}>
          <View style={styles.profileHeaderBlock}>
            <View style={styles.profileHeaderRow}>
              <TouchableOpacity style={styles.profileHeaderBack} onPress={() => setProfileRoute('cart')}>
                <Text style={styles.profileHeaderBackText}>←</Text>
              </TouchableOpacity>
              <Text style={styles.profileHeaderTitle}>Checkout</Text>
              <View style={styles.profileHeaderBack} />
            </View>
            <Text style={styles.profileHeaderScreenTitle}>Finish your order</Text>
          </View>
          <ScrollView contentContainerStyle={styles.checkoutPageContent} showsVerticalScrollIndicator={false}>
            {!isAuthenticated ? (
              <View style={[styles.checkoutNoticeBox, styles.checkoutNoticeError, { marginBottom: 16 }]}> 
                <Text style={styles.checkoutNoticeText}>Please sign in before placing an order.</Text>
              </View>
            ) : null}
            <View style={styles.profileDetailCard}>
              <View style={styles.checkoutIntroCard}>
                <Text style={styles.checkoutIntroTitle}>Fast delivery, secure checkout</Text>
                <Text style={styles.checkoutIntroText}>Your order will be confirmed in seconds and delivered to your preferred address.</Text>
              </View>
              <Text style={styles.checkoutSectionTitle}>Delivery address</Text>
              <View style={styles.addressCard}>
                <Text style={styles.infoValue}>{profile?.first_name || 'Customer'} {profile?.last_name || ''}</Text>
                <Text style={styles.infoLabel}>{profile?.phone_number || '+256 700 123 456'}</Text>
                <Text style={styles.addressText}>{deliveryAddress}</Text>
                <TouchableOpacity style={styles.secondaryButton} onPress={() => openAddresses('checkout')}>
                  <Text style={styles.secondaryButtonText}>Change address</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.checkoutSectionTitle, { marginTop: 20 }]}>Payment method</Text>
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
                  <Text style={styles.summaryValue}>UGX {deliveryFee.toLocaleString('en-US')}</Text>
                </View>
                <View style={styles.summaryRowStrong}>
                  <Text style={styles.summaryLabelStrong}>Total</Text>
                  <Text style={styles.summaryValueStrong}>UGX {total.toLocaleString('en-US')}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.primaryButton} onPress={() => {
                if (!requireAuthenticatedCheckout()) return;

                const normalizedItems = (cart?.items || []).filter((item: any) => Number(item.quantity || 1) > 0);
                const hasValidQuantity = normalizedItems.every((item: any) => Number(item.quantity || 1) >= 1);
                const trimmedAddress = deliveryAddress.trim();
                const trimmedPayment = paymentMethod.trim();

                if (!normalizedItems.length) {
                  setCheckoutNotice({ type: 'error', message: 'Your cart is empty. Add at least one item before checking out.' });
                  return;
                }

                if (!hasValidQuantity) {
                  setCheckoutNotice({ type: 'error', message: 'Please confirm each item quantity before placing the order.' });
                  return;
                }

                if (!trimmedAddress || trimmedAddress.length < 8) {
                  setCheckoutNotice({ type: 'error', message: 'Please enter a complete delivery address before confirming.' });
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

                const newOrder = {
                  id: Date.now(),
                  order_number: `ORD${Math.floor(Math.random() * 900000 + 100000)}`,
                  created_at: new Date().toISOString(),
                  payment_method: trimmedPayment,
                  total_amount: total,
                  order_status: 'Processing',
                  items: orderItems,
                  image_urls: orderItems.map((item: any) => item.image_url).filter(Boolean),
                };
                setOrders((prev) => [...prev, newOrder]);
                setCheckoutNotice({ type: 'success', message: `Order confirmed! ${newOrder.order_number} is now being prepared.` });
                setProfileRoute('order_success');
                setCart({ items: [] });
                setCartFeedback('Order confirmed');
              }}>
                <Text style={styles.primaryButtonText}>Confirm order</Text>
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
              <TouchableOpacity style={styles.profileHeaderBack} onPress={() => setProfileRoute(addressRouteReturnTarget)}>
                <Text style={styles.profileHeaderBackText}>←</Text>
              </TouchableOpacity>
              <Text style={styles.profileHeaderTitle}>Delivery Addresses</Text>
              <View style={styles.profileHeaderBack} />
            </View>
            <Text style={styles.profileHeaderScreenTitle}>Choose where your orders should go</Text>
          </View>
          <View style={styles.profileDetailCard}>
            <Text style={styles.infoLabel}>Saved addresses</Text>
            {savedAddresses.map((entry: any) => {
              const isSelected = entry.id === selectedAddressId;
              return (
                <TouchableOpacity key={entry.id} style={[styles.addressOptionCard, isSelected && styles.addressOptionCardActive]} onPress={() => selectAddress(entry)}>
                  <View style={styles.addressOptionHeaderRow}>
                    <Text style={styles.infoValue}>{entry.label}</Text>
                    {isSelected ? <View style={styles.addressBadge}><Text style={styles.addressBadgeText}>Selected</Text></View> : null}
                  </View>
                  {entry.address ? <Text style={styles.addressText}>{entry.address}</Text> : null}
                  {entry.phone ? <Text style={styles.infoLabel}>{entry.phone}</Text> : null}
                </TouchableOpacity>
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
              <TextInput
                style={styles.addressInput}
                value={newAddressLine}
                onChangeText={setNewAddressLine}
                placeholder="Enter delivery address"
                placeholderTextColor="#9CA3AF"
                multiline
              />
              <TextInput
                style={styles.inputField}
                value={newAddressPhone}
                onChangeText={setNewAddressPhone}
                placeholder="Phone number"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
              />
              <TouchableOpacity style={styles.primaryButton} onPress={saveNewAddress}>
                <Text style={styles.primaryButtonText}>Save new address</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.secondaryButton} onPress={() => {
              setProfile((prev: any) => (prev ? { ...prev, address: deliveryAddress } : prev));
              setProfileRoute(addressRouteReturnTarget);
            }}>
              <Text style={styles.secondaryButtonText}>Use this address</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (profileRoute === 'order_success') {
      return (
        <View style={styles.profilePage}>
          <View style={styles.profileHeaderBlock}>
            <View style={styles.profileHeaderRow}>
              <TouchableOpacity style={styles.profileHeaderBack} onPress={() => setProfileRoute('profile')}>
                <Text style={styles.profileHeaderBackText}>←</Text>
              </TouchableOpacity>
              <Text style={styles.profileHeaderTitle}>Order Confirmed</Text>
              <View style={styles.profileHeaderBack} />
            </View>
            <Text style={styles.profileHeaderScreenTitle}>Thank you for ordering</Text>
          </View>
          <View style={styles.profileDetailCard}>
            <View style={styles.successCard}>
              <Text style={styles.successIcon}>✅</Text>
              <Text style={styles.successTitle}>Your order is on its way</Text>
              <Text style={styles.successSubtitle}>We’ve confirmed your purchase and will notify you when the rider is close.</Text>
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
              <TouchableOpacity style={styles.profileHeaderBack} onPress={() => setProfileRoute('profile')}>
                <Text style={styles.profileHeaderBackText}>←</Text>
              </TouchableOpacity>
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
              <TextInput
                style={styles.inputField}
                placeholder="Enter your email"
                placeholderTextColor="#9CA3AF"
                value={resetEmail}
                onChangeText={setResetEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TouchableOpacity style={styles.secondaryButton} onPress={() => { setResetSent(true); Alert.alert('Reset link sent', 'A password reset link has been sent to your inbox.'); }}>
                <Text style={styles.secondaryButtonText}>{resetSent ? 'Send again' : 'Send reset link'}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.primaryButton} onPress={() => setProfileRoute('profile')}>
              <Text style={styles.primaryButtonText}>Back to Profile</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (profileRoute === 'notifications') {
      return (
        <View style={styles.profilePage}>
          <View style={styles.profileHeaderBlock}>
            <View style={styles.profileHeaderRow}>
              <TouchableOpacity style={styles.profileHeaderBack} onPress={() => setProfileRoute('profile')}>
                <Text style={styles.profileHeaderBackText}>←</Text>
              </TouchableOpacity>
              <Text style={styles.profileHeaderTitle}>Notifications</Text>
              <View style={styles.profileHeaderBack} />
            </View>
            <Text style={styles.profileHeaderScreenTitle}>Stay informed</Text>
          </View>
          <View style={styles.profileDetailCard}>
            <View style={styles.notificationCard}>
              <View style={styles.notificationTextArea}>
                <Text style={styles.infoLabel}>Push notifications</Text>
                <Text style={styles.profileDetailBody}>Receive order updates, delivery ETA changes, and promotional offers.</Text>
              </View>
              <Switch value={notificationEnabled} onValueChange={setNotificationEnabled} thumbColor={notificationEnabled ? '#F5821F' : '#FFFFFF'} trackColor={{ false: '#D1D5DB', true: '#FDC38B' }} />
            </View>
            <TouchableOpacity style={styles.primaryButton} onPress={() => { Alert.alert('Notifications enabled', notificationEnabled ? 'You will receive live order updates.' : 'You will not receive push updates.'); setProfileRoute('profile'); }}>
              <Text style={styles.primaryButtonText}>Save preferences</Text>
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
              <TouchableOpacity style={styles.profileHeaderBack} onPress={() => setProfileRoute('profile')}>
                <Text style={styles.profileHeaderBackText}>←</Text>
              </TouchableOpacity>
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
            <TouchableOpacity style={styles.primaryButton} onPress={saveProfileDetails}>
              <Text style={styles.primaryButtonText}>Save changes</Text>
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
              <TouchableOpacity style={styles.profileHeaderBack} onPress={() => setProfileRoute('profile')}>
                <Text style={styles.profileHeaderBackText}>←</Text>
              </TouchableOpacity>
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
            <Text style={styles.profileHeaderTitle}>My Profile</Text>
            <TouchableOpacity style={styles.profileSettingsButton} onPress={() => setProfileRoute('settings')}>
              <Text style={styles.profileHeaderIcon}>⚙️</Text>
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
        </View>

        <View style={styles.accountOverviewCard}>
          <View style={styles.accountOverviewHeaderRow}>
            <View>
              <Text style={styles.accountOverviewTitle}>Account Overview</Text>
              <Text style={styles.accountOverviewCaption}>A clean snapshot of your activity and preferences</Text>
            </View>
            <View style={styles.accountOverviewBadge}>
              <Text style={styles.accountOverviewBadgeText}>Active</Text>
            </View>
          </View>
          <View style={styles.statGrid}>
            <View style={styles.statBox}><Text style={styles.statIcon}>📝</Text><Text style={styles.statValue}>{orderCount}</Text><Text style={styles.statLabel}>Orders</Text></View>
            <View style={styles.statBox}><Text style={styles.statIcon}>♡</Text><Text style={styles.statValue}>{wishlistCount}</Text><Text style={styles.statLabel}>Wishlist</Text></View>
            <View style={styles.statBox}><Text style={styles.statIcon}>📍</Text><Text style={styles.statValue}>{addressCount}</Text><Text style={styles.statLabel}>Addresses</Text></View>
            <View style={styles.statBox}><Text style={styles.statIcon}>⭐</Text><Text style={styles.statValue}>{reviewCount}</Text><Text style={styles.statLabel}>Reviews</Text></View>
          </View>
        </View>

        <View style={styles.quickActionsCard}>
          <Text style={styles.quickActionsTitle}>Quick access</Text>
          <View style={styles.quickActionsGrid}>
            {[
              { label: 'Security', subtitle: 'Protect your account', route: 'security', icon: '🔒' },
              { label: 'Addresses', subtitle: 'Delivery details', route: 'addresses', icon: '📍' },
              { label: 'Favorites', subtitle: 'Saved essentials', route: 'favorites', icon: '♡' },
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
                <Text style={styles.quickActionIcon}>{item.icon}</Text>
                <Text style={styles.quickActionTitle}>{item.label}</Text>
                <Text style={styles.quickActionSubtitle}>{item.subtitle}</Text>
              </TouchableOpacity>
            ))}
          </View>
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
          {orders.length ? orders.slice(0, 2).map((order: any) => (
            <View key={order.id || order.order_number} style={styles.recentOrderRow}>
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
            { label: 'Favorites', route: 'favorites', icon: '♡' },
            { label: 'Security & Privacy', route: 'security', icon: '🔒' },
            { label: 'Change Password', route: 'change_password', icon: '🔐' },
            { label: 'Payment Methods', route: 'payment_methods', icon: '💳' },
            { label: 'Addresses', route: 'addresses', icon: '📍' },
            { label: 'Push Notifications', route: 'notifications', icon: '🔔' },
            { label: 'Help & Support', route: 'help', icon: '❓' },
            { label: 'About Glow', route: 'about', icon: '✨' },
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
                <Text style={styles.menuIcon}>{item.icon}</Text>
                <Text style={styles.menuLabel}>{item.label}</Text>
              </View>
              <Text style={styles.menuChevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={styles.primaryButton} onPress={handleLogout}>
          <Text style={styles.primaryButtonText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

const renderHomeBody = () => {
    const categoryProductGroups = categories
      .map((category) => {
        const categoryName = category.category_name || category.name;
        const normalizedCategory = (categoryName || '').toLowerCase();
        const items = products.filter((product: any) => {
          const productCategory = `${product.category_name || ''} ${product.category || ''} ${product.category_id || ''}`.toLowerCase();
          return productCategory.includes(normalizedCategory) || normalizedCategory.includes(productCategory);
        });

        return {
          categoryName,
          items: items.slice(0, 15),
        };
      })
      .filter((group) => group.items.length > 0);

    const mixedCategoryProducts = categoryProductGroups.length
      ? categoryProductGroups.reduce<any[]>((acc, group) => {
          for (let index = 0; index < group.items.length; index += 1) {
            const item = group.items[index];
            if (item) {
              const alreadyIncluded = acc.some((entry: any) => entry.id === item.id);
              if (!alreadyIncluded) {
                acc.push({ ...item, __categoryName: group.categoryName });
              }
            }
          }
          return acc;
        }, [])
      : products.slice(0, 24);

    return (
      <View style={styles.homePageShell}>
        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

        {cartFeedback ? (
          <View style={styles.cartFeedbackBar}>
            <Text style={styles.cartFeedbackText}>{cartFeedback}</Text>
          </View>
        ) : null}

        <View style={[styles.contentSectionWhite, styles.heroBodyShell]}>
          <View style={styles.heroCardShell}>
            <View style={[styles.heroCard, isCompact && styles.heroCardCompact]}>
              <View style={styles.heroTextContainer}>
                <Text style={styles.heroLine}>Everything your salon needs.</Text>
                <Text style={styles.heroLine}>Delivered.</Text>
                <Text style={styles.heroDelivered}>{banners[0]?.description || 'Top salon brands, delivered fast'}</Text>
                <TouchableOpacity style={styles.shopButton} onPress={() => setActiveTab('Categories')}>
                  <Text style={styles.shopButtonText}>Shop Now</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.heroVisual}>
                <View style={[styles.bottle, styles.bottleBack]}>
                  <View style={styles.bottleCap} />
                  <Text style={styles.bottleLabel}>SHAMPOO</Text>
                </View>
                <View style={[styles.bottle, styles.bottleMiddle]}>
                  <View style={styles.bottleCap} />
                  <Text style={styles.bottleLabel}>TREATMENT</Text>
                </View>
                <View style={[styles.bottle, styles.bottleFront]}>
                  <View style={styles.bottleCap} />
                  <Text style={styles.bottleLabel}>CONDITIONER</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.heroBodyContent}>
            <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Shop by Category</Text>
            <TouchableOpacity onPress={() => setActiveTab('Categories')}><Text style={styles.viewAll}>View all</Text></TouchableOpacity>
          </View>
          <ScrollView horizontal nestedScrollEnabled directionalLockEnabled showsHorizontalScrollIndicator={false} style={styles.horizontalList} contentContainerStyle={styles.horizontalListContent}>
            {categories.map((item) => {
              const categoryName = item.category_name || item.name;
              const visual = getCategoryIconVisual(categoryName);
              return (
                <TouchableOpacity key={item.id || categoryName} style={[styles.categoryCard, { width: categoryCardWidth }]} onPress={() => { setSelectedCategory(categoryName); setActiveTab('Categories'); }}>
                  <View style={[styles.categoryIconBadge, { backgroundColor: visual.bgColor }]}> 
                    <Text style={[styles.categoryIconGlyph, { color: visual.color }]}>{visual.emoji}</Text>
                  </View>
                  <Text style={styles.categoryName}>{categoryName}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Best Sellers</Text>
            <TouchableOpacity><Text style={styles.viewAll}>View all</Text></TouchableOpacity>
          </View>
          <ScrollView horizontal nestedScrollEnabled directionalLockEnabled showsHorizontalScrollIndicator={false} style={styles.horizontalList} contentContainerStyle={styles.horizontalListContent}>
            {products.slice(0, 12).map((item) => {
              const isSaved = wishlist.some((entry: any) => entry.id === item.id);
              const currentQty = cartQuantities[item.id] || 0;
              return (
                <TouchableOpacity key={item.id} activeOpacity={0.95} style={[styles.productCard, { width: productCardWidth }]} onPress={() => openProductDetail(item)}>
                  <Image source={{ uri: item.image_url || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80' }} style={styles.productImage} />
                  <TouchableOpacity style={styles.favoriteButton} onPress={() => toggleWishlist(item)}>
                    <Text style={styles.favoriteButtonText}>{isSaved ? '♥' : '♡'}</Text>
                  </TouchableOpacity>
                  <View style={styles.productContent}>
                    <View style={styles.productMetaRow}>
                      <View style={styles.productBadge}>
                        <Text style={styles.productBadgeText}>Top pick</Text>
                      </View>
                      <Text style={styles.productDeliveryText}>Today</Text>
                    </View>
                    <Text style={styles.productName}>{item.product_name}</Text>
                    <Text style={styles.productPrice}>UGX {Number(item.selling_price ?? 0).toLocaleString('en-US')}</Text>
                    <View style={styles.productActions}>
                      <TouchableOpacity style={styles.cartButton} onPress={(event: any) => { event?.stopPropagation?.(); setSelectedProduct(null); handleAddToCart(item.id, 1, item); }}>
                        <Text style={styles.cartButtonText}>Add to cart</Text>
                      </TouchableOpacity>
                      {currentQty > 0 ? (
                        <View style={styles.quantityControl}>
                          <TouchableOpacity style={styles.quantityButton} onPress={(event: any) => { event?.stopPropagation?.(); adjustProductQuantity(item.id, -1, item); }}>
                            <Text style={styles.quantityButtonText}>−</Text>
                          </TouchableOpacity>
                          <Text style={styles.quantityValue}>{currentQty}</Text>
                          <TouchableOpacity style={styles.quantityButton} onPress={(event: any) => { event?.stopPropagation?.(); adjustProductQuantity(item.id, 1, item); }}>
                            <Text style={styles.quantityButtonText}>+</Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Discover more</Text>
            <Text style={styles.viewAll}>{mixedCategoryProducts.length} items</Text>
          </View>
          <View style={styles.productGrid}>
            {mixedCategoryProducts.slice(0, 60).map((item: any) => {
              const isSaved = wishlist.some((entry: any) => entry.id === item.id);
              const currentQty = cartQuantities[item.id] || 0;
              return (
                <TouchableOpacity key={`${item.id}-${item.__categoryName}`} activeOpacity={0.95} style={styles.productGridCard} onPress={() => openProductDetail(item)}>
                  <Image source={{ uri: item.image_url || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80' }} style={styles.productGridImage} />
                  <TouchableOpacity style={styles.favoriteButton} onPress={() => toggleWishlist(item)}>
                    <Text style={styles.favoriteButtonText}>{isSaved ? '♥' : '♡'}</Text>
                  </TouchableOpacity>
                  <View style={styles.productGridContent}>
                    <View style={styles.productGridMetaRow}>
                      <View style={styles.productGridBadge}>
                        <Text style={styles.productGridBadgeText}>{item.__categoryName || 'Featured'}</Text>
                      </View>
                      <Text style={styles.productGridDeliveryText}>In stock</Text>
                    </View>
                    <Text style={styles.productGridName}>{item.product_name}</Text>
                    <Text style={styles.productGridPrice}>UGX {Number(item.selling_price ?? 0).toLocaleString('en-US')}</Text>
                    <TouchableOpacity style={styles.productGridCartButton} onPress={(event: any) => { event?.stopPropagation?.(); setSelectedProduct(null); handleAddToCart(item.id, 1, item); }}>
                      <Text style={styles.productGridCartButtonText}>Add to cart</Text>
                    </TouchableOpacity>
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
              {wishlist.map((item: any) => (
                <TouchableOpacity key={`wishlist-${item.id}`} activeOpacity={0.95} style={styles.miniProductCard} onPress={() => openProductDetail(item)}>
                  <Image source={{ uri: item.image_url || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80' }} style={styles.miniProductImage} />
                  <View style={styles.miniProductContent}>
                    <Text style={styles.miniProductName}>{item.product_name}</Text>
                    <Text style={styles.miniProductPrice}>UGX {Number(item.selling_price ?? 0).toLocaleString('en-US')}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {recentlyViewed.length ? (
          <View style={styles.contentSectionWhite}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recently viewed</Text>
              <Text style={styles.viewAll}>Fresh picks</Text>
            </View>
            <ScrollView horizontal nestedScrollEnabled directionalLockEnabled showsHorizontalScrollIndicator={false} style={styles.horizontalList} contentContainerStyle={styles.horizontalListContent}>
              {recentlyViewed.map((item: any) => (
                <TouchableOpacity key={`recent-${item.id}`} activeOpacity={0.95} style={styles.miniProductCard} onPress={() => openProductDetail(item)}>
                  <Image source={{ uri: item.image_url || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80' }} style={styles.miniProductImage} />
                  <View style={styles.miniProductContent}>
                    <Text style={styles.miniProductName}>{item.product_name}</Text>
                    <Text style={styles.miniProductPrice}>UGX {Number(item.selling_price ?? 0).toLocaleString('en-US')}</Text>
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
    if (activeTab === 'Profile') return renderProfileScreen();
    return renderHomeBody();
  };

  const detailGallery = selectedProduct
    ? [selectedProduct.image_url || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80', selectedProduct.image_url || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80', selectedProduct.image_url || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80']
    : [];
  const isSelectedWishlisted = selectedProduct ? wishlist.some((item: any) => item.id === selectedProduct.id) : false;
  const selectedProductQty = selectedProduct ? (cartQuantities[selectedProduct.id] || 0) : 0;

  if (showSplash) {
    return (
      <SafeAreaProvider>
        <SplashScreen onFinish={() => setShowSplash(false)} />
      </SafeAreaProvider>
    );
  }

  if (loading) {
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
      <SafeAreaView style={styles.container}>
        <View style={styles.screenRoot}>
          {activeTab === 'Home' ? (
          <View style={styles.homeScreenRoot}>
            <View style={styles.topBar}>
              <TouchableOpacity style={styles.iconButton} onPress={() => setActiveTab('Categories')}>
                <Text style={styles.headerIconText}>☰</Text>
              </TouchableOpacity>
              <View style={styles.logoBox}>
                <View style={styles.logoTextBlock}>
                  <Text style={styles.logoText}>GLOW</Text>
                  <View style={styles.logoBadge} />
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
                <Image source={{ uri: selectedProduct.image_url || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80' }} style={styles.detailHeroImage} />
                <View style={styles.detailGalleryRow}>
                  {detailGallery.map((image, index) => (
                    <View key={`${image}-${index}`} style={styles.detailThumbCard}>
                      <Image source={{ uri: image }} style={styles.detailThumbImage} />
                    </View>
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
                    <Text style={styles.detailHighlightValue}>In stock</Text>
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
                    <TouchableOpacity style={styles.primaryActionButton} onPress={(event: any) => { event?.stopPropagation?.(); handleAddToCart(selectedProduct.id, 1, selectedProduct); }}>
                      <Text style={styles.primaryActionButtonText}>Add to cart</Text>
                    </TouchableOpacity>
                    <View style={styles.detailQuantityControl}>
                      <TouchableOpacity style={styles.quantityButton} onPress={(event: any) => { event?.stopPropagation?.(); adjustProductQuantity(selectedProduct.id, -1, selectedProduct); }}>
                        <Text style={styles.quantityButtonText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.quantityValue}>{selectedProductQty}</Text>
                      <TouchableOpacity style={styles.quantityButton} onPress={(event: any) => { event?.stopPropagation?.(); adjustProductQuantity(selectedProduct.id, 1, selectedProduct); }}>
                        <Text style={styles.quantityButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        ) : null}

        {showCartSummary && !selectedProduct && profileRoute !== 'cart' && profileRoute !== 'checkout' ? (
          <View style={styles.cartSummaryBar}>
            <View>
              <Text style={styles.cartSummaryBarTitle}>{cartCount} item{cartCount > 1 ? 's' : ''} in cart</Text>
              <Text style={styles.cartSummaryBarSubtitle}>UGX {((cart?.items || []).reduce((sum: number, item: any) => sum + Number(item.quantity || 1) * 25000, 0) + 5000).toLocaleString('en-US')}</Text>
            </View>
            <TouchableOpacity style={styles.cartSummaryButton} onPress={() => { setActiveTab('Profile'); setProfileRoute('cart'); }}>
              <Text style={styles.cartSummaryButtonText}>View cart</Text>
            </TouchableOpacity>
          </View>
        ) : null}

          <View style={styles.bottomNav}>
            {navItems.map((tab) => {
              const isSelected = activeTab === tab.key;
              return (
                <TouchableOpacity key={tab.key} style={[styles.navItem, isSelected && styles.navItemSelected]} onPress={() => setActiveTab(tab.key)}>
                  <View style={[styles.navIconBadge, isSelected && styles.navIconBadgeSelected]}>
                    <Text style={[styles.navIcon, isSelected && styles.navIconSelected]}>{tab.icon}</Text>
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
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  fullScreenPanel: { flex: 1, paddingBottom: 96, backgroundColor: '#FFFFFF' },
  splashContainer: {
    flex: 1,
    backgroundColor: '#1B2A4A',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 32,
  },
  logoStack: { alignItems: 'center', marginBottom: 8 },
  logoBadgeCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F5821F',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: -10,
    right: 15,
    elevation: 2,
  },
  logoBadgeCircleText: { fontSize: 12, color: '#FFFFFF' },
  splashLogo: { fontSize: 52, fontWeight: '800', color: '#FFFFFF', letterSpacing: 2.2 },
  splashTagline: { color: '#9CA3AF', fontSize: 10, fontWeight: '700', letterSpacing: 1.9, textTransform: 'uppercase', marginTop: 4, textAlign: 'center' },
  splashImage: { width: 220, height: 220, resizeMode: 'contain', marginVertical: 20, borderRadius: 24 },
  riderIllustration: { width: 220, height: 140, marginVertical: 24, justifyContent: 'center' },
  motorcycleBody: { position: 'absolute', bottom: 34, left: 40, width: 120, height: 38, borderRadius: 20, backgroundColor: '#F5821F' },
  motorcycleWheel: { position: 'absolute', bottom: 20, left: 54, width: 38, height: 38, borderRadius: 19, borderWidth: 8, borderColor: '#F7F7F9' },
  motorcycleWheelFront: { position: 'absolute', bottom: 20, right: 42, width: 38, height: 38, borderRadius: 19, borderWidth: 8, borderColor: '#F7F7F9' },
  helmet: { position: 'absolute', top: 20, right: 64, width: 42, height: 34, borderRadius: 16, backgroundColor: '#F5821F' },
  riderBody: { position: 'absolute', bottom: 32, right: 70, width: 54, height: 44, borderRadius: 24, backgroundColor: '#1B2A4A', borderWidth: 3, borderColor: '#F7F7F9' },
  deliveryBox: { position: 'absolute', bottom: 46, left: 80, width: 54, height: 40, borderRadius: 10, backgroundColor: '#F5821F', justifyContent: 'center', alignItems: 'center', padding: 6 },
  logoBadgeSmall: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFFFFF' },
  splashHeading: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', textAlign: 'center', marginTop: 4 },
  splashSubtext: { color: '#E5E7EB', fontSize: 14, textAlign: 'center', marginTop: 10, lineHeight: 22 },
  screenRoot: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { flexGrow: 1, paddingBottom: 112, paddingHorizontal: 16, backgroundColor: '#FFFFFF' },
  loaderScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F7F7F9' },
  loaderText: { marginTop: 12, color: '#1B2A4A', fontSize: 14 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, backgroundColor: '#1B2A4A' },
  iconButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  headerIconText: { fontSize: 20, color: '#1B2A4A' },
  logoBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  logoTextBlock: { flexDirection: 'row', alignItems: 'center', position: 'relative', backgroundColor: '#1B2A4A', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  logoText: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', letterSpacing: 1.6 },
  tagline: { marginTop: 3, color: '#7B8190', fontSize: 9, fontWeight: '700', letterSpacing: 1.7, textTransform: 'uppercase' },
  logoBadge: { position: 'absolute', top: -7, right: 12, width: 14, height: 14, borderRadius: 7, backgroundColor: '#F5821F' },
  badge: { position: 'absolute', top: -2, right: -2, backgroundColor: '#F5821F', borderRadius: 9, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
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
  orderNumber: { fontSize: 14, fontWeight: '800', color: '#1B2A4A' },
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
  cartItemImage: { width: 52, height: 52, borderRadius: 10, marginRight: 10, backgroundColor: '#F7F7F9' },
  cartItemImagePlaceholder: { width: 52, height: 52, borderRadius: 10, marginRight: 10, backgroundColor: '#E5E7EB' },
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
  checkoutSectionTitle: { fontSize: 16, fontWeight: '800', color: '#1B2A4A', marginBottom: 10 },
  addressCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  addressText: { fontSize: 13, color: '#6B7280', lineHeight: 20, marginTop: 8 },
  addressInput: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, color: '#111827', minHeight: 120, textAlignVertical: 'top', marginBottom: 16 },
  paymentCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  paymentLabel: { fontSize: 12, color: '#6B7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  paymentOptionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  paymentMethodTitle: { fontSize: 15, fontWeight: '800', color: '#1B2A4A' },
  paymentMethodSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  paymentBadge: { backgroundColor: '#EAFBF2', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  paymentBadgeText: { color: '#166534', fontSize: 11, fontWeight: '800' },
  checkoutPageContent: { paddingHorizontal: 16, paddingBottom: 24 },
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
  searchBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  homeScreenRoot: { flex: 1, backgroundColor: '#1B2A4A' },
  homeTopStatic: { backgroundColor: '#1B2A4A', zIndex: 2 },
  homeScroll: { flex: 1, backgroundColor: '#1B2A4A' },
  homePageShell: { backgroundColor: '#1B2A4A' },
  contentSectionWhite: { backgroundColor: '#FFFFFF', paddingBottom: 12, marginHorizontal: -16, paddingHorizontal: 0 },
  cartFeedbackBar: { marginHorizontal: 16, marginBottom: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: '#EAFBF2', borderWidth: 1, borderColor: '#BFE9CF' },
  cartFeedbackText: { color: '#166534', fontSize: 13, fontWeight: '700' },
  checkoutNoticeBox: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12, width: '100%' },
  checkoutNoticeSuccess: { backgroundColor: '#EAFBF2', borderWidth: 1, borderColor: '#BFE9CF' },
  checkoutNoticeError: { backgroundColor: '#FFF1F2', borderWidth: 1, borderColor: '#FECACA' },
  checkoutNoticeText: { color: '#1B2A4A', fontSize: 13, fontWeight: '700' },
  searchInput: { flex: 1, color: '#111827', fontSize: 14, paddingVertical: 0 },
  searchButton: { marginLeft: 8, width: 40, height: 40, borderRadius: 12, backgroundColor: '#F5821F', justifyContent: 'center', alignItems: 'center' },
  searchButtonIcon: { fontSize: 16, color: '#FFFFFF' },
  heroCardShell: { width: '100%', marginHorizontal: 0, marginBottom: 20, borderRadius: 28, backgroundColor: '#FFFFFF', padding: 12, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  heroBodyShell: { marginHorizontal: -16, borderRadius: 28, backgroundColor: '#FFFFFF', paddingHorizontal: 0, paddingVertical: 0, overflow: 'hidden' },
  heroBodyContent: { paddingHorizontal: 16, paddingTop: 0 },
  heroCard: { width: '100%', borderRadius: 24, backgroundColor: '#1B2A4A', paddingHorizontal: 18, paddingVertical: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 180, shadowColor: '#1B2A4A', shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  heroCardCompact: { flexDirection: 'column', alignItems: 'flex-start' },
  heroTextContainer: { flex: 1, paddingRight: 14, maxWidth: '55%' },
  heroPill: { alignSelf: 'flex-start', backgroundColor: 'rgba(245,130,31,0.18)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10 },
  heroPillText: { color: '#FDC38B', fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  heroLine: { color: '#FFFFFF', fontSize: 26, lineHeight: 34, fontWeight: '800', marginBottom: 4 },
  heroDelivered: { color: '#F5821F', fontSize: 16, lineHeight: 24, fontWeight: '700', marginTop: 10, marginBottom: 12, maxWidth: '90%' },
  shopButton: { marginTop: 0, backgroundColor: '#F5821F', alignSelf: 'flex-start', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 999, shadowColor: '#F5821F', shadowOpacity: 0.24, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  shopButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  heroVisual: { width: 132, height: 132, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  bottle: { width: 64, height: 84, borderRadius: 16, backgroundColor: '#F7F7F9', borderWidth: 2, borderColor: '#D8DEE8', alignItems: 'center', justifyContent: 'center', paddingTop: 6, position: 'absolute' },
  bottleBack: { transform: [{ rotate: '-12deg' }], left: 0, top: 16, backgroundColor: '#E8F0FB', zIndex: 1 },
  bottleMiddle: { transform: [{ rotate: '-4deg' }], left: 24, top: 6, backgroundColor: '#FDE3C5', zIndex: 2 },
  bottleFront: { transform: [{ rotate: '8deg' }], right: 0, top: 18, backgroundColor: '#FFFFFF', zIndex: 3 },
  bottleCap: { width: 24, height: 14, borderRadius: 6, backgroundColor: '#1B2A4A', position: 'absolute', top: -10 },
  bottleLabel: { fontSize: 8, fontWeight: '800', color: '#1B2A4A', letterSpacing: 0.8, textAlign: 'center' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 18, paddingBottom: 10, marginHorizontal: 0 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#1B2A4A' },
  viewAll: { color: '#F5821F', fontSize: 13, fontWeight: '700' },
  horizontalList: { paddingLeft: 16, paddingRight: 16 },
  horizontalListContent: { paddingRight: 16 },
  categoryCard: { width: 92, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 12, marginRight: 10, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 2, borderWidth: 1, borderColor: '#F0F2F5' },
  categoryIconBadge: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  categoryIconGlyph: { fontSize: 18 },
  categoryIconText: { fontSize: 24, marginBottom: 4 },
  categoryName: { fontSize: 12, color: '#1B2A4A', fontWeight: '700', textAlign: 'center', marginTop: 8 },
  productCard: { width: 170, backgroundColor: '#FFFFFF', borderRadius: 20, marginRight: 12, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3, position: 'relative', borderWidth: 1, borderColor: '#F0F2F5' },
  productImage: { width: '100%', height: 112, backgroundColor: '#F5F5F5' },
  productContent: { padding: 10 },
  productMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  productBadge: { backgroundColor: '#FFF2E6', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  productBadgeText: { color: '#F5821F', fontSize: 10, fontWeight: '800' },
  productDeliveryText: { color: '#6B7280', fontSize: 10, fontWeight: '700' },
  productName: { fontSize: 13, fontWeight: '800', color: '#1B2A4A', marginBottom: 4 },
  productPrice: { fontSize: 13, fontWeight: '800', color: '#F5821F', marginBottom: 8 },
  productActions: { marginTop: 14, alignItems: 'center', justifyContent: 'center', width: '100%' },
  cartButton: { backgroundColor: '#1B2A4A', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 20, alignItems: 'center', alignSelf: 'center', borderWidth: 1, borderColor: '#E5E7EB', minWidth: 140 },
  cartButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 0, paddingBottom: 18 },
  productGridCard: { width: '48%', backgroundColor: '#FFFFFF', borderRadius: 20, marginBottom: 12, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3, borderWidth: 1, borderColor: '#F0F2F5', position: 'relative' },
  productGridImage: { width: '100%', height: 126, backgroundColor: '#F5F5F5' },
  productGridContent: { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 12 },
  productGridMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  productGridBadge: { backgroundColor: '#FFF2E6', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  productGridBadgeText: { color: '#F5821F', fontSize: 9, fontWeight: '800' },
  productGridDeliveryText: { color: '#6B7280', fontSize: 10, fontWeight: '700' },
  productGridName: { fontSize: 13, fontWeight: '800', color: '#1B2A4A', marginBottom: 6 },
  productGridPrice: { fontSize: 13, fontWeight: '800', color: '#F5821F', marginBottom: 10 },
  productGridCartButton: { backgroundColor: '#1B2A4A', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center', width: '100%' },
  productGridCartButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  quantityControl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F7F9', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 4, alignSelf: 'center' },
  quantityButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  quantityButtonText: { color: '#1B2A4A', fontSize: 16, fontWeight: '800' },
  quantityValue: { minWidth: 24, textAlign: 'center', fontSize: 13, fontWeight: '800', color: '#1B2A4A', marginHorizontal: 8 },
  favoriteButton: { position: 'absolute', top: 10, right: 10, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.92)', justifyContent: 'center', alignItems: 'center' },
  favoriteButtonText: { fontSize: 16, color: '#F5821F' },
  miniProductCard: { width: 140, backgroundColor: '#FFFFFF', borderRadius: 16, marginRight: 10, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  miniProductImage: { width: '100%', height: 88, backgroundColor: '#F5F5F5' },
  miniProductContent: { padding: 10 },
  miniProductName: { fontSize: 13, fontWeight: '700', color: '#1B2A4A' },
  miniProductPrice: { marginTop: 4, fontSize: 12, fontWeight: '700', color: '#6B7280' },
  detailOverlay: { ...StyleSheet.absoluteFill, zIndex: 20, justifyContent: 'flex-end' },
  detailOverlayBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(3, 8, 20, 0.45)' },
  detailSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 24, height: '92%', overflow: 'hidden' },
  detailSheetHandle: { width: 48, height: 5, borderRadius: 999, backgroundColor: '#E5E7EB', alignSelf: 'center', marginTop: 10 },
  detailSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  detailCloseButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F7F7F9', justifyContent: 'center', alignItems: 'center' },
  detailCloseButtonText: { fontSize: 16, color: '#1B2A4A' },
  detailFavoriteButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF2E6', justifyContent: 'center', alignItems: 'center' },
  detailFavoriteButtonText: { fontSize: 16, color: '#F5821F' },
  detailScrollContent: { paddingHorizontal: 16, paddingBottom: 12 },
  detailHeroImage: { width: '100%', height: 220, borderRadius: 20, backgroundColor: '#F5F5F5' },
  detailGalleryRow: { flexDirection: 'row', marginTop: 12 },
  detailThumbCard: { width: 74, height: 56, borderRadius: 12, overflow: 'hidden', marginRight: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  detailThumbImage: { width: '100%', height: '100%' },
  detailTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 14 },
  detailTitleBlock: { flex: 1, paddingRight: 8 },
  detailTitle: { fontSize: 20, fontWeight: '800', color: '#1B2A4A' },
  detailCategory: { marginTop: 4, fontSize: 13, color: '#6B7280' },
  detailPriceChip: { backgroundColor: '#FFF2E6', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  detailPriceText: { fontSize: 13, fontWeight: '800', color: '#F5821F' },
  detailDescription: { marginTop: 12, fontSize: 14, lineHeight: 22, color: '#4B5563' },
  detailHighlightsRow: { flexDirection: 'row', marginTop: 16 },
  detailHighlightBox: { flex: 1, backgroundColor: '#F7F7F9', borderRadius: 14, padding: 12, marginRight: 8 },
  detailHighlightLabel: { fontSize: 11, color: '#6B7280', fontWeight: '700' },
  detailHighlightValue: { marginTop: 4, fontSize: 13, fontWeight: '700', color: '#1B2A4A' },
  detailActionRow: { flexDirection: 'column', marginTop: 18, gap: 10 },
  detailPrimaryActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  detailQuantityControl: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F7F9', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 6 },
  secondaryActionButton: { backgroundColor: '#F7F7F9', borderRadius: 999, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center' },
  secondaryActionButtonText: { color: '#1B2A4A', fontWeight: '700', fontSize: 13 },
  primaryActionButton: { flex: 1, backgroundColor: '#F5821F', borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
  primaryActionButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  categoryPage: { flex: 1, backgroundColor: '#F7F7F9' },
  screenHeaderNavy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#1B2A4A' },
  headerIconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  headerBackArrow: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  searchBarCategories: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 12, marginBottom: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB' },
  headerActionsRow: { flexDirection: 'row', alignItems: 'center' },
  sidebarToggleButton: { marginLeft: 8, width: 40, height: 40, borderRadius: 12, backgroundColor: '#F5821F', justifyContent: 'center', alignItems: 'center' },
  categorySplitView: { flex: 1, flexDirection: 'row' },
  categorySidebar: { width: 110, backgroundColor: '#1B2A4A', paddingVertical: 8 },
  sidebarRow: { paddingVertical: 10, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 3, borderLeftColor: 'transparent' },
  sidebarRowActive: { backgroundColor: 'rgba(245,130,31,0.16)', borderLeftColor: '#F5821F' },
  sidebarIconBadge: { width: 28, height: 28, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  sidebarIconText: { marginRight: 8, fontSize: 16 },
  sidebarLabel: { color: '#D7DCE6', fontSize: 11, fontWeight: '600' },
  sidebarLabelActive: { color: '#F5821F' },
  categoryContentArea: { flex: 1, backgroundColor: '#FFFFFF', padding: 12 },
  gridContent: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingBottom: 16 },
  emptyStateCard: { width: '100%', backgroundColor: '#F7F7F9', borderRadius: 18, padding: 18, marginTop: 6, borderWidth: 1, borderColor: '#E5E7EB' },
  emptyStateTitle: { fontSize: 15, fontWeight: '800', color: '#1B2A4A', marginBottom: 6 },
  emptyStateText: { fontSize: 13, color: '#6B7280', lineHeight: 20 },
  categoryGridCard: { width: '31%', backgroundColor: '#FFFFFF', borderRadius: 18, padding: 10, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  categoryGridIconBadge: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  gridImage: { width: '100%', height: 90, borderRadius: 12, backgroundColor: '#F5F5F5' },
  gridCardTitle: { fontSize: 13, fontWeight: '800', color: '#1B2A4A', marginTop: 10 },
  gridCardCount: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  ordersPage: { flex: 1, backgroundColor: '#F7F7F9' },
  filterTabsRow: { backgroundColor: '#FFFFFF', paddingVertical: 6, marginTop: 0 },
  filterTabsContent: { paddingHorizontal: 0, paddingVertical: 0 },
  filterTab: { marginRight: 18, alignItems: 'center', paddingBottom: 2 },
  filterTabText: { color: '#6B7280', fontWeight: '700', fontSize: 13 },
  filterTabTextActive: { color: '#F5821F' },
  filterTabUnderline: { marginTop: 4, width: '100%', height: 2, backgroundColor: '#F5821F', borderRadius: 999 },
  orderListContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  ordersIntroCard: { backgroundColor: '#FFF7ED', borderRadius: 16, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#FDE3C5' },
  ordersIntroTitle: { color: '#1B2A4A', fontSize: 14, fontWeight: '800', marginBottom: 4 },
  ordersIntroText: { color: '#6B7280', fontSize: 12, lineHeight: 18 },
  orderCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#EEF2F7', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  orderCardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  orderDate: { color: '#6B7280', fontSize: 12, marginBottom: 10 },
  thumbnailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  thumbBox: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#E5E7EB', marginRight: 8 },
  thumbImage: { width: 34, height: 34, borderRadius: 8, marginRight: 8, backgroundColor: '#F5F5F5' },
  moreThumbBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#F3F4F6' },
  moreThumbText: { color: '#6B7280', fontSize: 11, fontWeight: '700' },
  orderMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  orderMetaText: { color: '#6B7280', fontSize: 12 },
  orderTotalText: { color: '#1B2A4A', fontSize: 14, fontWeight: '800' },
  detailButton: { borderWidth: 1, borderColor: '#1B2A4A', borderRadius: 999, paddingVertical: 10, alignItems: 'center', flex: 1, marginRight: 8 },
  detailButtonText: { color: '#1B2A4A', fontWeight: '700', fontSize: 13 },
  trackButton: { backgroundColor: '#F5821F', borderRadius: 999, paddingVertical: 10, alignItems: 'center', flex: 1, shadowColor: '#F5821F', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  trackButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  ordersEmptyActionButton: { marginTop: 12, backgroundColor: '#F5821F', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14, alignSelf: 'flex-start' },
  ordersEmptyActionText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  orderActionsRow: { flexDirection: 'row', alignItems: 'center' },
  trackingCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, marginTop: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
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
  inputField: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginTop: 8, color: '#111827' },
  notificationCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F7F7F9', borderRadius: 16, padding: 12, marginBottom: 12 },
  notificationTextArea: { flex: 1, paddingRight: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  statusPending: { backgroundColor: '#FFF2E6' },
  statusProcessing: { backgroundColor: '#FFF2E6' },
  statusShipped: { backgroundColor: '#EAF2FF' },
  statusDelivered: { backgroundColor: '#EAFBF2' },
  statusCancelled: { backgroundColor: '#F1F3F5' },
  statusBadgeText: { color: '#1B2A4A', fontSize: 11, fontWeight: '700' },
  orderDetailCard: { margin: 16, padding: 16, borderRadius: 20, backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  detailNumber: { fontSize: 17, fontWeight: '800', color: '#1B2A4A' },
  detailMeta: { fontSize: 13, color: '#6B7280', marginTop: 6 },
  detailTotal: { fontSize: 20, fontWeight: '800', color: '#1B2A4A', marginTop: 12 },
  profilePage: { flex: 1, backgroundColor: '#F7F7F9', paddingBottom: 24 },
  profileHeaderBlock: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 38, backgroundColor: '#1B2A4A', borderBottomLeftRadius: 28, borderBottomRightRadius: 28, minHeight: 220 },
  profileHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  profileHeaderBack: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  profileHeaderBackText: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  profileHeaderTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  profileHeaderScreenTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', marginTop: 16 },
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
  accountOverviewCard: { marginTop: -28, marginHorizontal: 16, backgroundColor: '#FFFFFF', borderRadius: 22, padding: 16, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  accountOverviewHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  accountOverviewTitle: { fontSize: 16, fontWeight: '800', color: '#1B2A4A' },
  accountOverviewCaption: { marginTop: 4, fontSize: 12, color: '#6B7280' },
  accountOverviewBadge: { backgroundColor: '#EAFBF2', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  accountOverviewBadgeText: { color: '#166534', fontSize: 11, fontWeight: '800' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 12 },
  statBox: { width: '48%', backgroundColor: '#F7F7F9', borderRadius: 14, padding: 12, marginBottom: 10, alignItems: 'center' },
  statIcon: { fontSize: 20, marginBottom: 6 },
  statValue: { color: '#1B2A4A', fontSize: 18, fontWeight: '800' },
  statLabel: { color: '#6B7280', fontSize: 12, marginTop: 2 },
  quickActionsCard: { marginTop: 16, marginHorizontal: 16, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  quickActionsTitle: { fontSize: 15, fontWeight: '800', color: '#1B2A4A' },
  quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 12 },
  quickActionCard: { width: '48%', backgroundColor: '#F7F7F9', borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#F0F2F5' },
  quickActionIcon: { fontSize: 20, marginBottom: 6 },
  quickActionTitle: { color: '#1B2A4A', fontSize: 13, fontWeight: '800' },
  quickActionSubtitle: { color: '#6B7280', fontSize: 11, marginTop: 4 },
  menuList: { marginTop: 16, marginHorizontal: 16, backgroundColor: '#FFFFFF', borderRadius: 18, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  menuListHeader: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 6 },
  menuListTitle: { color: '#1B2A4A', fontSize: 15, fontWeight: '800' },
  menuListHint: { color: '#6B7280', fontSize: 12, marginTop: 4 },
  menuRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  recentOrdersCard: { marginTop: 16, marginHorizontal: 16, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  recentOrdersHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  recentOrderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  recentOrderTextBlock: { flex: 1, paddingRight: 10 },
  favoriteItemCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  favoriteItemImage: { width: 48, height: 48, borderRadius: 12, marginRight: 12, backgroundColor: '#F7F7F9' },
  favoriteItemImagePlaceholder: { width: 48, height: 48, borderRadius: 12, marginRight: 12, backgroundColor: '#E5E7EB' },
  favoriteItemTextBlock: { flex: 1, paddingRight: 8 },
  addressOptionCard: { backgroundColor: '#F7F7F9', borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  addressOptionCardActive: { borderColor: '#F5821F', backgroundColor: '#FFF7ED' },
  addressOptionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addressBadge: { backgroundColor: '#EAFBF2', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  addressBadgeText: { color: '#166534', fontSize: 10, fontWeight: '800' },
  menuLabelWrap: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  menuIcon: { fontSize: 16, marginRight: 12 },
  menuLabel: { color: '#111827', fontSize: 14, fontWeight: '700' },
  menuChevron: { color: '#9CA3AF', fontSize: 18 },
  primaryButton: { marginTop: 16, marginHorizontal: 16, backgroundColor: '#F5821F', borderRadius: 999, paddingVertical: 12, alignItems: 'center', shadowColor: '#F5821F', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  checkoutIntroCard: { backgroundColor: '#FFF7ED', borderRadius: 16, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#FDE3C5' },
  checkoutIntroTitle: { color: '#1B2A4A', fontSize: 14, fontWeight: '800', marginBottom: 4 },
  checkoutIntroText: { color: '#6B7280', fontSize: 12, lineHeight: 18 },
  profileDetailCard: { marginTop: 20, marginHorizontal: 16, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  profileDetailBody: { color: '#4B5563', fontSize: 14, lineHeight: 22, marginBottom: 16 },
  profilePageContent: { paddingBottom: 120 },
  cartListContainer: { gap: 10 },
  cartSummaryBar: { position: 'absolute', left: 16, right: 16, bottom: 90, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, backgroundColor: '#1B2A4A', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  cartSummaryBarTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  cartSummaryBarSubtitle: { color: '#F5CBA7', fontSize: 12, marginTop: 2 },
  cartSummaryButton: { backgroundColor: '#F5821F', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  cartSummaryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  bottomNav: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 10, paddingBottom: 16, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#EEF2F7' },
  navItem: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 16, marginHorizontal: 2 },
  navItemSelected: { backgroundColor: '#FFF4E8' },
  navIconBadge: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' },
  navIconBadgeSelected: { backgroundColor: '#FFE7CC' },
  navIcon: { fontSize: 18, color: '#6B7280' },
  navIconSelected: { color: '#F5821F' },
  navText: { color: '#6B7280', fontSize: 11, fontWeight: '700', marginTop: 4 },
  navTextSelected: { color: '#F5821F' },
});

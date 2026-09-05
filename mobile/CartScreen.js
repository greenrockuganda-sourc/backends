import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

const API_BASE_URL = Platform.select({
  android: 'http://10.0.2.2:8000',
  default: 'http://192.168.1.10:8000',
});

const colors = {
  navy: '#1B2A4A',
  orange: '#F5821F',
  white: '#FFFFFF',
  border: '#E5E7EB',
  text: '#111827',
  muted: '#6B7280',
  success: '#16A34A',
  bg: '#F7F7F9',
};

const Header = ({ title, onBack, onClear }) => (
  <View style={styles.headerBar}>
    <TouchableOpacity onPress={onBack} style={styles.headerIconBtn}>
      <Text style={styles.headerIconText}>←</Text>
    </TouchableOpacity>
    <Text style={styles.headerTitle}>{title}</Text>
    <TouchableOpacity onPress={onClear} style={styles.headerRightButton}>
      <Text style={styles.headerRightText}>Clear All</Text>
    </TouchableOpacity>
  </View>
);

const PrimaryButton = ({ title, onPress, disabled = false }) => (
  <TouchableOpacity
    style={[styles.primaryButton, disabled && styles.primaryButtonDisabled]}
    onPress={onPress}
    disabled={disabled}
  >
    <Text style={styles.primaryButtonText}>{title}</Text>
  </TouchableOpacity>
);

const EmptyState = ({ onStartShopping }) => (
  <View style={styles.emptyStateContainer}>
    <View style={styles.emptyIconBox}>
      <Text style={styles.emptyIconText}>🛒</Text>
    </View>
    <Text style={styles.emptyTitle}>Your cart is empty</Text>
    <Text style={styles.emptySubtitle}>Looks like you haven’t added anything yet.</Text>
    <PrimaryButton title="Start Shopping" onPress={onStartShopping} />
  </View>
);

export default function CartScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(null);

  const fetchCart = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/cart/`);
      const data = await response.json();
      const normalized = (data.items || []).map((item) => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.product_name,
        image_url: item.image_url || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80',
        price: item.price || 0,
        quantity: item.quantity || 1,
        subtotal: item.subtotal || item.price * (item.quantity || 1),
      }));
      setItems(normalized);
    } catch (error) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCart();
  }, []);

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
  }, [items]);

  const deliveryFee = 0;
  const discountValue = promoApplied ? Math.min(20000, Math.round(subtotal * 0.1)) : 0;
  const total = subtotal + deliveryFee - discountValue;

  const updateQuantity = async (itemId, nextQty) => {
    const target = items.find((item) => item.id === itemId);
    if (!target) {
      return;
    }
    if (nextQty <= 0) {
      await removeItem(itemId);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/cart/update/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cart_item_id: itemId, quantity: nextQty }),
      });
      const data = await response.json();
      if (response.ok && data?.items) {
        const normalized = (data.items || []).map((entry) => ({
          id: entry.id,
          product_id: entry.product_id,
          product_name: entry.product_name,
          image_url: entry.image_url || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80',
          price: entry.price || 0,
          quantity: entry.quantity || 1,
          subtotal: entry.subtotal || entry.price * (entry.quantity || 1),
        }));
        setItems(normalized);
      } else {
        setItems((current) => current.map((entry) => entry.id === itemId ? { ...entry, quantity: nextQty, subtotal: entry.price * nextQty } : entry));
      }
    } catch (error) {
      setItems((current) => current.map((entry) => entry.id === itemId ? { ...entry, quantity: nextQty, subtotal: entry.price * nextQty } : entry));
    }
  };

  const removeItem = async (itemId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/cart/remove/${itemId}/`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setItems((current) => current.filter((entry) => entry.id !== itemId));
      }
    } catch (error) {
      setItems((current) => current.filter((entry) => entry.id !== itemId));
    }
  };

  const clearCart = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/cart/clear/`, { method: 'DELETE' });
      setItems([]);
      setPromoApplied(null);
      setPromoCode('');
    } catch (error) {
      setItems([]);
      setPromoApplied(null);
      setPromoCode('');
    }
  };

  const applyPromo = () => {
    const normalized = promoCode.trim().toUpperCase();
    if (normalized === 'GLOW10') {
      setPromoApplied({ code: normalized, amount: Math.min(20000, Math.round(subtotal * 0.1)) });
    } else {
      setPromoApplied(null);
    }
  };

  const renderCartItem = ({ item }) => (
    <View style={styles.cartCard}>
      <Image source={{ uri: item.image_url }} style={styles.itemImage} />
      <View style={styles.itemBody}>
        <Text style={styles.itemName}>{item.product_name}</Text>
        <Text style={styles.itemVariant}>500ml</Text>
        <Text style={styles.itemPrice}>UGX {Number(item.price || item.subtotal).toLocaleString('en-US')}</Text>
      </View>
      <View style={styles.itemActions}>
        <TouchableOpacity style={styles.deleteButton} onPress={() => removeItem(item.id)}>
          <Text style={styles.deleteButtonText}>🗑️</Text>
        </TouchableOpacity>
        <View style={styles.counterRow}>
          <TouchableOpacity style={styles.counterButton} onPress={() => updateQuantity(item.id, item.quantity - 1)}>
            <Text style={styles.counterButtonText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.counterValue}>{item.quantity}</Text>
          <TouchableOpacity style={styles.counterButton} onPress={() => updateQuantity(item.id, item.quantity + 1)}>
            <Text style={styles.counterButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen}>
        <Header title="My Cart" onBack={() => navigation?.goBack?.()} onClear={clearCart} />
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.orange} />
            <Text style={styles.loadingText}>Syncing your cart…</Text>
          </View>
        ) : items.length === 0 ? (
          <EmptyState onStartShopping={() => navigation?.navigate?.('Home')} />
        ) : (
          <View style={styles.contentContainer}>
          <FlatList
            data={items}
            keyExtractor={(item) => `${item.id}`}
            contentContainerStyle={styles.listContent}
            renderItem={renderCartItem}
            showsVerticalScrollIndicator={false}
          />

          <View style={styles.promoCard}>
            <TextInput
              style={styles.input}
              placeholder="Enter promo code"
              placeholderTextColor={colors.muted}
              value={promoCode}
              onChangeText={setPromoCode}
            />
            <TouchableOpacity style={styles.applyButton} onPress={applyPromo}>
              <Text style={styles.applyButtonText}>Apply</Text>
            </TouchableOpacity>
          </View>
          {promoApplied ? (
            <View style={styles.promoSuccessRow}>
              <Text style={styles.promoSuccessText}>Promo {promoApplied.code} applied — discount UGX {promoApplied.amount.toLocaleString('en-US')}</Text>
              <TouchableOpacity onPress={() => { setPromoApplied(null); setPromoCode(''); }}>
                <Text style={styles.removePromoLink}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>UGX {subtotal.toLocaleString('en-US')}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivery Fee</Text>
              <Text style={styles.summaryValue}>Free</Text>
            </View>
            {promoApplied ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Discount</Text>
                <Text style={styles.summaryValueDiscount}>- UGX {promoApplied.amount.toLocaleString('en-US')}</Text>
              </View>
            ) : null}
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryTotalLabel}>Total</Text>
              <Text style={styles.summaryTotalValue}>UGX {total.toLocaleString('en-US')}</Text>
            </View>
          </View>

          <View style={styles.bottomBar}>
            <PrimaryButton title="Proceed to Checkout" onPress={() => navigation?.navigate?.('Checkout')} disabled={items.length === 0} />
          </View>
        </View>
      )}
        </SafeAreaView>
      </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.navy,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  headerIconText: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '700',
  },
  headerTitle: {
    flex: 1,
    color: colors.white,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
  },
  headerRightButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerRightText: {
    color: '#FCD7B3',
    fontSize: 13,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 13,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyIconBox: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  emptyIconText: {
    fontSize: 42,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.navy,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: 18,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  listContent: {
    paddingBottom: 12,
  },
  cartCard: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  itemImage: {
    width: 70,
    height: 70,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    marginRight: 12,
  },
  itemBody: {
    flex: 1,
    justifyContent: 'center',
  },
  itemName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  itemVariant: {
    color: colors.muted,
    fontSize: 12,
    marginBottom: 4,
  },
  itemPrice: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  itemActions: {
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  deleteButton: {
    padding: 4,
  },
  deleteButtonText: {
    fontSize: 16,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  counterButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  counterButtonText: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: '800',
  },
  counterValue: {
    paddingHorizontal: 8,
    color: colors.text,
    fontWeight: '700',
  },
  promoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    marginRight: 8,
  },
  applyButton: {
    backgroundColor: colors.orange,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  applyButtonText: {
    color: colors.white,
    fontWeight: '700',
  },
  promoSuccessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  promoSuccessText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  removePromoLink: {
    color: colors.orange,
    fontSize: 12,
    fontWeight: '700',
  },
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 13,
  },
  summaryValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  summaryValueDiscount: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '700',
  },
  divider: {
    borderTopWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
    marginBottom: 8,
  },
  summaryTotalLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  summaryTotalValue: {
    color: colors.orange,
    fontSize: 16,
    fontWeight: '900',
  },
  bottomBar: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingBottom: 6,
  },
  primaryButton: {
    backgroundColor: colors.orange,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 14,
  },
});

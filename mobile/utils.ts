// Used only when a product has no uploaded image. This is a product image—not
// the Glow logo—so empty catalog records still look like products.
export const DEFAULT_PRODUCT_IMAGE = 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=75';

export const formatCurrency = (amount: number | string | null | undefined, locale = 'en-US', currency = 'UGX') => {
  const num = Number(amount || 0);
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(num);
  } catch {
    return `UGX ${num.toLocaleString()}`;
  }
};

export const getOrderImageUrls = (order: any): string[] => {
  if (!order) return [];
  const urls: string[] = [];

  const addUrl = (value: any) => {
    if (!value) return;
    const strValue = String(value).trim();
    if (!strValue) return;
    urls.push(strValue);
  };

  if (Array.isArray(order.items)) {
    order.items.forEach((it: any) => {
      addUrl(it?.image_url);
      addUrl(it?.product_image);
      addUrl(it?.image);
      addUrl(it?.product?.image_url);
      addUrl(it?.product?.image);
      addUrl(it?.product?.product_image);
    });
  }

  if (Array.isArray(order.image_urls)) {
    order.image_urls.forEach(addUrl);
  }
  addUrl(order.image_url);
  addUrl(order.image);

  const seen = new Set<string>();
  const deduped: string[] = [];
  urls.forEach((u) => {
    if (!seen.has(u)) {
      seen.add(u);
      deduped.push(u);
    }
  });

  const normalized = deduped.slice(0, 3);
  return normalized.length ? normalized : [DEFAULT_PRODUCT_IMAGE];
};

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

  if (Array.isArray(order.items)) {
    order.items.forEach((it: any) => {
      const url = it?.image_url || it?.product_image || it?.image || (it?.product && (it.product.image_url || it.product.image));
      if (url) urls.push(url);
    });
  }

  if (Array.isArray(order.image_urls)) urls.push(...order.image_urls.filter(Boolean));
  if (order.image_url) urls.push(order.image_url);

  const seen = new Set<string>();
  const deduped: string[] = [];
  urls.forEach((u) => {
    if (!u) return;
    if (!seen.has(u)) {
      seen.add(u);
      deduped.push(u);
    }
  });

  return deduped.slice(0, 3);
};

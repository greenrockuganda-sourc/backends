import { Product, Order, Delivery, Receipt, DashboardStats } from './types'

const API_BASE = '/api'

// Helper for making requests
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`)
  }

  return response.json()
}

// Products
export const productsApi = {
  getAll: () => apiCall<Product[]>('/products'),
  getById: (id: string) => apiCall<Product>(`/products/${id}`),
  create: (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) =>
    apiCall<Product>('/products', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Product>) =>
    apiCall<Product>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiCall<void>(`/products/${id}`, { method: 'DELETE' }),
  updateStock: (id: string, quantity: number) =>
    apiCall<Product>(`/products/${id}/stock`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity }),
    }),
}

// Orders
export const ordersApi = {
  getAll: () => apiCall<Order[]>('/orders'),
  getById: (id: string) => apiCall<Order>(`/orders/${id}`),
  create: (data: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>) =>
    apiCall<Order>('/orders', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Order>) =>
    apiCall<Order>(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateStatus: (id: string, status: Order['status']) =>
    apiCall<Order>(`/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  delete: (id: string) => apiCall<void>(`/orders/${id}`, { method: 'DELETE' }),
}

// Deliveries
export const deliveriesApi = {
  getAll: () => apiCall<Delivery[]>('/deliveries'),
  getById: (id: string) => apiCall<Delivery>(`/deliveries/${id}`),
  create: (data: Omit<Delivery, 'id' | 'createdAt' | 'updatedAt'>) =>
    apiCall<Delivery>('/deliveries', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Delivery>) =>
    apiCall<Delivery>(`/deliveries/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateStatus: (id: string, status: Delivery['status']) =>
    apiCall<Delivery>(`/deliveries/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  issueReceipt: (id: string) =>
    apiCall<Receipt>(`/deliveries/${id}/receipt`, { method: 'POST' }),
}

// Receipts
export const receiptsApi = {
  getAll: () => apiCall<Receipt[]>('/receipts'),
  getById: (id: string) => apiCall<Receipt>(`/receipts/${id}`),
  create: (data: Omit<Receipt, 'id' | 'receiptNumber' | 'issuedAt'>) =>
    apiCall<Receipt>('/receipts', { method: 'POST', body: JSON.stringify(data) }),
  downloadPdf: (id: string) =>
    fetch(`${API_BASE}/receipts/${id}/pdf`).then(r => r.blob()),
}

// Dashboard Stats
export const dashboardApi = {
  getStats: () => apiCall<DashboardStats>('/stats'),
}

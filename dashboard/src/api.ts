/// <reference types="vite/client" />
import type { Brand, Category, Customer, DashboardSummary, Delivery, Order, Payment, Product, Receipt, User } from './types'

const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

interface Tokens {
  access: string
  refresh: string
}

function authHeaders(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, options)
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || response.statusText)
  }
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return null as unknown as T
  }
  return response.json() as Promise<T>
}

export async function login(emailOrPhone: string, password: string) {
  return request<{ access: string; refresh: string; user: User }>(`/api/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email_or_phone: emailOrPhone, password }),
  })
}

export async function fetchDashboard(token: string) {
  return request<{ summary: DashboardSummary; charts: any; recent_activity: any }>(`/api/admin/dashboard/`, {
    headers: authHeaders(token),
  })
}

export async function fetchProfile(token: string) {
  return request<User>(`/api/user/profile/`, {
    headers: authHeaders(token),
  })
}

export async function fetchProducts(token: string, query = '') {
  const qs = query ? `?search=${encodeURIComponent(query)}` : ''
  return request<{ count: number; page: number; page_size: number; results: Product[] }>(`/api/products/${qs}`, {
    headers: authHeaders(token),
  })
}

export async function fetchProduct(token: string, id: number) {
  return request<Product>(`/api/products/${id}/`, {
    headers: authHeaders(token),
  })
}

export async function createProduct(token: string, payload: FormData) {
  return request<Product>(`/api/products/`, {
    method: 'POST',
    headers: authHeaders(token),
    body: payload,
  })
}

export async function updateProduct(token: string, id: number, payload: FormData) {
  return request<Product>(`/api/products/${id}/`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: payload,
  })
}

export async function deleteProduct(token: string, id: number) {
  return request<{ message: string }>(`/api/products/${id}/`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
}

export async function fetchCategories() {
  return request<Category[]>(`/api/categories/`, { method: 'GET' })
}

export async function createCategory(token: string, payload: object) {
  return request<Category>(`/api/categories/`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function fetchBrands(token: string) {
  return request<Brand[]>(`/api/brands/`, {
    headers: authHeaders(token),
  })
}

export async function createBrand(token: string, payload: object) {
  return request<Brand>(`/api/brands/`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function fetchInventory(token: string) {
  return request<Array<{ id: number; product: string; current_stock: number; reorder_level: number; stock_status: string; last_updated: string }>>(
    `/api/admin/inventory/`,
    { headers: authHeaders(token) },
  )
}

export async function updateInventory(token: string, id: number, change: number) {
  return request<{ id: number; current_stock: number; stock_status: string }>(`/api/admin/inventory/${id}/`, {
    method: 'PATCH',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ change }),
  })
}

export async function fetchCustomers(token: string) {
  return request<Customer[]>(`/api/admin/customers/`, {
    headers: authHeaders(token),
  })
}

export async function fetchOrders(token: string) {
  return request<Order[]>(`/api/admin/orders/`, {
    headers: authHeaders(token),
  })
}

export async function fetchPayments(token: string) {
  return request<Payment[]>(`/api/admin/payments/`, {
    headers: authHeaders(token),
  })
}

export async function fetchDeliveries(token: string) {
  return request<Delivery[]>(`/api/admin/deliveries/`, {
    headers: authHeaders(token),
  })
}

export async function fetchReceipts(token: string) {
  return request<Receipt[]>(`/api/admin/receipts/`, {
    headers: authHeaders(token),
  })
}

export async function sendReceiptEmail(token: string, id: number, payload: { email: string }) {
  return request<{ message: string; pdf_url?: string }>(`/api/admin/receipts/${id}/email/`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function fetchReceiptPdf(token: string, id: number) {
  const response = await fetch(`${baseUrl}/api/admin/receipts/${id}/pdf/`, {
    method: 'GET',
    headers: authHeaders(token),
  })
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || response.statusText)
  }
  return response.blob()
}

export async function fetchReports(token: string, reportType: string) {
  return request<any>(`/api/admin/reports/${reportType}/`, {
    headers: authHeaders(token),
  })
}

export async function confirmOrder(token: string, orderId: number) {
  return request<{ message: string }>(`/api/admin/orders/${orderId}/confirm/`, {
    method: 'PATCH',
    headers: authHeaders(token),
  })
}

export async function updateOrderStatus(token: string, orderId: number, status: string) {
  return request<{ message: string }>(`/api/admin/orders/${orderId}/status/`, {
    method: 'PATCH',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
}

export async function cancelOrder(token: string, orderId: number) {
  return request<{ message: string }>(`/api/admin/orders/${orderId}/cancel/`, {
    method: 'PATCH',
    headers: authHeaders(token),
  })
}

export async function updatePaymentStatus(token: string, orderId: number, payment_status: string) {
  return request<{ message: string }>(`/api/admin/orders/${orderId}/payment/`, {
    method: 'PATCH',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment_status }),
  })
}

export async function logout(token: string) {
  return request<{ message: string }>(`/api/auth/logout/`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: localStorage.getItem('refresh') || '' }),
  })
}

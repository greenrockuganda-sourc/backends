/**
 * Django API Integration Layer
 * This module provides comprehensive integration with Django REST Framework backend
 */

import { Order, OrderItem, Delivery } from './types'

// Configuration for Django API endpoints
const DJANGO_API_BASE = `${(import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000').replace(/\/+$/, '')}/api`
const API_VERSION = 'v1'

// API endpoints matching Django URL patterns
export const DJANGO_ENDPOINTS = {
  orders: {
    list: `/orders/`,
    detail: (id: string | number) => `/orders/${id}/`,
    create: `/orders/`,
    update: (id: string | number) => `/orders/${id}/`,
    partial: (id: string | number) => `/orders/${id}/`,
    delete: (id: string | number) => `/orders/${id}/`,
    status: (id: string | number) => `/orders/${id}/update-status/`,
    items: (id: string | number) => `/orders/${id}/items/`,
    track: (orderId: string | number) => `/orders/${orderId}/track/`,
    analytics: `/orders/analytics/`,
    bulk_update: `/orders/bulk-update/`,
  },
  customers: {
    list: `/customers/`,
    detail: (id: string | number) => `/customers/${id}/`,
    orders: (id: string | number) => `/customers/${id}/orders/`,
  },
  deliveries: {
    list: `/deliveries/`,
    detail: (id: string | number) => `/deliveries/${id}/`,
    update_status: (id: string | number) => `/deliveries/${id}/update-status/`,
    track: (id: string | number) => `/deliveries/${id}/track/`,
  },
}

interface DjangoRequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean>
  timeout?: number
  retries?: number
}

/**
 * Make authenticated request to Django API
 */
async function djangoApiCall<T>(
  endpoint: string,
  options: DjangoRequestOptions = {}
): Promise<T> {
  const { params, timeout = 30000, retries = 3, ...fetchOptions } = options
  
  // Build URL with query parameters
  let url = new URL(endpoint, DJANGO_API_BASE).href
  if (params) {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      searchParams.append(key, String(value))
    })
    url += `?${searchParams.toString()}`
  }

  // Add auth token if available
  const token = localStorage.getItem('django_auth_token')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  }
  
  if (token) {
    headers['Authorization'] = `Token ${token}`
  }

  // Retry logic for failed requests
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        if (response.status === 401) {
          // Handle unauthorized - clear token
          localStorage.removeItem('django_auth_token')
          throw new Error('Authentication required')
        }
        
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          errorData.detail || 
          errorData.error || 
          `API Error: ${response.statusText}`
        )
      }

      return await response.json()
    } catch (error) {
      lastError = error as Error
      
      // Don't retry on client errors or auth errors
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('Authentication')) {
          throw error
        }
      }
      
      // Retry on network errors or server errors
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
        continue
      }
    }
  }

  throw lastError || new Error('API request failed')
}

/**
 * Orders API - Complete order management with Django
 */
export const djangoOrdersApi = {
  // List all orders with filtering and pagination
  list: (params?: {
    search?: string
    status?: string
    customer_id?: number
    date_from?: string
    date_to?: string
    page?: number
    page_size?: number
  }) =>
    djangoApiCall<{
      count: number
      next: string | null
      previous: string | null
      results: Order[]
    }>(DJANGO_ENDPOINTS.orders.list, { params }),

  // Get single order
  getById: (id: string | number) =>
    djangoApiCall<Order>(DJANGO_ENDPOINTS.orders.detail(id)),

  // Create new order
  create: (data: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>) =>
    djangoApiCall<Order>(DJANGO_ENDPOINTS.orders.create, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Update order
  update: (id: string | number, data: Partial<Order>) =>
    djangoApiCall<Order>(DJANGO_ENDPOINTS.orders.update(id), {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Partial update order
  partialUpdate: (id: string | number, data: Partial<Order>) =>
    djangoApiCall<Order>(DJANGO_ENDPOINTS.orders.partial(id), {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Update order status
  updateStatus: (
    id: string | number,
    status: Order['status'],
    notes?: string
  ) =>
    djangoApiCall<Order>(DJANGO_ENDPOINTS.orders.status(id), {
      method: 'POST',
      body: JSON.stringify({ status, notes }),
    }),

  // Delete order
  delete: (id: string | number) =>
    djangoApiCall<void>(DJANGO_ENDPOINTS.orders.delete(id), {
      method: 'DELETE',
    }),

  // Get order items
  getItems: (orderId: string | number) =>
    djangoApiCall<OrderItem[]>(DJANGO_ENDPOINTS.orders.items(orderId)),

  // Track order
  track: (orderId: string | number) =>
    djangoApiCall<{
      order_id: string | number
      current_status: string
      timeline: Array<{
        status: string
        timestamp: string
        location?: string
      }>
      estimated_delivery: string
    }>(DJANGO_ENDPOINTS.orders.track(orderId)),

  // Bulk update orders
  bulkUpdate: (data: Array<{ id: string | number; status: string }>) =>
    djangoApiCall<Array<Order>>(DJANGO_ENDPOINTS.orders.bulk_update, {
      method: 'POST',
      body: JSON.stringify({ orders: data }),
    }),

  // Get order analytics
  getAnalytics: (params?: {
    date_from?: string
    date_to?: string
    group_by?: 'day' | 'week' | 'month'
  }) =>
    djangoApiCall<{
      total_orders: number
      total_revenue: number
      average_order_value: number
      orders_by_status: Record<string, number>
      daily_orders: Array<{ date: string; count: number; revenue: number }>
    }>(DJANGO_ENDPOINTS.orders.analytics, { params }),

  // Export orders
  export: (format: 'csv' | 'pdf', params?: Record<string, any>) =>
    fetch(`${DJANGO_API_BASE}${DJANGO_ENDPOINTS.orders.list}export/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ format, filters: params }),
    }).then(r => r.blob()),
}

/**
 * Customers API
 */
export const djangoCustomersApi = {
  // List customers
  list: (params?: { search?: string; page?: number }) =>
    djangoApiCall<any>(DJANGO_ENDPOINTS.customers.list, { params }),

  // Get customer
  getById: (id: string | number) =>
    djangoApiCall<any>(DJANGO_ENDPOINTS.customers.detail(id)),

  // Get customer orders
  getOrders: (id: string | number) =>
    djangoApiCall<Order[]>(DJANGO_ENDPOINTS.customers.orders(id)),
}

/**
 * Deliveries API
 */
export const djangoDeliveriesApi = {
  // List deliveries
  list: (params?: { status?: string; page?: number }) =>
    djangoApiCall<{ count: number; results: Delivery[] }>(
      DJANGO_ENDPOINTS.deliveries.list,
      { params }
    ),

  // Get delivery
  getById: (id: string | number) =>
    djangoApiCall<Delivery>(DJANGO_ENDPOINTS.deliveries.detail(id)),

  // Update delivery status
  updateStatus: (id: string | number, status: string, notes?: string) =>
    djangoApiCall<Delivery>(DJANGO_ENDPOINTS.deliveries.update_status(id), {
      method: 'POST',
      body: JSON.stringify({ status, notes }),
    }),

  // Track delivery
  track: (id: string | number) =>
    djangoApiCall<{
      delivery_id: string | number
      status: string
      current_location?: string
      driver_location?: { lat: number; lng: number }
      estimated_arrival: string
    }>(DJANGO_ENDPOINTS.deliveries.track(id)),
}

/**
 * Health check for Django API
 */
export async function checkDjangoApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${DJANGO_API_BASE}/health/`, {
      method: 'GET',
      timeout: 5000,
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Set authentication token
 */
export function setDjangoAuthToken(token: string) {
  localStorage.setItem('django_auth_token', token)
}

/**
 * Clear authentication token
 */
export function clearDjangoAuthToken() {
  localStorage.removeItem('django_auth_token')
}

/**
 * Get authentication token
 */
export function getDjangoAuthToken(): string | null {
  return localStorage.getItem('django_auth_token')
}

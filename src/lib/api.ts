const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

let authTokenUpdater: ((token: string | null) => void) | null = null

export function registerAuthTokenUpdater(callback: (token: string | null) => void) {
  authTokenUpdater = callback
}

function setStoredAccessToken(accessToken: string) {
  localStorage.setItem('access', accessToken)
  authTokenUpdater?.(accessToken)
}

function clearStoredTokens() {
  localStorage.removeItem('access')
  localStorage.removeItem('refresh')
  authTokenUpdater?.(null)
}

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refresh')
  if (!refreshToken) {
    clearStoredTokens()
    throw new Error('Session expired. Please sign in again.')
  }

  const response = await fetch(`${API_BASE_URL}/api/auth/refresh/`, {
    method: 'POST',
    headers: new Headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ refresh: refreshToken }),
  })

  if (!response.ok) {
    clearStoredTokens()
    const errorText = await response.text()
    throw new Error(errorText || 'Session expired. Please sign in again.')
  }

  const data = (await response.json()) as { access: string; refresh?: string }
  setStoredAccessToken(data.access)
  if (data.refresh) {
    localStorage.setItem('refresh', data.refresh)
  }
  return data.access
}

async function request<T>(path: string, options: RequestInit = {}, token?: string, retry = true): Promise<T> {
  const headers = new Headers(options.headers)

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  })

  const contentType = response.headers.get('content-type') || ''
  if (response.ok) {
    if (contentType.includes('application/json')) {
      return response.json() as Promise<T>
    }
    return response.text() as unknown as Promise<T>
  }

  if (response.status === 401 && retry) {
    try {
      const newAccessToken = await refreshAccessToken()
      return request<T>(path, options, newAccessToken, false)
    } catch (refreshError) {
      throw refreshError
    }
  }

  let errorMessage = 'Request failed'
  if (contentType.includes('application/json')) {
    try {
      const errorBody = await response.json()
      if (typeof errorBody === 'string') {
        errorMessage = errorBody
      } else if (errorBody.detail) {
        errorMessage = errorBody.detail
      } else if (typeof errorBody === 'object' && errorBody !== null) {
        errorMessage = Object.values(errorBody)
          .flat()
          .filter(Boolean)
          .join(' ') || errorMessage
      }
    } catch {
      errorMessage = await response.text()
    }
  } else {
    errorMessage = await response.text()
  }

  throw new Error(errorMessage || 'Request failed')
}

export async function login(identifier: string, password: string) {
  return request<{ access: string; refresh: string; user?: any }>('/api/auth/login/', {
    method: 'POST',
    body: JSON.stringify({ email_or_phone: identifier, password }),
  })
}

export async function register(userData: { first_name: string; last_name: string; email: string; phone_number: string; password: string; role?: string }) {
  return request<any>('/api/auth/register/', {
    method: 'POST',
    body: JSON.stringify(userData),
  })
}

export async function fetchProfile(token: string) {
  return request<any>('/api/user/profile/', {}, token)
}

export async function updateProfile(token: string, profileData: { first_name?: string; last_name?: string; phone_number?: string; profile_image?: string }) {
  return request<any>('/api/user/profile/', {
    method: 'PUT',
    body: JSON.stringify(profileData),
  }, token)
}

export async function fetchDashboard(token: string) {
  return request<any>('/api/admin/dashboard/', {}, token)
}

export async function fetchProducts(token: string, search = '') {
  const query = search ? `?search=${encodeURIComponent(search)}` : ''
  return request<any>(`/api/products/${query}`, {}, token)
}

export async function fetchOrders(token: string) {
  return request<any>('/api/admin/orders/', {}, token)
}

export async function fetchDeliveries(token: string) {
  return request<any>('/api/admin/deliveries/', {}, token)
}

export async function fetchReceipts(token: string) {
  return request<any>('/api/admin/receipts/', {}, token)
}

export async function sendReceiptEmail(token: string, receiptId: string) {
  return request<any>(`/api/admin/receipts/${receiptId}/email/`, {
    method: 'POST',
  }, token)
}

export async function fetchReport(token: string, reportType: string, params?: Record<string, string>) {
  const query = params ? `?${new URLSearchParams(params).toString()}` : ''
  return request<any>(`/api/admin/reports/${reportType}/${query}`, {}, token)
}

export async function sendReportEmail(token: string, reportType: string, body: any) {
  return request<any>(`/api/admin/reports/${reportType}/`, {
    method: 'POST',
    body: JSON.stringify(body),
  }, token)
}

export async function downloadReceiptPdf(token: string, receiptId: string) {
  const response = await fetch(`${API_BASE_URL}/api/admin/receipts/${receiptId}/pdf/`, {
    method: 'GET',
    headers: new Headers({ Authorization: `Bearer ${token}` }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || 'Unable to download receipt PDF.')
  }

  return response.blob()
}

export async function getCategories() {
  return request<any>('/api/categories/', {}, undefined)
}

export async function getBrands() {
  return request<any>('/api/brands/', {}, undefined)
}

export async function createReceipt(token: string, orderId: string) {
  return request<any>(`/api/orders/${orderId}/receipt/`, {
    method: 'POST',
  }, token)
}

export async function createProduct(token: string, productData: any) {
  return request<any>('/api/products/', {
    method: 'POST',
    body: JSON.stringify(productData),
  }, token)
}

export async function updateProduct(token: string, productId: string, productData: any) {
  return request<any>(`/api/products/${productId}/`, {
    method: 'PUT',
    body: JSON.stringify(productData),
  }, token)
}

export async function deleteProduct(token: string, productId: string) {
  return request<any>(`/api/products/${productId}/`, {
    method: 'DELETE',
  }, token)
}

export async function getOrderDetails(token: string, orderId: string) {
  return request<any>(`/api/admin/orders/${orderId}/`, {}, token)
}

export async function updateOrderStatus(token: string, orderId: string, status: string) {
  return request<any>(`/api/admin/orders/${orderId}/status/`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }, token)
}

export async function updateDelivery(token: string, deliveryId: string, deliveryStatus: string) {
  return request<any>(`/api/admin/deliveries/${deliveryId}/`, {
    method: 'PATCH',
    body: JSON.stringify({ delivery_status: deliveryStatus }),
  }, token)
}

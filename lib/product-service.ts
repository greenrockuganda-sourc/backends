/**
 * Product Service with Cloudinary Integration
 * Handles product CRUD operations with image uploads to Cloudinary
 */

import { cloudinaryService, CloudinaryUploadResponse } from './cloudinary-service'

const DJANGO_API_BASE = `${(import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000').replace(/\/+$/, '')}/api`
const API_VERSION = 'v1'

export interface Product {
  id: string
  name: string
  description: string
  price: number
  cost: number
  quantity: number
  image_url: string // Cloudinary URL stored in Django
  category: string
  sku: string
  status: 'active' | 'inactive' | 'discontinued'
  created_at: string
  updated_at: string
}

export interface ProductFormData {
  name: string
  description: string
  price: number
  cost: number
  quantity: number
  category: string
  sku: string
  status: 'active' | 'inactive' | 'discontinued'
}

/**
 * Get auth token from localStorage
 */
function getAuthToken(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('auth_token') || ''
}

/**
 * Build API URL with query parameters
 */
function buildUrl(endpoint: string, params?: Record<string, string | number | boolean>): string {
  const url = new URL(`${DJANGO_API_BASE}${endpoint}`)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value))
    })
  }
  return url.toString()
}

/**
 * Make authenticated request to Django API
 */
async function djangoApiCall<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  endpoint: string,
  data?: any,
  params?: Record<string, string | number | boolean>
): Promise<T> {
  const token = getAuthToken()
  const url = buildUrl(endpoint, params)

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
    })

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('auth_token')
        throw new Error('Unauthorized - please login again')
      }
      throw new Error(`API Error: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error(`[ProductService] ${method} ${endpoint}:`, error)
    throw error
  }
}

export const productService = {
  /**
   * Upload product image to Cloudinary and return URL
   */
  async uploadProductImage(file: File): Promise<string> {
    try {
      const validation = cloudinaryService.validateImage(file)
      if (!validation.valid) {
        throw new Error(validation.error)
      }

      console.log('[ProductService] Uploading image to Cloudinary...')
      const uploadResponse = await cloudinaryService.uploadImage(file, 'seller-admin/products')
      const imageUrl = cloudinaryService.getSecureUrl(uploadResponse)

      console.log('[ProductService] Image uploaded successfully:', imageUrl)
      return imageUrl
    } catch (error) {
      console.error('[ProductService] Image upload failed:', error)
      throw error
    }
  },

  /**
   * Upload multiple product images
   */
  async uploadProductImages(files: File[]): Promise<string[]> {
    try {
      const uploadResponses = await cloudinaryService.uploadMultiple(
        files,
        'seller-admin/products'
      )
      return uploadResponses.map(response => cloudinaryService.getSecureUrl(response))
    } catch (error) {
      console.error('[ProductService] Bulk image upload failed:', error)
      throw error
    }
  },

  /**
   * Create product with image upload
   */
  async createProduct(formData: ProductFormData, imageFile?: File): Promise<Product> {
    try {
      let imageUrl = ''

      // Upload image to Cloudinary if provided
      if (imageFile) {
        imageUrl = await this.uploadProductImage(imageFile)
      }

      // Create product with Cloudinary image URL
      const productData = {
        ...formData,
        image_url: imageUrl,
      }

      console.log('[ProductService] Creating product with image:', imageUrl)
      const response = await djangoApiCall<Product>(
        'POST',
        '/products/',
        productData
      )

      console.log('[ProductService] Product created:', response.id)
      return response
    } catch (error) {
      console.error('[ProductService] Product creation failed:', error)
      throw error
    }
  },

  /**
   * List all products
   */
  async listProducts(params?: {
    search?: string
    category?: string
    status?: string
    page?: number
    page_size?: number
  }): Promise<{ results: Product[]; count: number; next?: string; previous?: string }> {
    try {
      console.log('[ProductService] Fetching products...')
      return await djangoApiCall(
        'GET',
        '/products/',
        undefined,
        params as Record<string, string | number | boolean>
      )
    } catch (error) {
      console.error('[ProductService] Failed to fetch products:', error)
      throw error
    }
  },

  /**
   * Get single product
   */
  async getProduct(id: string | number): Promise<Product> {
    try {
      return await djangoApiCall('GET', `/products/${id}/`)
    } catch (error) {
      console.error('[ProductService] Failed to fetch product:', error)
      throw error
    }
  },

  /**
   * Update product (with optional image replacement)
   */
  async updateProduct(
    id: string | number,
    formData: Partial<ProductFormData>,
    imageFile?: File
  ): Promise<Product> {
    try {
      let imageUrl: string | undefined

      // Upload new image if provided
      if (imageFile) {
        imageUrl = await this.uploadProductImage(imageFile)
      }

      // Update product
      const updateData = {
        ...formData,
        ...(imageUrl && { image_url: imageUrl }),
      }

      console.log('[ProductService] Updating product:', id)
      return await djangoApiCall(
        'PATCH',
        `/products/${id}/`,
        updateData
      )
    } catch (error) {
      console.error('[ProductService] Product update failed:', error)
      throw error
    }
  },

  /**
   * Delete product
   */
  async deleteProduct(id: string | number): Promise<void> {
    try {
      console.log('[ProductService] Deleting product:', id)
      await djangoApiCall('DELETE', `/products/${id}/`)
    } catch (error) {
      console.error('[ProductService] Product deletion failed:', error)
      throw error
    }
  },

  /**
   * Get product analytics
   */
  async getProductAnalytics(): Promise<any> {
    try {
      return await djangoApiCall('GET', '/products/analytics/')
    } catch (error) {
      console.error('[ProductService] Failed to fetch analytics:', error)
      throw error
    }
  },

  /**
   * Search products
   */
  async searchProducts(query: string): Promise<Product[]> {
    try {
      const response = await djangoApiCall<{ results: Product[] }>(
        'GET',
        '/products/',
        undefined,
        { search: query }
      )
      return response.results
    } catch (error) {
      console.error('[ProductService] Product search failed:', error)
      throw error
    }
  },

  /**
   * Get image URL with optimizations
   */
  getOptimizedImageUrl(publicId: string, width?: number, height?: number): string {
    return cloudinaryService.getOptimizedUrl(publicId, width, height)
  },
}

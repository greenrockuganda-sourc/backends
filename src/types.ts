export interface UserProfile {
  id: string
  first_name: string
  last_name: string
  email: string
  phone_number?: string
  role: string
  profile_image?: string
}

export interface Product {
  id: string
  name: string
  sku: string
  price: number
  stock: number
  category: string
  description?: string
  costPrice?: number
  profit?: number
  reorderLevel?: number
  imageUrls?: string[]
  status?: string
}

export interface Category {
  id: string
  category_name: string
}

export interface Brand {
  id: string
  brand_name: string
}

export interface Order {
  id: string
  customer: string
  amount: number
  status: string
  date: string
  items?: Array<{
    product_name: string
    quantity: number
    unit_price?: number
    subtotal?: number
  }>
}

export interface Delivery {
  id: string
  orderId: string
  driver: string
  address: string
  status: string
  receiptIssued: boolean
}

export interface Receipt {
  id: string
  receiptNumber: string
  orderNumber: string
  customer: string
  amount: number
  date: string
  items?: Array<{
    product_name: string
    quantity: number
    unit_price: number
    subtotal: number
  }>
}

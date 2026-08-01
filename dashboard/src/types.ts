export interface User {
  id: number
  first_name: string
  last_name: string
  email: string
  role: string
}

export interface DashboardSummary {
  total_products: number
  total_categories: number
  total_brands: number
  total_customers: number
  total_orders: number
  orders_today: number
  pending_orders: number
  processing_orders: number
  out_for_delivery: number
  delivered_orders: number
  cancelled_orders: number
  low_stock_products: number
  out_of_stock_products: number
  revenue_today: number
  revenue_this_week: number
  revenue_this_month: number
}

export interface Product {
  id: number
  product_name: string
  sku?: string
  selling_price: number
  quantity_in_stock: number
  status: string
  category: { category_name: string }
  brand: { brand_name: string }
  image_url?: string
}

export interface Category {
  id: number
  category_name: string
  description?: string
  image_url?: string
}

export interface Brand {
  id: number
  brand_name: string
  description?: string
  country?: string
  logo?: string
}

export interface Customer {
  id: number
  customer_name: string
  salon_name: string
  email: string
  phone: string
  address: string
  number_of_orders: number
  total_purchases: number
  is_active: boolean
}

export interface Order {
  id: number
  customer: string
  order_number: string
  total_amount: number
  payment_status: string
  order_status: string
  items: Array<{ product_name: string; quantity: number }>
}

export interface Payment {
  id: number
  customer: string
  order_number: string
  amount: number
  payment_method: string
  payment_status: string
  payment_date: string | null
}

export interface Delivery {
  id: number
  order_number: string
  customer: string
  delivery_address: string
  delivery_status: string
  delivery_date: string | null
}

export interface Receipt {
  id: number
  receipt_number: string
  customer: string
  order_number: string
  amount: number
  date: string
}

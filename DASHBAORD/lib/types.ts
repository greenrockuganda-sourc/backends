export interface Product {
  id: string
  name: string
  sku: string
  price: number
  quantity: number
  category: string
  description?: string
  image?: string
  createdAt: string
  updatedAt: string
}

export interface OrderItem {
  id: string
  productId: string
  productName: string
  quantity: number
  price: number
  total: number
}

export interface Order {
  id: string
  orderNumber: string
  customerId: string
  customerName: string
  customerEmail: string
  customerPhone: string
  items: OrderItem[]
  subtotal: number
  tax: number
  shipping: number
  total: number
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
  paymentStatus: 'pending' | 'paid' | 'failed'
  shippingAddress: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface Delivery {
  id: string
  orderId: string
  orderNumber: string
  status: 'pending' | 'in-transit' | 'delivered' | 'failed'
  deliveryPersonName: string
  deliveryPersonPhone: string
  location: string
  estimatedDeliveryTime: string
  actualDeliveryTime?: string
  notes?: string
  receiptIssued: boolean
  createdAt: string
  updatedAt: string
}

export interface Receipt {
  id: string
  receiptNumber: string
  orderId: string
  deliveryId?: string
  customerId: string
  customerName: string
  customerEmail: string
  customerPhone: string
  items: OrderItem[]
  subtotal: number
  tax: number
  shipping: number
  total: number
  paymentMethod: string
  issuedAt: string
  issuedBy?: string
}

export interface DashboardStats {
  totalOrders: number
  totalRevenue: number
  pendingDeliveries: number
  completedDeliveries: number
  inventoryValue: number
  lowStockItems: number
}

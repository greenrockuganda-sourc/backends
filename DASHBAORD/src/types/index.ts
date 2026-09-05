export interface Product {
  id: string
  name: string
  sku: string
  price: number
  stock: number
  category: string
}

export interface Order {
  id: string
  customer: string
  amount: number
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
  date: string
  items?: OrderItem[]
  paymentStatus?: 'paid' | 'pending'
}

export interface OrderItem {
  productId: string
  name: string
  quantity: number
  price: number
}

export interface Delivery {
  id: string
  orderId: string
  driver: string
  address: string
  status: 'pending' | 'in-transit' | 'delivered'
  receiptIssued: boolean
}

export interface Receipt {
  id: string
  orderId: string
  customer: string
  amount: number
  items: ReceiptItem[]
  date: string
  issued: boolean
}

export interface ReceiptItem {
  name: string
  quantity: number
  price: number
}

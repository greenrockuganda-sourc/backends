'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Order } from '@/lib/types'
import { ordersApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { OrderManagement } from '@/components/orders/order-management'

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      const data = await ordersApi.getAll()
      setOrders(data)
    } catch (err) {
      console.error('Failed to fetch orders:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-6">
          <div>
            <h1 className="text-4xl font-bold text-foreground tracking-tight">Orders</h1>
            <p className="text-muted-foreground mt-2">
              Manage customer orders with advanced filtering and bulk actions
            </p>
          </div>
          <Button className="gap-2 bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            New Order
          </Button>
        </div>

        {!loading && (
          <OrderManagement
            initialOrders={orders}
            onOrdersChange={setOrders}
          />
        )}
      </div>
    </DashboardLayout>
  )
}

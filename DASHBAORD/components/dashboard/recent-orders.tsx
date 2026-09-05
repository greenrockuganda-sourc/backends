'use client'

import { useEffect, useState } from 'react'
import { Order } from '@/lib/types'
import { ordersApi } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

const statusConfig = {
  pending: { bg: 'bg-warning/10', text: 'text-warning', label: 'Pending' },
  confirmed: { bg: 'bg-blue-500/10', text: 'text-blue-600', label: 'Confirmed' },
  shipped: { bg: 'bg-purple-500/10', text: 'text-purple-600', label: 'Shipped' },
  delivered: { bg: 'bg-success/10', text: 'text-success', label: 'Delivered' },
  cancelled: { bg: 'bg-destructive/10', text: 'text-destructive', label: 'Cancelled' },
}

export function RecentOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true)
        const data = await ordersApi.getAll()
        setOrders(data.slice(0, 5))
      } catch (err) {
        console.error('Failed to fetch orders:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchOrders()
  }, [])

  return (
    <div className="dashboard-card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Recent Orders</h2>
          <p className="text-sm text-muted-foreground mt-1">Latest transactions</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2 hover:bg-primary hover:text-primary-foreground transition-colors">
          View All
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No orders found</p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const statusInfo = statusConfig[order.status as keyof typeof statusConfig]
            return (
              <div
                key={order.id}
                className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary/30 hover:bg-card/50 transition-all duration-200 group cursor-pointer"
              >
                <div className="flex-1">
                  <p className="font-semibold text-foreground group-hover:text-primary transition-colors">{order.customerName}</p>
                  <p className="text-xs text-muted-foreground">{order.orderNumber}</p>
                </div>
                <div className="text-right space-y-1">
                  <p className="font-semibold text-lg text-foreground">${order.total.toFixed(2)}</p>
                  <Badge
                    variant="secondary"
                    className={`${statusInfo.bg} ${statusInfo.text} text-xs`}
                  >
                    {statusInfo.label}
                  </Badge>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

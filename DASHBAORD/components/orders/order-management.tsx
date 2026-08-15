'use client'

import { useState, useEffect } from 'react'
import { Order } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Search,
  Filter,
  Download,
  Eye,
  CheckCircle,
  Clock,
  Truck,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { OrderDetail } from './order-detail'
import { OrderFilters } from './order-filters'
import { OrderBulkActions } from './order-bulk-actions'

interface OrderManagementProps {
  initialOrders?: Order[]
  onOrdersChange?: (orders: Order[]) => void
}

const statusConfig = {
  pending: {
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-600',
    icon: Clock,
    label: 'Pending',
  },
  confirmed: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-600',
    icon: CheckCircle,
    label: 'Confirmed',
  },
  shipped: {
    bg: 'bg-purple-500/10',
    text: 'text-purple-600',
    icon: Truck,
    label: 'Shipped',
  },
  delivered: {
    bg: 'bg-green-500/10',
    text: 'text-green-600',
    icon: CheckCircle,
    label: 'Delivered',
  },
  cancelled: {
    bg: 'bg-destructive/10',
    text: 'text-destructive',
    icon: AlertCircle,
    label: 'Cancelled',
  },
}

type SortField = 'date' | 'total' | 'customer' | 'status'
type SortOrder = 'asc' | 'desc'

export function OrderManagement({
  initialOrders = [],
  onOrdersChange,
}: OrderManagementProps) {
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [filteredOrders, setFilteredOrders] = useState<Order[]>(initialOrders)
  const [loading, setLoading] = useState(false)
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  const [filters, setFilters] = useState({
    status: '',
    paymentStatus: '',
    dateFrom: '',
    dateTo: '',
  })

  // Apply filters and search
  useEffect(() => {
    let result = [...orders]

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(
        (order) =>
          order.orderNumber.toLowerCase().includes(term) ||
          order.customerName.toLowerCase().includes(term) ||
          order.customerEmail.toLowerCase().includes(term)
      )
    }

    // Status filter
    if (filters.status) {
      result = result.filter((order) => order.status === filters.status)
    }

    // Payment status filter
    if (filters.paymentStatus) {
      result = result.filter((order) => order.paymentStatus === filters.paymentStatus)
    }

    // Date range filter
    if (filters.dateFrom) {
      result = result.filter(
        (order) => new Date(order.createdAt) >= new Date(filters.dateFrom)
      )
    }
    if (filters.dateTo) {
      result = result.filter(
        (order) => new Date(order.createdAt) <= new Date(filters.dateTo)
      )
    }

    // Sorting
    result.sort((a, b) => {
      let aVal: any
      let bVal: any

      switch (sortField) {
        case 'date':
          aVal = new Date(a.createdAt).getTime()
          bVal = new Date(b.createdAt).getTime()
          break
        case 'total':
          aVal = a.total
          bVal = b.total
          break
        case 'customer':
          aVal = a.customerName
          bVal = b.customerName
          break
        case 'status':
          aVal = a.status
          bVal = b.status
          break
        default:
          aVal = new Date(a.createdAt).getTime()
          bVal = new Date(b.createdAt).getTime()
      }

      if (typeof aVal === 'string') {
        return sortOrder === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      }

      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
    })

    setFilteredOrders(result)
  }, [orders, searchTerm, filters, sortField, sortOrder])

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(filteredOrders.map((o) => o.id))
    } else {
      setSelectedOrders([])
    }
  }

  const handleSelectOrder = (orderId: string) => {
    setSelectedOrders((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    )
  }

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDown className="h-4 w-4 opacity-30" />
    return sortOrder === 'asc' ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Search */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 bg-card rounded-lg border border-border px-4 py-3">
          <Search className="h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search orders by number, customer, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
          </Button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <OrderFilters filters={filters} onFiltersChange={setFilters} />
        )}

        {/* Bulk Actions */}
        {selectedOrders.length > 0 && (
          <OrderBulkActions
            selectedCount={selectedOrders.length}
            onClearSelection={() => setSelectedOrders([])}
            selectedOrderIds={selectedOrders}
          />
        )}
      </div>

      {/* Orders Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground mb-2">No orders found</p>
            <p className="text-sm text-muted-foreground">
              {searchTerm || Object.values(filters).some(v => v) 
                ? 'Try adjusting your search or filters'
                : 'Create your first order to get started'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={
                        selectedOrders.length === filteredOrders.length &&
                        filteredOrders.length > 0
                      }
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    <button
                      onClick={() => toggleSort('date')}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      Date
                      <SortIcon field="date" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">Order #</th>
                  <th className="px-4 py-3 text-left font-semibold">
                    <button
                      onClick={() => toggleSort('customer')}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      Customer
                      <SortIcon field="customer" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right font-semibold">
                    <button
                      onClick={() => toggleSort('total')}
                      className="flex items-center justify-end gap-1 hover:text-foreground transition-colors"
                    >
                      Total
                      <SortIcon field="total" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-center font-semibold">Status</th>
                  <th className="px-4 py-3 text-center font-semibold">Payment</th>
                  <th className="px-4 py-3 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredOrders.map((order) => {
                  const statusInfo = statusConfig[order.status as keyof typeof statusConfig]
                  const StatusIcon = statusInfo.icon

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedOrders.includes(order.id)}
                          onChange={() => handleSelectOrder(order.id)}
                          className="w-4 h-4 rounded"
                        />
                      </td>
                      <td className="px-4 py-4 text-sm text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4 font-mono font-semibold">
                        {order.orderNumber}
                      </td>
                      <td className="px-4 py-4">
                        <div>
                          <p className="font-medium text-foreground">
                            {order.customerName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {order.customerEmail}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right font-semibold">
                        ${order.total.toFixed(2)}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <Badge className={`${statusInfo.bg} ${statusInfo.text} flex items-center justify-center gap-1 w-fit mx-auto`}>
                          <StatusIcon className="h-3 w-3" />
                          {statusInfo.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <Badge
                          variant={
                            order.paymentStatus === 'paid'
                              ? 'default'
                              : order.paymentStatus === 'pending'
                              ? 'outline'
                              : 'destructive'
                          }
                        >
                          {order.paymentStatus}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedOrder(order)}
                          className="gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer with stats */}
        {filteredOrders.length > 0 && (
          <div className="border-t border-border bg-muted/20 px-6 py-4 flex items-center justify-between text-sm">
            <div className="text-muted-foreground">
              Showing {filteredOrders.length} of {orders.length} orders
            </div>
            <div className="text-foreground font-semibold">
              Total: ${filteredOrders.reduce((sum, o) => sum + o.total, 0).toFixed(2)}
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedOrder && (
        <OrderDetail
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  )
}

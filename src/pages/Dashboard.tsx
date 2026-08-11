import { useEffect, useMemo, useState } from 'react'
import { DollarSign, ShoppingCart, Truck, AlertCircle } from 'lucide-react'
import StatCard from '@/components/StatCard'
import RecentOrders from '@/components/RecentOrders'
import InventoryStatus from '@/components/InventoryStatus'
import { fetchDashboard, fetchProducts, fetchOrders, fetchDeliveries } from '@/lib/api'
import { Order, Product } from '@/types'
import Skeleton, { SkeletonStats, SkeletonTable } from '@/components/Skeleton'

const validRanges = ['7d', '30d', '90d', 'all'] as const

type RangeKey = (typeof validRanges)[number]

const getRangeStartDate = (range: RangeKey) => {
  if (range === 'all') return null
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000)
}

const readDashboardRangeFromUrl = (): RangeKey => {
  if (typeof window === 'undefined') return '7d'
  const params = new URLSearchParams(window.location.search)
  const value = params.get('dashboardRange')
  return validRanges.includes(value as RangeKey) ? (value as RangeKey) : '7d'
}

interface DashboardProps {
  token: string
  user?: any
}

export default function Dashboard({ token, user }: DashboardProps) {
  const [stats, setStats] = useState({
    revenue: 0,
    orders: 0,
    pending: 0,
    lowStock: 0,
  })
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [inventory, setInventory] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<RangeKey>(readDashboardRangeFromUrl)
  const [isMobileView, setIsMobileView] = useState(false)

  const dateRangeLabel = useMemo(() => {
    switch (range) {
      case '7d': return 'Last 7 days'
      case '30d': return 'Last 30 days'
      case '90d': return 'Last 90 days'
      default: return 'All time'
    }
  }, [range])

  useEffect(() => {
    let active = true

    const loadDashboard = async () => {
      try {
        setLoading(true)
        setError(null)

        const [dashboardData, productsData, ordersData, deliveriesData] = await Promise.all([
          fetchDashboard(token),
          fetchProducts(token),
          fetchOrders(token),
          fetchDeliveries(token),
        ])
        if (!active) {
          return
        }

        const summary = dashboardData?.summary ?? {}
        const productList = Array.isArray(productsData?.results)
          ? productsData.results
          : Array.isArray(productsData)
            ? productsData
            : []
        const orderList = Array.isArray(ordersData?.results)
          ? ordersData.results
          : Array.isArray(ordersData)
            ? ordersData
            : []
        const deliveryList = Array.isArray(deliveriesData?.results)
          ? deliveriesData.results
          : Array.isArray(deliveriesData)
            ? deliveriesData
            : []

        const rangeStart = getRangeStartDate(range)
        const filteredOrdersForRange = orderList.filter((order: any) => {
          if (!rangeStart) return true
          const dateValue = order.created_at ?? order.date ?? order.order_date ?? ''
          const orderDate = new Date(dateValue)
          return !Number.isNaN(orderDate.getTime()) && orderDate >= rangeStart
        })
        const revenueFromOrders = filteredOrdersForRange.reduce((sum: number, order: any) => sum + Number(order.total_amount ?? order.amount ?? 0), 0)
        const lowStockFromProducts = productList.filter((product: any) => {
          const stock = Number(product.stock ?? product.quantity_in_stock ?? 0)
          const reorderLevel = Number(product.reorder_level ?? product.reorderLevel ?? 0)
          return stock <= reorderLevel || stock <= 0
        }).length
        const pendingDeliveriesFromData = deliveryList.filter((delivery: any) => {
          const status = String(delivery.delivery_status ?? delivery.status ?? '').toLowerCase()
          return status === 'preparing' || status === 'pending' || status === 'in progress'
        }).length
        const pendingOrdersFromData = filteredOrdersForRange.filter((order: any) => String(order.order_status ?? order.status ?? '').toLowerCase() === 'pending').length

        const revenue = summary.revenue_today != null
          ? Number(summary.revenue_today)
          : (summary.revenue_this_week != null
            ? Number(summary.revenue_this_week)
            : (summary.revenue_this_month != null
              ? Number(summary.revenue_this_month)
              : revenueFromOrders))
        const pending = summary.pending_deliveries != null
          ? Number(summary.pending_deliveries)
          : (summary.pending_orders != null
            ? Number(summary.pending_orders)
            : pendingDeliveriesFromData || pendingOrdersFromData)
        const lowStock = summary.low_stock_products != null
          ? Number(summary.low_stock_products)
          : lowStockFromProducts

        setStats({
          revenue,
          orders: Number(summary.total_orders ?? orderList.length ?? 0),
          pending,
          lowStock,
        })

        const recentOrdersRaw = dashboardData?.recent_activity?.recent_orders
        const normalizedOrders = (Array.isArray(recentOrdersRaw) ? recentOrdersRaw : []).map((order: any) => ({
          id: order.order_number ?? order.id ?? 'N/A',
          customer: order.customer ?? 'Guest',
          amount: Number(order.total_amount ?? order.amount ?? 0),
          status: (order.order_status ?? order.status ?? 'pending').toLowerCase(),
          date: order.created_at?.slice(0, 10) ?? order.date ?? '',
        }))
        const filteredRecentOrders = rangeStart
          ? normalizedOrders.filter((order: any) => {
              const dateValue = order.date
              const orderDate = new Date(dateValue)
              return !Number.isNaN(orderDate.getTime()) && orderDate >= rangeStart
            })
          : normalizedOrders
        setRecentOrders(filteredRecentOrders)

        const normalizedProducts = productList.map((product: any) => {
          const categoryString = product.category?.category_name ?? product.category?.name ?? (typeof product.category === 'string' ? product.category : '')
          return {
            id: String(product.id ?? product.product_id ?? product.sku ?? ''),
            name: product.name ?? product.product_name ?? 'Unnamed product',
            sku: product.sku ?? product.barcode ?? '',
            price: Number(product.price ?? product.selling_price ?? 0),
            stock: Number(product.stock ?? product.quantity_in_stock ?? 0),
            category: categoryString || 'Uncategorized',
            reorderLevel: Number(product.reorder_level ?? product.reorderLevel ?? 0),
          }
        })
        setInventory(normalizedProducts)
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load dashboard data.')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadDashboard()

    const refreshTimer = window.setInterval(() => {
      void loadDashboard()
    }, 15000)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadDashboard()
      }
    }

    window.addEventListener('focus', handleVisibilityChange)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      active = false
      window.clearInterval(refreshTimer)
      window.removeEventListener('focus', handleVisibilityChange)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [token, range])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    params.set('dashboardRange', range)
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`)
  }, [range])

  useEffect(() => {
    const updateIsMobileView = () => {
      setIsMobileView(window.innerWidth < 1024)
    }

    updateIsMobileView()
    window.addEventListener('resize', updateIsMobileView)

    return () => {
      window.removeEventListener('resize', updateIsMobileView)
    }
  }, [])

  const firstName = user?.first_name || user?.email?.split('@')[0] || 'there'

  return (
    <div className="w-full p-3 sm:p-6 lg:p-8">
      <div className="mb-6 sm:mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">Welcome back, {firstName}!</h2>
          <p className="mt-1 text-sm text-gray-500 sm:text-base">Here is what is happening with your store right now.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Date range</label>
          <select
            value={range}
            onChange={(event) => setRange(event.target.value as '7d' | '30d' | '90d' | 'all')}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-auto"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        Showing dashboard metrics for <strong>{dateRangeLabel}</strong>. Use this filter to check performance across different periods.
      </div>

      <div className="mb-8 grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Orders in range</p>
          <p className="mt-2 text-2xl sm:text-3xl font-semibold text-gray-900">{recentOrders.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Range revenue</p>
          <p className="mt-2 text-2xl sm:text-3xl font-semibold text-gray-900">UGX {recentOrders.reduce((sum, order) => sum + order.amount, 0).toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Average order</p>
          <p className="mt-2 text-2xl sm:text-3xl font-semibold text-gray-900">UGX {recentOrders.length ? (recentOrders.reduce((sum, order) => sum + order.amount, 0) / recentOrders.length).toFixed(2) : '0.00'}</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {error}
        </div>
      )}

      {loading ? (
        <>
          <div className="mb-8">
            <SkeletonStats />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                <Skeleton height={20} width="40%" className="mb-4" />
                <SkeletonTable rows={5} columns={4} />
              </div>
            </div>
            <div className="xl:col-span-1">
              <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                <Skeleton height={20} width="60%" className="mb-4" />
                <SkeletonTable rows={5} columns={2} />
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
            <StatCard
              title="Total Revenue"
              value={`UGX ${stats.revenue.toFixed(2)}`}
              icon={<DollarSign size={24} />}
              change="Live from the API"
              trend="up"
              color="blue"
            />
              <StatCard
                title="Total Orders"
                value={stats.orders.toString()}
                icon={<ShoppingCart size={24} />}
                change="Updated now"
                trend="up"
                color="blue"
              />
              <StatCard
                title="Pending Deliveries"
                value={stats.pending.toString()}
                icon={<Truck size={24} />}
                change="In progress"
                trend="down"
                color="blue"
              />
              <StatCard
                title="Low Stock Items"
                value={stats.lowStock.toString()}
                icon={<AlertCircle size={24} />}
                change="Needs attention"
                color="blue"
              />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <RecentOrders orders={recentOrders} loading={loading} />
            </div>

            {isMobileView && (
              <div className="xl:col-span-1">
                <InventoryStatus inventory={inventory} loading={loading} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
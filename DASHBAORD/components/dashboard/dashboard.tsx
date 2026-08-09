'use client'

import { useEffect, useState } from 'react'
import { DashboardStats } from '@/lib/types'
import { dashboardApi } from '@/lib/api'
import { StatCard } from './stat-card'
import { RecentOrders } from './recent-orders'
import { InventoryStatus } from './inventory-status'
import { Activity, TrendingUp, Package, Truck } from 'lucide-react'

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true)
        const data = await dashboardApi.getStats()
        setStats(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load stats')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (error) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-6">
        <p className="text-destructive font-medium">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="border-b border-border pb-6">
        <h1 className="text-4xl font-bold text-foreground tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2 text-base">
          Welcome back! Here&apos;s your sales and inventory overview.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={TrendingUp}
          label="Total Revenue"
          value={stats ? `$${stats.totalRevenue.toLocaleString()}` : '$0'}
          subtext={`${stats?.totalOrders || 0} orders`}
          loading={loading}
        />
        <StatCard
          icon={Activity}
          label="Total Orders"
          value={stats?.totalOrders || 0}
          subtext="This month"
          loading={loading}
        />
        <StatCard
          icon={Truck}
          label="Pending Deliveries"
          value={stats?.pendingDeliveries || 0}
          subtext={`${stats?.completedDeliveries || 0} completed`}
          loading={loading}
        />
        <StatCard
          icon={Package}
          label="Low Stock Items"
          value={stats?.lowStockItems || 0}
          subtext={`$${stats?.inventoryValue.toLocaleString() || 0} value`}
          loading={loading}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <RecentOrders />
        </div>
        <div className="lg:hidden">
          <InventoryStatus />
        </div>
      </div>
    </div>
  )
}

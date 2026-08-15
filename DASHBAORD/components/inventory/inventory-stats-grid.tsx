import { Package, AlertTriangle, TrendingUp, Eye } from 'lucide-react'

interface InventoryStatsGridProps {
  totalProducts: number
  totalValue: number
  lowStockItems: number
  outOfStockItems: number
}

export function InventoryStatsGrid({
  totalProducts,
  totalValue,
  lowStockItems,
  outOfStockItems,
}: InventoryStatsGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Total Products */}
      <div className="stat-card group">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Total Products
            </p>
            <p className="text-3xl font-bold text-foreground mt-3 tracking-tight">
              {totalProducts}
            </p>
            <p className="text-xs text-muted-foreground mt-2.5">Active SKUs</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 p-4 group-hover:from-blue-500/30 group-hover:to-blue-500/10 transition-all duration-200">
            <Package className="h-6 w-6 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Total Value */}
      <div className="stat-card group">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Inventory Value
            </p>
            <p className="text-3xl font-bold text-foreground mt-3 tracking-tight">
              ${totalValue.toFixed(0)}
            </p>
            <p className="text-xs text-muted-foreground mt-2.5">Total asset value</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5 p-4 group-hover:from-green-500/30 group-hover:to-green-500/10 transition-all duration-200">
            <TrendingUp className="h-6 w-6 text-green-600" />
          </div>
        </div>
      </div>

      {/* Low Stock */}
      <div className="stat-card group">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Low Stock Items
            </p>
            <p className="text-3xl font-bold text-yellow-600 mt-3 tracking-tight">
              {lowStockItems}
            </p>
            <p className="text-xs text-muted-foreground mt-2.5">Needs reorder soon</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-yellow-500/20 to-yellow-500/5 p-4 group-hover:from-yellow-500/30 group-hover:to-yellow-500/10 transition-all duration-200">
            <AlertTriangle className="h-6 w-6 text-yellow-600" />
          </div>
        </div>
      </div>

      {/* Out of Stock */}
      <div className="stat-card group">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Out of Stock
            </p>
            <p className="text-3xl font-bold text-destructive mt-3 tracking-tight">
              {outOfStockItems}
            </p>
            <p className="text-xs text-muted-foreground mt-2.5">Urgent action needed</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-destructive/20 to-destructive/5 p-4 group-hover:from-destructive/30 group-hover:to-destructive/10 transition-all duration-200">
            <Eye className="h-6 w-6 text-destructive" />
          </div>
        </div>
      </div>
    </div>
  )
}

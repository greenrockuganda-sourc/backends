import { AlertCircle } from 'lucide-react'
import { Product } from '@/types'

interface InventoryStatusProps {
  inventory: Product[]
  loading?: boolean
}

export default function InventoryStatus({ inventory, loading }: InventoryStatusProps) {
  const lowStockItems = inventory.filter(p => p.stock < 10)

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Low Stock Items</h3>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-gray-100 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <AlertCircle size={20} className="text-blue-600" />
          <h3 className="text-lg font-bold text-gray-900">Low Stock Items</h3>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {lowStockItems.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">All items are well stocked</p>
        ) : (
          lowStockItems.map(item => (
            <div key={item.id} className="flex flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{item.name}</p>
                <p className="text-xs text-gray-500">{item.sku}</p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-lg font-bold text-blue-600">{item.stock}</p>
                <p className="text-xs text-gray-500">units</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

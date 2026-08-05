'use client'

import { useEffect, useState } from 'react'
import { Product } from '@/lib/types'
import { productsApi } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle } from 'lucide-react'

export function InventoryStatus() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true)
        const data = await productsApi.getAll()
        setProducts(data.filter(p => p.quantity < 20).slice(0, 5))
      } catch (err) {
        console.error('Failed to fetch products:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [])

  return (
    <div className="dashboard-card">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground">Low Stock Items</h2>
        <p className="text-sm text-muted-foreground mt-1">Items needing reorder</p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-xl bg-green-500/10 p-4 mb-4">
            <AlertCircle className="h-6 w-6 text-green-600" />
          </div>
          <p className="text-sm font-medium text-foreground">All items in stock</p>
          <p className="text-xs text-muted-foreground mt-1">No low inventory alerts</p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((product) => (
            <div
              key={product.id}
              className="p-4 rounded-lg border border-orange-500/20 bg-orange-500/5 hover:border-orange-500/40 transition-all duration-200 group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-foreground group-hover:text-orange-600 transition-colors">{product.name}</p>
                <span className="text-xs font-bold text-orange-600 bg-orange-500/10 px-2.5 py-1 rounded-full">
                  {product.quantity} units
                </span>
              </div>
              <div className="w-full bg-border rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-orange-500 to-orange-400 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min((product.quantity / 100) * 100, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Product } from '@/lib/types'
import { productsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit, Trash2, AlertTriangle, TrendingDown, TrendingUp, Package } from 'lucide-react'
import { InventoryForm } from '@/components/inventory/inventory-form'
import { InventoryStatsGrid } from '@/components/inventory/inventory-stats-grid'
import { InventoryAlerts } from '@/components/inventory/inventory-alerts'

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'value'>('name')
  const [filterLowStock, setFilterLowStock] = useState(false)

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const data = await productsApi.getAll()
      setProducts(data)
    } catch (err) {
      console.error('Failed to fetch products:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return
    try {
      await productsApi.delete(id)
      setProducts(products.filter(p => p.id !== id))
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  const sortedProducts = [...products].sort((a, b) => {
    switch (sortBy) {
      case 'stock':
        return a.quantity - b.quantity
      case 'value':
        return (b.price * b.quantity) - (a.price * a.quantity)
      default:
        return a.name.localeCompare(b.name)
    }
  })

  const filteredProducts = filterLowStock 
    ? sortedProducts.filter(p => p.quantity < 20)
    : sortedProducts

  const lowStockItems = products.filter(p => p.quantity < 20).length
  const totalInventoryValue = products.reduce((sum, p) => sum + (p.price * p.quantity), 0)
  const outOfStockItems = products.filter(p => p.quantity === 0).length

  const getStockStatus = (quantity: number) => {
    if (quantity === 0) return { label: 'Out of Stock', color: 'bg-destructive/10 text-destructive' }
    if (quantity < 10) return { label: 'Critical', color: 'bg-orange-500/10 text-orange-600' }
    if (quantity < 20) return { label: 'Low', color: 'bg-yellow-500/10 text-yellow-600' }
    return { label: 'In Stock', color: 'bg-green-500/10 text-green-600' }
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Page Header */}
        <div className="border-b border-border pb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-foreground tracking-tight">Inventory Management</h1>
              <p className="text-muted-foreground mt-2">Track and manage your product inventory</p>
            </div>
            <Button onClick={() => { setEditingProduct(null); setShowForm(true) }} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Product
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <InventoryStatsGrid
          totalProducts={products.length}
          totalValue={totalInventoryValue}
          lowStockItems={lowStockItems}
          outOfStockItems={outOfStockItems}
        />

        {/* Alerts */}
        {(lowStockItems > 0 || outOfStockItems > 0) && (
          <InventoryAlerts
            lowStockItems={lowStockItems}
            outOfStockItems={outOfStockItems}
          />
        )}

        {/* Form Modal */}
        {showForm && (
          <InventoryForm
            product={editingProduct}
            onClose={() => { setShowForm(false); setEditingProduct(null) }}
            onSave={() => { fetchProducts(); setShowForm(false); setEditingProduct(null) }}
          />
        )}

        {/* Filters & Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-card rounded-lg border border-border">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-foreground">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
            >
              <option value="name">Name</option>
              <option value="stock">Stock Level</option>
              <option value="value">Inventory Value</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={filterLowStock ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterLowStock(!filterLowStock)}
              className="gap-2"
            >
              <AlertTriangle className="h-4 w-4" />
              {filterLowStock ? 'Showing Low Stock' : 'Show Low Stock'}
            </Button>
          </div>
        </div>

        {/* Inventory Table */}
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {filterLowStock ? 'No low stock items' : 'No products yet'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th className="px-6 py-4 text-left font-semibold">Product</th>
                    <th className="px-6 py-4 text-left font-semibold">SKU</th>
                    <th className="px-6 py-4 text-right font-semibold">Price</th>
                    <th className="px-6 py-4 text-right font-semibold">Stock</th>
                    <th className="px-6 py-4 text-right font-semibold">Value</th>
                    <th className="px-6 py-4 text-center font-semibold">Status</th>
                    <th className="px-6 py-4 text-center font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredProducts.map((product) => {
                    const status = getStockStatus(product.quantity)
                    const inventoryValue = product.price * product.quantity
                    const isLow = product.quantity < 20
                    const isCritical = product.quantity < 10

                    return (
                      <tr
                        key={product.id}
                        className={`hover:bg-muted/30 transition-colors ${
                          isCritical ? 'bg-destructive/5' : isLow ? 'bg-yellow-500/5' : ''
                        }`}
                      >
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-semibold text-foreground">{product.name}</p>
                            {product.description && (
                              <p className="text-xs text-muted-foreground mt-1">{product.description}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground font-mono text-xs">
                          {product.sku}
                        </td>
                        <td className="px-6 py-4 text-right font-medium">
                          ${product.price.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className={`font-bold ${
                              product.quantity === 0
                                ? 'text-destructive'
                                : product.quantity < 10
                                ? 'text-orange-600'
                                : product.quantity < 20
                                ? 'text-yellow-600'
                                : 'text-green-600'
                            }`}>
                              {product.quantity}
                            </span>
                            {product.quantity < 20 && (
                              <AlertTriangle className="h-4 w-4 text-orange-500" />
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-semibold">
                          ${inventoryValue.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <Badge className={status.color}>
                            {status.label}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setEditingProduct(product); setShowForm(true) }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => handleDelete(product.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}

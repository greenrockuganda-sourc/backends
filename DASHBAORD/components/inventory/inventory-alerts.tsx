import { AlertTriangle, AlertCircle } from 'lucide-react'

interface InventoryAlertsProps {
  lowStockItems: number
  outOfStockItems: number
}

export function InventoryAlerts({ lowStockItems, outOfStockItems }: InventoryAlertsProps) {
  return (
    <div className="space-y-3">
      {outOfStockItems > 0 && (
        <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-foreground">
              {outOfStockItems} {outOfStockItems === 1 ? 'product is' : 'products are'} out of stock
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Urgent: These items need immediate restocking
            </p>
          </div>
        </div>
      )}

      {lowStockItems > 0 && outOfStockItems === 0 && (
        <div className="p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-foreground">
              {lowStockItems} {lowStockItems === 1 ? 'item has' : 'items have'} low stock
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Please reorder soon to avoid stockouts
            </p>
          </div>
        </div>
      )}

      {lowStockItems > 0 && outOfStockItems > 0 && (
        <>
          <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-foreground">
                {outOfStockItems} {outOfStockItems === 1 ? 'product is' : 'products are'} out of stock
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Urgent: These items need immediate restocking
              </p>
            </div>
          </div>

          <div className="p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-foreground">
                {lowStockItems} {lowStockItems === 1 ? 'item has' : 'items have'} low stock
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Please reorder soon to avoid stockouts
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

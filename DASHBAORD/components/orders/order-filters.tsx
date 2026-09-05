'use client'

import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

interface OrderFiltersProps {
  filters: {
    status: string
    paymentStatus: string
    dateFrom: string
    dateTo: string
  }
  onFiltersChange: (filters: any) => void
}

export function OrderFilters({ filters, onFiltersChange }: OrderFiltersProps) {
  const handleStatusChange = (status: string) => {
    onFiltersChange({ ...filters, status })
  }

  const handlePaymentStatusChange = (paymentStatus: string) => {
    onFiltersChange({ ...filters, paymentStatus })
  }

  const handleDateChange = (field: 'dateFrom' | 'dateTo', value: string) => {
    onFiltersChange({ ...filters, [field]: value })
  }

  const hasActiveFilters =
    filters.status || filters.paymentStatus || filters.dateFrom || filters.dateTo

  return (
    <div className="bg-card rounded-lg border border-border p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status Filter */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-2 block uppercase">
            Status
          </label>
          <select
            value={filters.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="w-full px-3 py-2 bg-muted rounded-lg border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Payment Status Filter */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-2 block uppercase">
            Payment
          </label>
          <select
            value={filters.paymentStatus}
            onChange={(e) => handlePaymentStatusChange(e.target.value)}
            className="w-full px-3 py-2 bg-muted rounded-lg border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        {/* Date From */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-2 block uppercase">
            From
          </label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => handleDateChange('dateFrom', e.target.value)}
            className="w-full px-3 py-2 bg-muted rounded-lg border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Date To */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-2 block uppercase">
            To
          </label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => handleDateChange('dateTo', e.target.value)}
            className="w-full px-3 py-2 bg-muted rounded-lg border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onFiltersChange({
                status: '',
                paymentStatus: '',
                dateFrom: '',
                dateTo: '',
              })
            }
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Clear Filters
          </Button>
        </div>
      )}
    </div>
  )
}

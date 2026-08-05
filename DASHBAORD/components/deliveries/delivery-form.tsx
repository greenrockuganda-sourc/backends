'use client'

import { useState } from 'react'
import { Delivery } from '@/lib/types'
import { deliveriesApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

interface DeliveryFormProps {
  onClose: () => void
  onSave: () => void
}

export function DeliveryForm({ onClose, onSave }: DeliveryFormProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    orderId: '',
    orderNumber: '',
    deliveryPersonName: '',
    deliveryPersonPhone: '',
    location: '',
    estimatedDeliveryTime: '',
    status: 'pending' as const,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setLoading(true)
      await deliveriesApi.create(formData as any)
      onSave()
    } catch (err) {
      console.error('Failed to create delivery:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card">
          <h2 className="text-xl font-bold">New Delivery</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Order Number</label>
            <input
              type="text"
              value={formData.orderNumber}
              onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
              className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-foreground bg-input"
              placeholder="ORD-001"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Delivery Person</label>
            <input
              type="text"
              value={formData.deliveryPersonName}
              onChange={(e) => setFormData({ ...formData, deliveryPersonName: e.target.value })}
              className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-foreground bg-input"
              placeholder="John Doe"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Phone</label>
            <input
              type="tel"
              value={formData.deliveryPersonPhone}
              onChange={(e) => setFormData({ ...formData, deliveryPersonPhone: e.target.value })}
              className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-foreground bg-input"
              placeholder="+1234567890"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Location</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-foreground bg-input"
              placeholder="Downtown"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Est. Delivery Time</label>
            <input
              type="datetime-local"
              value={formData.estimatedDeliveryTime}
              onChange={(e) => setFormData({ ...formData, estimatedDeliveryTime: e.target.value })}
              className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-foreground bg-input"
              required
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1"
            >
              {loading ? 'Creating...' : 'Create Delivery'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Delivery } from '@/lib/types'
import { deliveriesApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Plus, CheckCircle2 } from 'lucide-react'
import { DeliveryForm } from '@/components/deliveries/delivery-form'

const statusConfig = {
  'pending': { bg: 'bg-warning/10', text: 'text-warning', label: 'Pending' },
  'in-transit': { bg: 'bg-blue-500/10', text: 'text-blue-600', label: 'In Transit' },
  'delivered': { bg: 'bg-success/10', text: 'text-success', label: 'Delivered' },
  'failed': { bg: 'bg-destructive/10', text: 'text-destructive', label: 'Failed' },
}

export default function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    fetchDeliveries()
  }, [])

  const fetchDeliveries = async () => {
    try {
      setLoading(true)
      const data = await deliveriesApi.getAll()
      setDeliveries(data)
    } catch (err) {
      console.error('Failed to fetch deliveries:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleIssueReceipt = async (id: string) => {
    try {
      const receipt = await deliveriesApi.issueReceipt(id)
      setDeliveries(deliveries.map(d => d.id === id ? { ...d, receiptIssued: true } : d))
      alert('Receipt issued successfully!')
    } catch (err) {
      console.error('Failed to issue receipt:', err)
      alert('Failed to issue receipt')
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Deliveries</h1>
            <p className="text-muted-foreground mt-2">Track and manage deliveries</p>
          </div>
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Delivery
          </Button>
        </div>

        {showForm && (
          <DeliveryForm
            onClose={() => setShowForm(false)}
            onSave={() => { fetchDeliveries(); setShowForm(false) }}
          />
        )}

        <div className="bg-card rounded-lg border border-border overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : deliveries.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-muted-foreground">No deliveries found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold">Order #</th>
                    <th className="px-6 py-3 text-left font-semibold">Person</th>
                    <th className="px-6 py-3 text-left font-semibold">Location</th>
                    <th className="px-6 py-3 text-center font-semibold">Status</th>
                    <th className="px-6 py-3 text-center font-semibold">Receipt</th>
                    <th className="px-6 py-3 text-center font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {deliveries.map((delivery) => {
                    const statusInfo = statusConfig[delivery.status as keyof typeof statusConfig]
                    return (
                      <tr key={delivery.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4 font-medium">{delivery.orderNumber}</td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium">{delivery.deliveryPersonName}</p>
                            <p className="text-xs text-muted-foreground">{delivery.deliveryPersonPhone}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">{delivery.location}</td>
                        <td className="px-6 py-4 text-center">
                          <Badge className={`${statusInfo.bg} ${statusInfo.text}`}>
                            {statusInfo.label}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {delivery.receiptIssued ? (
                            <div className="flex items-center justify-center gap-1 text-success">
                              <CheckCircle2 className="h-4 w-4" />
                              <span className="text-xs">Issued</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Pending</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {delivery.status === 'delivered' && !delivery.receiptIssued && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleIssueReceipt(delivery.id)}
                            >
                              Issue Receipt
                            </Button>
                          )}
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

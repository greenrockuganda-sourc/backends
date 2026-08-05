'use client'

import { Order } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { X, FileText } from 'lucide-react'
import { ordersApi } from '@/lib/api'
import { useState } from 'react'
import { ReceiptTemplate } from '@/components/receipts/receipt-template'

interface OrderDetailProps {
  order: Order
  onClose: () => void
}

export function OrderDetail({ order, onClose }: OrderDetailProps) {
  const [status, setStatus] = useState(order.status)
  const [showReceipt, setShowReceipt] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleStatusChange = async (newStatus: Order['status']) => {
    try {
      setLoading(true)
      await ordersApi.updateStatus(order.id, newStatus)
      setStatus(newStatus)
    } catch (err) {
      console.error('Failed to update status:', err)
    } finally {
      setLoading(false)
    }
  }

  // Mock receipt for display
  const mockReceipt = {
    id: order.id,
    receiptNumber: `REC-${order.orderNumber}`,
    orderId: order.id,
    customerId: order.customerId,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    items: order.items,
    subtotal: order.subtotal,
    tax: order.tax,
    shipping: order.shipping,
    total: order.total,
    paymentMethod: 'Credit Card',
    issuedAt: new Date().toISOString(),
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 flex items-center justify-between p-6 border-b border-border bg-card">
            <h2 className="text-xl font-bold">{order.orderNumber}</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="p-6 space-y-6">
            {/* Customer Info */}
            <div>
              <h3 className="font-semibold text-foreground mb-3">Customer</h3>
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="font-medium">{order.customerName}</p>
                <p className="text-sm text-muted-foreground">{order.customerEmail}</p>
                <p className="text-sm text-muted-foreground">{order.customerPhone}</p>
                <p className="text-sm text-muted-foreground mt-2">{order.shippingAddress}</p>
              </div>
            </div>

            {/* Items */}
            <div>
              <h3 className="font-semibold text-foreground mb-3">Items</h3>
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-4 py-2 text-left">Item</th>
                      <th className="px-4 py-2 text-center w-16">Qty</th>
                      <th className="px-4 py-2 text-right w-24">Price</th>
                      <th className="px-4 py-2 text-right w-24">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item) => (
                      <tr key={item.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-2">{item.productName}</td>
                        <td className="px-4 py-2 text-center">{item.quantity}</td>
                        <td className="px-4 py-2 text-right">${item.price.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right font-semibold">${item.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-64">
                <div className="flex justify-between mb-2 pb-2 border-b border-border">
                  <span>Subtotal:</span>
                  <span>${order.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between mb-2 pb-2 border-b border-border">
                  <span>Tax:</span>
                  <span>${order.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between mb-3 pb-3 border-b border-border">
                  <span>Shipping:</span>
                  <span>${order.shipping.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold bg-primary/10 p-3 rounded">
                  <span>Total:</span>
                  <span className="text-primary">${order.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Status Update */}
            <div>
              <h3 className="font-semibold text-foreground mb-3">Order Status</h3>
              <div className="flex flex-wrap gap-2">
                {(['pending', 'confirmed', 'shipped', 'delivered'] as const).map((s) => (
                  <Button
                    key={s}
                    variant={status === s ? 'default' : 'outline'}
                    onClick={() => handleStatusChange(s)}
                    disabled={loading}
                    className="capitalize"
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-border">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1"
              >
                Close
              </Button>
              <Button
                onClick={() => setShowReceipt(true)}
                className="flex-1 gap-2"
              >
                <FileText className="h-4 w-4" />
                Issue Receipt
              </Button>
            </div>
          </div>
        </div>
      </div>

      {showReceipt && (
        <ReceiptTemplate
          receipt={mockReceipt as any}
          onClose={() => setShowReceipt(false)}
        />
      )}
    </>
  )
}

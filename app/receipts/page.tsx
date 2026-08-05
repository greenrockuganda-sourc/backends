'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Receipt } from '@/lib/types'
import { receiptsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Download, Eye } from 'lucide-react'
import { ReceiptTemplate } from '@/components/receipts/receipt-template'

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null)

  useEffect(() => {
    fetchReceipts()
  }, [])

  const fetchReceipts = async () => {
    try {
      setLoading(true)
      const data = await receiptsApi.getAll()
      setReceipts(data)
    } catch (err) {
      console.error('Failed to fetch receipts:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (id: string) => {
    try {
      const blob = await receiptsApi.downloadPdf(id)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `receipt-${id}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Failed to download PDF:', err)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Receipts</h1>
          <p className="text-muted-foreground mt-2">View and manage issued receipts</p>
        </div>

        {selectedReceipt && (
          <ReceiptTemplate
            receipt={selectedReceipt}
            onClose={() => setSelectedReceipt(null)}
          />
        )}

        <div className="bg-card rounded-lg border border-border overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : receipts.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-muted-foreground">No receipts issued yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold">Receipt #</th>
                    <th className="px-6 py-3 text-left font-semibold">Customer</th>
                    <th className="px-6 py-3 text-right font-semibold">Total</th>
                    <th className="px-6 py-3 text-left font-semibold">Issued</th>
                    <th className="px-6 py-3 text-center font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {receipts.map((receipt) => (
                    <tr key={receipt.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-medium">{receipt.receiptNumber}</td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium">{receipt.customerName}</p>
                          <p className="text-xs text-muted-foreground">{receipt.customerEmail}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-semibold">
                        ${receipt.total.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {new Date(receipt.issuedAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedReceipt(receipt)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(receipt.id)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}

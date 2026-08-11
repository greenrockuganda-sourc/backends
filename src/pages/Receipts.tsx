import { useEffect, useState } from 'react'
import { Download, Printer, Mail, Eye, PackageOpen } from 'lucide-react'
import { fetchReceipts, sendReceiptEmail, downloadReceiptPdf } from '@/lib/api'
import { Receipt } from '@/types'
import Skeleton, { SkeletonTable } from '@/components/Skeleton'

const formatCurrency = (value: number) => `UGX ${value.toFixed(2)}`

interface ReceiptsProps {
  token: string
}

const formatReceiptDate = (value: string | null | undefined) => {
  if (!value) return ''
  const text = String(value)
  const dateOnly = text.split('T')[0]
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return dateOnly
  const parsed = new Date(text)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0]
  return text
}

export default function Receipts({ token }: ReceiptsProps) {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyReceipt, setBusyReceipt] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const loadReceipts = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await fetchReceipts(token)
        if (!active) return

        const receiptsArray = Array.isArray(data?.results)
          ? data.results
          : Array.isArray(data)
            ? data
            : []

        const normalizedReceipts = receiptsArray.map((receipt: any) => ({
          id: String(receipt.id ?? receipt.receipt_id ?? 'N/A'),
          receiptNumber: receipt.receipt_number ?? receipt.receiptNumber ?? `${receipt.id ?? 'N/A'}`,
          orderNumber: receipt.order_number ?? receipt.orderNumber ?? receipt.order_id ?? receipt.orderId ?? 'N/A',
          customer: receipt.customer ?? receipt.customer_name ?? 'Guest',
          amount: Number(receipt.amount ?? receipt.total_amount ?? 0),
          date: formatReceiptDate(receipt.date ?? receipt.receipt_date ?? receipt.created_at ?? ''),
          items: (Array.isArray(receipt.items) ? receipt.items : []).map((item: any) => ({
            product_name: item.product_name ?? item.name ?? 'Item',
            quantity: Number(item.quantity ?? 0),
            unit_price: Number(item.unit_price ?? item.price ?? 0),
            subtotal: Number(item.subtotal ?? item.amount ?? 0),
          })),
        }))
        setReceipts(normalizedReceipts)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load receipts.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadReceipts()
    return () => { active = false }
  }, [token])

  const handlePrint = () => window.print()

  const handleDownload = async (receiptId: string, receiptNumber: string) => {
    setActionMessage(null)
    setActionError(null)
    setBusyReceipt(receiptId)

    try {
      const blob = await downloadReceiptPdf(token, receiptId)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${receiptNumber}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setActionMessage('Receipt PDF downloaded successfully.')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to download receipt PDF.')
    } finally { setBusyReceipt(null) }
  }

  const handleEmail = async (receiptId: string) => {
    setActionMessage(null)
    setActionError(null)
    setBusyReceipt(receiptId)

    try {
      await sendReceiptEmail(token, receiptId)
      setActionMessage('Receipt email sent successfully.')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to send receipt email.')
    } finally { setBusyReceipt(null) }
  }

  return (
    <div className="p-3 sm:p-6 lg:p-8">
      <div className="mb-6 sm:mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Receipts</h2>
        <p className="text-gray-500 mt-1">Manage and download receipts</p>
      </div>

      {error && <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">{error}</div>}
      {actionMessage && <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">{actionMessage}</div>}
      {actionError && <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">{actionError}</div>}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="responsive-table w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Receipt</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Order</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Items</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Qty</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Cost Each</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={9}>
                    <div className="px-4">
                      <SkeletonTable rows={5} columns={9} />
                    </div>
                  </td>
                </tr>
              ) : !loading && receipts.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="flex flex-col items-center justify-center px-4 py-12">
                      <PackageOpen size={48} className="text-gray-400 mb-3" />
                      <p className="text-sm font-medium text-gray-900">No receipts found</p>
                      <p className="text-sm text-gray-500 mt-1">Receipts will appear here after orders are completed.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                receipts.map((receipt) => (
                  <tr key={receipt.id} className="hover:bg-gray-50 transition-colors">
                    <td data-label="Receipt" className="px-6 py-4 text-sm font-medium text-blue-600">{receipt.receiptNumber}</td>
                    <td data-label="Order" className="px-6 py-4 text-sm text-gray-900">{receipt.orderNumber}</td>
                    <td data-label="Customer" className="px-6 py-4 text-sm text-gray-900">{receipt.customer}</td>
                    <td data-label="Items" className="px-6 py-4 text-sm text-gray-900">
                      <div className="space-y-1">
                        {Array.isArray(receipt.items) && receipt.items.length > 0 ? receipt.items.map((item, index) => (
                          <div key={`${receipt.id}-${index}`} className="font-medium">{item.product_name}</div>
                        )) : <span className="text-gray-400">No items</span>}
                      </div>
                    </td>
                    <td data-label="Qty" className="px-6 py-4 text-sm text-gray-900">
                      <div className="space-y-1">
                        {Array.isArray(receipt.items) && receipt.items.length > 0 ? receipt.items.map((item, index) => (
                          <div key={`${receipt.id}-qty-${index}`}>{item.quantity}</div>
                        )) : <span className="text-gray-400">—</span>}
                      </div>
                    </td>
                    <td data-label="Cost Each" className="px-6 py-4 text-sm text-gray-900">
                      <div className="space-y-1">
                        {Array.isArray(receipt.items) && receipt.items.length > 0 ? receipt.items.map((item, index) => (
                          <div key={`${receipt.id}-price-${index}`}>{formatCurrency(item.unit_price)}</div>
                        )) : <span className="text-gray-400">—</span>}
                      </div>
                    </td>
                    <td data-label="Total" className="px-6 py-4 text-sm font-medium text-gray-900">
                      <div className="space-y-1">
                        {Array.isArray(receipt.items) && receipt.items.length > 0 ? receipt.items.map((item, index) => (
                          <div key={`${receipt.id}-sub-${index}`}>{formatCurrency(item.subtotal)}</div>
                        )) : <span className="text-gray-400">—</span>}
                      </div>
                      <div className="mt-2 border-t border-gray-200 pt-2">{formatCurrency(receipt.amount)}</div>
                    </td>
                    <td data-label="Date" className="px-6 py-4 text-sm text-gray-500">{receipt.date}</td>
                    <td data-label="Actions" className="px-6 py-4 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => setSelectedReceipt(receipt)}
                          className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                          title="Preview"
                        >
                          <Eye size={14} />
                          <span>Preview</span>
                        </button>
                        <button onClick={() => handlePrint()} className="text-blue-600 hover:text-blue-800 p-2" title="Print">
                          <Printer size={18} />
                        </button>
                        <button
                          onClick={() => handleDownload(receipt.id, receipt.receiptNumber)}
                          className="text-blue-600 hover:text-blue-800 p-2"
                          title="Download"
                          disabled={busyReceipt === receipt.id}
                        >
                          <Download size={18} />
                        </button>
                        <button
                          onClick={() => handleEmail(receipt.id)}
                          className="text-blue-600 hover:text-blue-800 p-2"
                          title="Email"
                          disabled={busyReceipt === receipt.id}
                        >
                          <Mail size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedReceipt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-4 sm:p-8 max-h-[90vh] overflow-y-auto receipt-container slide-up">
            <div className="flex justify-between items-center mb-6 no-print">
              <h3 className="text-xl font-bold text-gray-900">Receipt {selectedReceipt.receiptNumber}</h3>
              <button onClick={() => setSelectedReceipt(null)} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
            </div>

            <div className="border border-gray-300 p-6">
              <div className="text-center mb-6 border-b border-gray-300 pb-4">
                <h2 className="text-2xl font-bold text-gray-900">RECEIPT</h2>
                <p className="text-gray-600">Receipt #{selectedReceipt.receiptNumber}</p>
              </div>

              <div className="mb-6 space-y-2">
                <p className="text-sm text-gray-600"><strong>Receipt:</strong> {selectedReceipt.receiptNumber}</p>
                <p className="text-sm text-gray-600"><strong>Order:</strong> {selectedReceipt.orderNumber}</p>
                <p className="text-sm text-gray-600"><strong>Customer:</strong> {selectedReceipt.customer}</p>
                <p className="text-sm text-gray-600"><strong>Date:</strong> {selectedReceipt.date}</p>
              </div>

              <div className="mb-6 overflow-hidden rounded border border-gray-300">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Item</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Qty</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Cost each</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.isArray(selectedReceipt.items) && selectedReceipt.items.length > 0 ? selectedReceipt.items.map((item, index) => (
                      <tr key={`${selectedReceipt.id}-${index}`} className="border-t border-gray-200">
                        <td className="px-3 py-2">{item.product_name}</td>
                        <td className="px-3 py-2">{item.quantity}</td>
                        <td className="px-3 py-2">{formatCurrency(item.unit_price)}</td>
                        <td className="px-3 py-2">{formatCurrency(item.subtotal)}</td>
                      </tr>
                    )) : (
                      <tr className="border-t border-gray-200">
                        <td className="px-3 py-2" colSpan={4}>No items available.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="text-right border-t border-gray-300 pt-4">
                <p className="text-lg font-bold text-gray-900">Total: {formatCurrency(selectedReceipt.amount)}</p>
              </div>

              <div className="text-center mt-6 text-xs text-gray-600 border-t border-gray-300 pt-4">
                <p>Thank you for your business.</p>
                <p>This receipt was generated from the admin API.</p>
              </div>
            </div>

            <div className="flex gap-2 mt-6 no-print">
              <button onClick={() => handlePrint()} className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700">Print Receipt</button>
              <button
                onClick={() => handleDownload(selectedReceipt.id, selectedReceipt.receiptNumber)}
                className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                disabled={busyReceipt === selectedReceipt.id}
              >
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
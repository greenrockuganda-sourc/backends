import { useEffect, useState } from 'react'
import { Check, MapPin, FileText } from 'lucide-react'
import { fetchDeliveries, updateDelivery, createReceipt, downloadReceiptPdf, sendReceiptEmail } from '@/lib/api'
import { notifySuccess } from '@/lib/notify'
import { Delivery } from '@/types'

interface DeliveriesProps {
  token: string
}

export default function Deliveries({ token }: DeliveriesProps) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const loadDeliveries = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await fetchDeliveries(token)
        if (!active) {
          return
        }

        const normalizedDeliveries = (data?.results ?? data ?? []).map((delivery: any) => ({
          id: delivery.delivery_id ?? delivery.id ?? 'N/A',
          orderId: delivery.order_id ?? delivery.orderId ?? 'N/A',
          driver: delivery.driver_name ?? delivery.driver ?? 'Unassigned',
          address: delivery.address ?? delivery.delivery_address ?? 'Address unavailable',
          status: (delivery.status ?? 'pending').toLowerCase(),
          receiptIssued: Boolean(delivery.receipt_issued ?? delivery.receiptIssued ?? false),
        }))
        setDeliveries(normalizedDeliveries)
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load deliveries.')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadDeliveries()
    return () => {
      active = false
    }
  }, [token])

  const handleMarkDelivered = async (id: string) => {
    setError(null)
    const original = deliveries
    try {
      setLoading(true)
      await updateDelivery(token, id, 'Delivered')
      setDeliveries((currentDeliveries) => currentDeliveries.map((delivery) =>
        delivery.id === id ? { ...delivery, status: 'delivered', receiptIssued: true } : delivery
      ))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to mark delivered.')
      setDeliveries(original)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenReceipt = async (delivery: Delivery) => {
    setError(null)
    try {
      setLoading(true)
      const resp = await createReceipt(token, delivery.orderId)
      const pdfUrl: string | undefined = resp?.pdf_url
      if (!pdfUrl) {
        setError('Receipt not available.')
        return
      }

      // extract receipt id from pdf_url like /api/admin/receipts/<id>/pdf/
      const m = pdfUrl.match(/\/api\/admin\/receipts\/(\d+)\/pdf\//)
      const receiptId = m ? m[1] : null
      if (!receiptId) {
        // if we can't extract id, open the pdf_url in a new tab
        window.open(pdfUrl, '_blank')
        return
      }

      const doDownload = window.confirm('Download receipt PDF? OK = download, Cancel = send email')
      if (doDownload) {
        const blob = await downloadReceiptPdf(token, receiptId)
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `receipt-${receiptId}.pdf`
        document.body.appendChild(a)
        a.click()
        a.remove()
        window.URL.revokeObjectURL(url)
      } else {
        await sendReceiptEmail(token, receiptId)
        notifySuccess('Receipt emailed.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to open receipt.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900">Deliveries</h2>
        <p className="text-gray-500 mt-1">Track and manage deliveries</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-gray-600 text-sm">Pending</p>
          <p className="text-2xl font-bold text-gray-900">{deliveries.filter((delivery) => delivery.status === 'pending').length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-gray-600 text-sm">In Transit</p>
          <p className="text-2xl font-bold text-gray-900">{deliveries.filter((delivery) => delivery.status === 'in-transit').length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-gray-600 text-sm">Delivered</p>
          <p className="text-2xl font-bold text-gray-900">{deliveries.filter((delivery) => delivery.status === 'delivered').length}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Delivery ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Order ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Driver</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Address</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Receipt</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {!loading && deliveries.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">No deliveries found.</td>
                </tr>
              )}
              {deliveries.map((delivery) => (
                <tr key={delivery.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-blue-600">{delivery.id}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{delivery.orderId}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{delivery.driver}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 flex items-center gap-1">
                    <MapPin size={16} />
                    {delivery.address}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      delivery.status === 'delivered' ? 'bg-green-100 text-green-800' :
                      delivery.status === 'in-transit' ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {delivery.status.charAt(0).toUpperCase() + delivery.status.slice(1).replace('-', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {delivery.receiptIssued ? (
                      <span className="flex items-center gap-1 text-green-600">
                        <Check size={16} />
                        Issued
                      </span>
                    ) : (
                      <span className="text-gray-500">Pending</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm space-x-2">
                    {delivery.status !== 'delivered' && (
                      <button
                        onClick={() => handleMarkDelivered(delivery.id)}
                        className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 transition-colors"
                      >
                        Mark Delivered
                      </button>
                    )}
                    {delivery.receiptIssued && (
                        <button onClick={() => handleOpenReceipt(delivery)} className="text-blue-600 hover:text-blue-800">
                          <FileText size={18} />
                        </button>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

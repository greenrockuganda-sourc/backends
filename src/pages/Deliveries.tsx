import { useEffect, useState } from 'react'
import { Check, MapPin, PackageOpen, FileText, Send } from 'lucide-react'
import { fetchDeliveries, updateDelivery, createReceipt, downloadReceiptPdf, sendReceiptEmail } from '@/lib/api'
import { notifySuccess } from '@/lib/notify'
import { Delivery } from '@/types'
import Skeleton, { SkeletonTable } from '@/components/Skeleton'

interface DeliveriesProps {
  token: string
}

export default function Deliveries({ token }: DeliveriesProps) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyDelivery, setBusyDelivery] = useState<string | null>(null)

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

        const deliveriesArray = Array.isArray(data?.results)
          ? data.results
          : Array.isArray(data)
            ? data
            : []

        const normalizedDeliveries = deliveriesArray.map((delivery: any) => ({
          id: delivery.id ?? delivery.delivery_id ?? 'N/A',
          orderId: delivery.order_number ?? delivery.orderId ?? 'N/A',
          driver: delivery.delivery_person ?? delivery.driver_name ?? delivery.driver ?? 'Unassigned',
          address: delivery.delivery_address ?? delivery.address ?? 'Address unavailable',
          status: (delivery.delivery_status ?? delivery.status ?? 'preparing').toLowerCase(),
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

  // Map backend delivery statuses to the UI status used throughout
  const isDeliveryPending = (status: string) => status === 'preparing' || status === 'pending'
  const isDeliveryInTransit = (status: string) => status === 'out for delivery' || status === 'in-transit' || status === 'shipped'
  const isDeliveryDelivered = (status: string) => status === 'delivered'

  const getDeliveryStatusColor = (status: string) => {
    if (isDeliveryDelivered(status)) return 'bg-green-100 text-green-800'
    if (isDeliveryInTransit(status)) return 'bg-blue-100 text-blue-800'
    return 'bg-yellow-100 text-yellow-800'
  }

  const formatDeliveryStatus = (status: string) => {
    const label = status.replace('-', ' ')
    return label.charAt(0).toUpperCase() + label.slice(1)
  }

  const handleMarkDelivered = async (id: string) => {
    setError(null)
    const original = deliveries
    try {
      setBusyDelivery(id)
      await updateDelivery(token, id, 'Delivered')
      setDeliveries((currentDeliveries) => currentDeliveries.map((delivery) =>
        delivery.id === id ? { ...delivery, status: 'delivered', receiptIssued: true } : delivery
      ))
      notifySuccess('Delivery marked as delivered')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to mark delivered.')
      setDeliveries(original)
    } finally {
      setBusyDelivery(null)
    }
  }

  const handleDownloadReceipt = async (delivery: Delivery) => {
    setError(null)
    try {
      setBusyDelivery(delivery.id)
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
        window.open(pdfUrl, '_blank')
        return
      }

      const blob = await downloadReceiptPdf(token, receiptId)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `receipt-${receiptId}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      notifySuccess('Receipt downloaded successfully')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to download receipt.')
    } finally {
      setBusyDelivery(null)
    }
  }

  const handleEmailReceipt = async (delivery: Delivery) => {
    setError(null)
    try {
      setBusyDelivery(delivery.id)
      const resp = await createReceipt(token, delivery.orderId)
      const pdfUrl: string | undefined = resp?.pdf_url
      if (!pdfUrl) {
        setError('Receipt not available.')
        return
      }

      const m = pdfUrl.match(/\/api\/admin\/receipts\/(\d+)\/pdf\//)
      const receiptId = m ? m[1] : null
      if (!receiptId) {
        setError('Could not determine receipt ID.')
        return
      }

      await sendReceiptEmail(token, receiptId)
      notifySuccess('Receipt emailed successfully')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to email receipt.')
    } finally {
      setBusyDelivery(null)
    }
  }

  const pendingCount = deliveries.filter((d) => isDeliveryPending(d.status)).length
  const inTransitCount = deliveries.filter((d) => isDeliveryInTransit(d.status)).length
  const deliveredCount = deliveries.filter((d) => isDeliveryDelivered(d.status)).length

  return (
    <div className="p-3 sm:p-6 lg:p-8">
      <div className="mb-6 sm:mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Deliveries</h2>
        <p className="text-gray-500 mt-1">Track and manage deliveries</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-gray-600 text-sm">Pending</p>
          <p className="text-2xl font-bold text-gray-900">{pendingCount}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-gray-600 text-sm">In Transit</p>
          <p className="text-2xl font-bold text-gray-900">{inTransitCount}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-gray-600 text-sm">Delivered</p>
          <p className="text-2xl font-bold text-gray-900">{deliveredCount}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="responsive-table w-full">
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
              {loading ? (
                <tr>
                  <td colSpan={7}>
                    <div className="px-4">
                      <SkeletonTable rows={5} columns={7} />
                    </div>
                  </td>
                </tr>
              ) : !loading && deliveries.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="flex flex-col items-center justify-center px-4 py-12">
                      <PackageOpen size={48} className="text-gray-400 mb-3" />
                      <p className="text-sm font-medium text-gray-900">No deliveries yet</p>
                      <p className="text-sm text-gray-500 mt-1">Deliveries will appear here when orders are ready.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                deliveries.map((delivery) => (
                  <tr key={delivery.id} className="hover:bg-gray-50 transition-colors">
                    <td data-label="Delivery ID" className="px-6 py-4 text-sm font-medium text-blue-600">{delivery.id}</td>
                    <td data-label="Order ID" className="px-6 py-4 text-sm text-gray-900">{delivery.orderId}</td>
                    <td data-label="Driver" className="px-6 py-4 text-sm text-gray-900">{delivery.driver}</td>
                    <td data-label="Address" className="px-6 py-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <MapPin size={16} className="flex-shrink-0" />
                        <span className="break-words">{delivery.address}</span>
                      </span>
                    </td>
                    <td data-label="Status" className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getDeliveryStatusColor(delivery.status)}`}>
                        {formatDeliveryStatus(delivery.status)}
                      </span>
                    </td>
                    <td data-label="Receipt" className="px-6 py-4 text-sm">
                      {delivery.receiptIssued ? (
                        <span className="flex items-center gap-1 text-blue-600">
                          <Check size={16} />
                          Issued
                        </span>
                      ) : (
                        <span className="text-gray-500">Pending</span>
                      )}
                    </td>
                    <td data-label="Actions" className="px-6 py-4 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        {!isDeliveryDelivered(delivery.status) && (
                          <button
                            onClick={() => handleMarkDelivered(delivery.id)}
                            disabled={busyDelivery === delivery.id}
                            className="bg-blue-600 text-white px-3 py-2 rounded text-xs hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                          >
                            {busyDelivery === delivery.id ? 'Updating...' : 'Mark Delivered'}
                          </button>
                        )}
                        {delivery.receiptIssued && (
                          <button
                            onClick={() => handleDownloadReceipt(delivery)}
                            disabled={busyDelivery === delivery.id}
                            className="text-blue-600 hover:text-blue-800 p-2 disabled:opacity-50"
                            aria-label="Download receipt"
                            title="Download receipt"
                          >
                            <FileText size={18} />
                          </button>
                        )}
                        {delivery.receiptIssued && (
                          <button
                            onClick={() => handleEmailReceipt(delivery)}
                            disabled={busyDelivery === delivery.id}
                            className="text-blue-600 hover:text-blue-800 p-2 disabled:opacity-50"
                            aria-label="Email receipt"
                            title="Email receipt"
                          >
                            <Send size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
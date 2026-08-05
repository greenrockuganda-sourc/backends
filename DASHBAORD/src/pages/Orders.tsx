import { useEffect, useMemo, useState } from 'react'
import { Eye, Edit2, Download } from 'lucide-react'
import { createReceipt, downloadReceiptPdf, fetchOrders, getOrderDetails, updateOrderStatus } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { Order } from '@/types'

const validRanges = ['7d', '30d', '90d', 'all'] as const

type RangeKey = (typeof validRanges)[number]

const getRangeStartDate = (range: RangeKey) => {
  if (range === 'all') return null
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000)
}

const readOrdersRangeFromUrl = (): RangeKey => {
  if (typeof window === 'undefined') return '7d'
  const params = new URLSearchParams(window.location.search)
  const value = params.get('ordersRange')
  return validRanges.includes(value as RangeKey) ? (value as RangeKey) : '7d'
}

const statusColors: Record<string, string> = {
  delivered: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  shipped: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-red-100 text-red-800',
  confirmed: 'bg-indigo-100 text-indigo-800',
  processing: 'bg-sky-100 text-sky-800',
  packed: 'bg-purple-100 text-purple-800',
  'out for delivery': 'bg-cyan-100 text-cyan-800',
}

const statusOptions = ['Pending', 'Confirmed', 'Processing', 'Packed', 'Out for Delivery', 'Delivered', 'Cancelled']

interface OrdersProps {
  token: string
}

export default function Orders({ token }: OrdersProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any | null>(null)
  const [statusDraft, setStatusDraft] = useState('Pending')
  const [range, setRange] = useState<RangeKey>(readOrdersRangeFromUrl)
  const [visibleOrders, setVisibleOrders] = useState(20)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [isDownloadingReceipt, setIsDownloadingReceipt] = useState(false)

  useEffect(() => {
    let active = true

    const loadOrders = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await fetchOrders(token)
        if (!active) {
          return
        }

        const list = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : []
        const normalizedOrders = list.map((order: any) => {
          const items = Array.isArray(order.items)
            ? order.items.map((item: any) => ({
                product_name: item.product_name ?? 'Item',
                quantity: Number(item.quantity ?? 0),
                unit_price: Number(item.unit_price ?? 0),
                subtotal: Number(item.subtotal ?? 0),
              }))
            : []

          return {
            id: String(order.order_id ?? order.id ?? 'N/A'),
            customer: order.customer_name ?? order.customer ?? 'Guest',
            amount: Number(order.total_amount ?? order.amount ?? 0),
            status: String(order.order_status ?? order.status ?? 'pending').toLowerCase(),
            date: order.created_at?.slice(0, 10) ?? order.date ?? '',
            items,
          }
        })

        setOrders(normalizedOrders)
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load orders.')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadOrders()
    return () => {
      active = false
    }
  }, [token])

  const filteredOrders = useMemo(() => {
    const rangeStart = getRangeStartDate(range)
    if (!rangeStart) {
      return orders
    }
    return orders.filter((order) => {
      const orderDate = new Date(order.date)
      return !Number.isNaN(orderDate.getTime()) && orderDate >= rangeStart
    })
  }, [orders, range])

  const visibleOrderRows = useMemo(() => filteredOrders.slice(0, visibleOrders), [filteredOrders, visibleOrders])

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  }

  const handleExportCsv = () => {
    const rows: string[] = []
    rows.push('Order ID,Customer,Status,Date,Amount,Item,Qty,Cost Each,Subtotal')

    filteredOrders.forEach((order) => {
      if (order.items?.length) {
        order.items.forEach((item) => {
          rows.push([
            order.id,
            order.customer,
            order.status,
            order.date,
            order.amount.toFixed(2),
            item.product_name,
            item.quantity.toString(),
            item.unit_price?.toFixed(2) ?? '',
            item.subtotal?.toFixed(2) ?? '',
          ].map((field) => `"${String(field).replace(/"/g, '""')}"`).join(','))
        })
      } else {
        rows.push([
          order.id,
          order.customer,
          order.status,
          order.date,
          order.amount.toFixed(2),
          '',
          '',
          '',
          '',
        ].map((field) => `"${String(field).replace(/"/g, '""')}"`).join(','))
      }
    })

    const blob = new Blob([rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `orders-${range}.csv`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  }

  const handleExportExcel = () => {
    const rows: string[] = []
    rows.push('Order ID,Customer,Status,Date,Amount,Item,Qty,Cost Each,Subtotal')

    filteredOrders.forEach((order) => {
      if (order.items?.length) {
        order.items.forEach((item) => {
          rows.push([
            order.id,
            order.customer,
            order.status,
            order.date,
            order.amount.toFixed(2),
            item.product_name,
            item.quantity.toString(),
            item.unit_price?.toFixed(2) ?? '',
            item.subtotal?.toFixed(2) ?? '',
          ].map((field) => `"${String(field).replace(/"/g, '""')}"`).join(','))
        })
      } else {
        rows.push([
          order.id,
          order.customer,
          order.status,
          order.date,
          order.amount.toFixed(2),
          '',
          '',
          '',
          '',
        ].map((field) => `"${String(field).replace(/"/g, '""')}"`).join(','))
      }
    })

    const blob = new Blob([rows.join('\r\n')], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8;' })
    downloadBlob(blob, `orders-${range}.xlsx`)
  }

  const handleViewOrder = async (orderId: string) => {
    setError(null)
    try {
      const data = await getOrderDetails(token, orderId)
      const detailsItems = Array.isArray(data?.items)
        ? data.items.map((item: any) => ({
            product_name: item.product_name ?? 'Item',
            quantity: Number(item.quantity ?? 0),
            unit_price: Number(item.unit_price ?? 0),
            subtotal: Number(item.subtotal ?? 0),
          }))
        : []

      const selectedStatus = String(data?.order_status ?? 'Pending')
      setSelectedOrder({
        id: String(data.id ?? orderId),
        customer: data.customer ?? 'Guest',
        amount: Number(data.total_amount ?? data.amount ?? 0),
        status: selectedStatus.toLowerCase(),
        date: data.created_at?.slice(0, 10) ?? data.date ?? '',
        items: detailsItems,
      })
      setSelectedOrderDetails(data)
      setStatusDraft(selectedStatus)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load order details.')
    }
  }

  const handleUpdateOrderStatus = async (orderId: string, nextStatus: string) => {
    const normalizedStatus = nextStatus.trim()
    if (!normalizedStatus) {
      return
    }

    setError(null)
    setIsUpdatingStatus(true)
    try {
      await updateOrderStatus(token, orderId, normalizedStatus)
      const normalizedValue = normalizedStatus.toLowerCase()
      setOrders((prev) => prev.map((order) => (
        order.id === orderId ? { ...order, status: normalizedValue } : order
      )))
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => prev ? { ...prev, status: normalizedValue } : prev)
        setSelectedOrderDetails((prev: any) => prev ? { ...prev, order_status: normalizedStatus } : prev)
      }
      notifySuccess(`Order status updated to ${normalizedStatus}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to update order status.'
      setError(message)
      notifyError(message)
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  const handleDownloadReceipt = async (orderId: string) => {
    setError(null)
    setIsDownloadingReceipt(true)
    try {
      const receipt = await createReceipt(token, orderId)
      const receiptId = receipt?.id ?? receipt?.receipt_id ?? receipt?.receipt?.id
      if (!receiptId) {
        throw new Error('Receipt could not be created for this order.')
      }

      const blob = await downloadReceiptPdf(token, String(receiptId))
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `receipt-${orderId}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      notifySuccess('Receipt downloaded successfully')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to download receipt.'
      setError(message)
      notifyError(message)
    } finally {
      setIsDownloadingReceipt(false)
    }
  }

  const closeOrderDetails = () => {
    setSelectedOrder(null)
    setSelectedOrderDetails(null)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Orders</h2>
          <p className="text-gray-500 mt-1">Manage customer orders</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={range}
            onChange={(event) => setRange(event.target.value as RangeKey)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
          <button
            type="button"
            onClick={handleExportCsv}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 transition-colors"
          >
            Export Excel
          </button>
        </div>
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Shown orders</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{filteredOrders.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Total amount</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">UGX {filteredOrders.reduce((sum, order) => sum + order.amount, 0).toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Average order</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">UGX {filteredOrders.length ? (filteredOrders.reduce((sum, order) => sum + order.amount, 0) / filteredOrders.length).toFixed(2) : '0.00'}</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Order ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Items</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {!loading && filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">No orders found for the selected date range.</td>
                </tr>
              )}
              {visibleOrderRows.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-blue-600">{order.id}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{order.customer}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                    {order.items?.length ? (
                      <div className="space-y-1">
                        {order.items.slice(0, 2).map((item, index) => (
                          <div key={`${order.id}-${index}`}>
                            {item.product_name} × {item.quantity}
                          </div>
                        ))}
                        {order.items.length > 2 ? <div className="text-xs text-gray-400">+{order.items.length - 2} more</div> : null}
                      </div>
                    ) : (
                      <span className="text-gray-400">No items listed</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">UGX {order.amount.toFixed(2)}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[order.status] || 'bg-gray-100 text-gray-800'}`}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{order.date}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleViewOrder(order.id)} className="text-blue-600 hover:text-blue-800" title="View">
                        <Eye size={18} />
                      </button>
                      <button onClick={() => handleViewOrder(order.id)} className="text-green-600 hover:text-green-800" title="Edit">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => handleDownloadReceipt(order.id)} disabled={isDownloadingReceipt} className="text-orange-600 hover:text-orange-800 disabled:opacity-50" title="Download">
                        <Download size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredOrders.length > visibleOrders && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleOrders((prev) => prev + 20)}
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
          >
            Load more orders
          </button>
        </div>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">Order Details</h3>
              <button onClick={closeOrderDetails} className="text-gray-500 hover:text-gray-700">×</button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Order ID</p>
                  <p className="font-medium text-gray-900">{selectedOrder.id}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Customer</p>
                  <p className="font-medium text-gray-900">{selectedOrder.customer}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Amount</p>
                  <p className="font-medium text-gray-900">UGX {selectedOrder.amount.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Status</p>
                  <p className={`font-medium px-2 py-1 rounded inline-block ${statusColors[selectedOrder.status] || 'bg-gray-100 text-gray-800'}`}>
                    {selectedOrder.status.charAt(0).toUpperCase() + selectedOrder.status.slice(1)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <label className="text-sm font-medium text-gray-700">Update status</label>
                <select
                  value={statusDraft}
                  onChange={(event) => setStatusDraft(event.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  {statusOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleUpdateOrderStatus(selectedOrder.id, statusDraft)}
                  disabled={isUpdatingStatus}
                  className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {isUpdatingStatus ? 'Saving...' : 'Save status'}
                </button>
                <button
                  onClick={() => handleDownloadReceipt(selectedOrder.id)}
                  disabled={isDownloadingReceipt}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 disabled:opacity-60"
                >
                  {isDownloadingReceipt ? 'Preparing...' : 'Download receipt'}
                </button>
              </div>

              {selectedOrder.items?.length ? (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">Items sold</p>
                  <div className="space-y-2">
                    {selectedOrder.items.map((item: any, index: number) => (
                      <div key={`${selectedOrder.id}-${index}`} className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{item.product_name}</p>
                            <p className="text-xs text-gray-500">Qty: {item.quantity} • Unit: UGX {item.unit_price?.toFixed?.(2) ?? item.unit_price ?? '0.00'}</p>
                          </div>
                          <p className="text-sm font-semibold text-gray-900">UGX {item.subtotal?.toFixed?.(2) ?? '0.00'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

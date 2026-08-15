import { Order } from '@/types'

interface RecentOrdersProps {
  orders: Order[]
  loading?: boolean
}

const statusColors: Record<string, string> = {
  delivered: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  shipped: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-red-100 text-red-800',
}

export default function RecentOrders({ orders, loading }: RecentOrdersProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Orders</h3>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-gray-100 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-gray-200">
        <h3 className="text-lg font-bold text-gray-900">Recent Orders</h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="responsive-table w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider sm:px-6">Order ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider sm:px-6">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider sm:px-6">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider sm:px-6">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider sm:px-6">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {orders.map(order => (
              <tr key={order.id} className="transition-colors hover:bg-gray-50">
                <td data-label="Order ID" className="px-4 py-4 text-sm font-medium text-blue-600 sm:px-6">{order.id}</td>
                <td data-label="Customer" className="px-4 py-4 text-sm text-gray-900 sm:px-6">{order.customer}</td>
                <td data-label="Amount" className="px-4 py-4 text-sm font-medium text-gray-900 sm:px-6">UGX {order.amount.toFixed(2)}</td>
                <td data-label="Status" className="px-4 py-4 text-sm sm:px-6">
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusColors[order.status] || 'bg-gray-100 text-gray-800'}`}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </span>
                </td>
                <td data-label="Date" className="px-4 py-4 text-sm text-gray-500 sm:px-6">{order.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
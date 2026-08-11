import { useEffect, useMemo, useState } from 'react'
import { Download, Send, FileText } from 'lucide-react'
import { fetchReport, sendReportEmail } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'

const reportTypes = [
  { value: 'sales', label: 'Sales Summary' },
  { value: 'orders', label: 'Order Details' },
  { value: 'products', label: 'Inventory Snapshot' },
  { value: 'customers', label: 'Customer Report' },
] as const

type ReportType = (typeof reportTypes)[number]['value']

interface ReportsProps {
  token: string
}

export default function Reports({ token }: ReportsProps) {
  const [reportType, setReportType] = useState<ReportType>('sales')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailRecipient, setEmailRecipient] = useState('')
  const [emailFrequency, setEmailFrequency] = useState<'daily' | 'weekly'>('daily')

  useEffect(() => {
    const loadReport = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchReport(token, reportType, {
          ...(startDate ? { start_date: startDate } : {}),
          ...(endDate ? { end_date: endDate } : {}),
        })
        setReport(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load report data.')
      } finally {
        setLoading(false)
      }
    }

    void loadReport()
  }, [token, reportType, startDate, endDate])

  const reportSummary = useMemo(() => {
    if (!report) return null
    if (reportType === 'sales') {
      return (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-gray-500">Orders</p>
            <p className="mt-3 text-3xl font-semibold text-gray-900">{report.total_orders ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-gray-500">Revenue</p>
            <p className="mt-3 text-3xl font-semibold text-gray-900">UGX {(report.total_revenue ?? 0).toFixed(2)}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-gray-500">Status breakdown</p>
            <div className="mt-3 space-y-2 text-sm text-gray-700">
              {Array.isArray(report.orders_by_status) ? report.orders_by_status.map((item: any, index: number) => {
                const status = Object.keys(item)[0]
                return <div key={index}>{status}: {item[status]}</div>
              }) : null}
            </div>
          </div>
        </div>
      )
    }

    if (reportType === 'orders') {
      return (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-700">
              <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Amount</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(report.orders) ? report.orders.map((item: any) => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">{item.order_number || item.id}</td>
                    <td className="px-4 py-3">{item.status}</td>
                    <td className="px-4 py-3">UGX {item.amount != null ? item.amount.toFixed(2) : '0.00'}</td>
                  </tr>
                )) : null}
              </tbody>
            </table>
          </div>
        </div>
      )
    }

    if (reportType === 'products') {
      return (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-700">
              <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(report.products) ? report.products.map((item: any, index: number) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">{item.product_name}</td>
                    <td className="px-4 py-3">{item.stock}</td>
                    <td className="px-4 py-3">{item.status}</td>
                  </tr>
                )) : null}
              </tbody>
            </table>
          </div>
        </div>
      )
    }

    if (reportType === 'customers') {
      return (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-700">
              <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Orders</th>
                  <th className="px-4 py-3">Spend</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(report.customers) ? report.customers.map((item: any, index: number) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">{item.customer_name}</td>
                    <td className="px-4 py-3">{item.orders}</td>
                    <td className="px-4 py-3">UGX {item.total_spend?.toFixed(2) ?? '0.00'}</td>
                  </tr>
                )) : null}
              </tbody>
            </table>
          </div>
        </div>
      )
    }

    return null
  }, [report, reportType])

  const handleDownloadReport = async (format: 'csv' | 'excel') => {
    try {
      const url = new URL(`${import.meta.env.VITE_API_BASE_URL ?? ''}/api/admin/reports/${reportType}/`)
      if (startDate) url.searchParams.set('start_date', startDate)
      if (endDate) url.searchParams.set('end_date', endDate)
      url.searchParams.set('format', format)
      const response = await fetch(url.toString(), {
        headers: new Headers({ Authorization: `Bearer ${token}` }),
      })
      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || 'Unable to download report.')
      }
      const blob = await response.blob()
      const extension = format === 'excel' ? 'xlsx' : 'csv'
      const filename = `${reportType}-report.${extension}`
      const tempUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = tempUrl
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(tempUrl)
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Unable to download report')
    }
  }

  const handleSendEmail = async () => {
    if (!emailRecipient) {
      notifyError('Enter an email address to send the report.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      await sendReportEmail(token, reportType, {
        email: emailRecipient,
        frequency: emailFrequency,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      })
      notifySuccess('Report email queued successfully.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send report email.')
      notifyError(err instanceof Error ? err.message : 'Unable to send report email.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-3 sm:p-6 lg:p-8">
      <div className="mb-6 sm:mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Reports</h2>
          <p className="text-gray-500 mt-1">Export or email scheduled summaries to keep your operations on track.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={reportType}
            onChange={(event) => setReportType(event.target.value as ReportType)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {reportTypes.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => handleDownloadReport('csv')}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <Download size={16} />
            Download CSV
          </button>
          <button
            type="button"
            onClick={() => handleDownloadReport('excel')}
            className="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 transition-colors"
          >
            <Download size={16} />
            Download Excel
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="space-y-4">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            <label className="block text-sm font-medium text-gray-700">
              Start date
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              End date
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>

          {error ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">{error}</div>
          ) : null}

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
              <div className="mt-4 space-y-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="h-12 rounded bg-gray-100 animate-pulse" />
                ))}
              </div>
            </div>
          ) : reportSummary}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <FileText size={20} className="text-blue-600" />
              <div>
                <p className="text-sm font-semibold text-gray-900">Schedule report emails</p>
                <p className="text-sm text-gray-500">Choose a frequency and send summary reports to your inbox.</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                Recipient
                <input
                  type="email"
                  value={emailRecipient}
                  onChange={(event) => setEmailRecipient(event.target.value)}
                  placeholder="admin@example.com"
                  className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <label className="block text-sm font-medium text-gray-700">
                Frequency
                <select
                  value={emailFrequency}
                  onChange={(event) => setEmailFrequency(event.target.value as 'daily' | 'weekly')}
                  className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="daily">Daily summary</option>
                  <option value="weekly">Weekly summary</option>
                </select>
              </label>

              <button
                type="button"
                onClick={handleSendEmail}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                <Send size={16} />
                Send Report Email
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

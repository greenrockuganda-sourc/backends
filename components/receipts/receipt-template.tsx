'use client'

import { Receipt } from '@/lib/types'
import { Download, Mail, Printer, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRef } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

interface ReceiptTemplateProps {
  receipt: Receipt
  onClose: () => void
}

const formatCurrency = (value: number) => `UGX ${value.toFixed(2)}`

export function ReceiptTemplate({ receipt, onClose }: ReceiptTemplateProps) {
  const receiptRef = useRef<HTMLDivElement>(null)

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadPDF = async () => {
    if (!receiptRef.current) return

    try {
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        useCORS: true,
      })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      })

      const imgWidth = 210
      const pageHeight = 297
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight
      let position = 0

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      pdf.save(`receipt-${receipt.receiptNumber}.pdf`)
    } catch (error) {
      console.error('Failed to download PDF:', error)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const formatOrderDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return {
      day: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      time: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    }
  }

  const orderDate = formatOrderDateTime(receipt.issuedAt)
  const displayName = receipt.customerName || 'Customer'

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-[1100px] max-h-[90vh] overflow-y-auto rounded-[20px] bg-[#eef3f7] shadow-2xl print:max-h-none print:rounded-none print:shadow-none">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-white/90 p-5 backdrop-blur-sm no-print">
          <h2 className="text-xl font-bold text-slate-900">Receipt Preview</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex gap-2 border-b border-border bg-[#f4f7fa] p-4 no-print">
          <Button variant="default" size="sm" onClick={handleDownloadPDF} className="gap-2">
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>

        <div ref={receiptRef} className="bg-[#edf2f5] p-0 text-slate-900">
          <div className="bg-[#0d2d48] px-8 pt-7 pb-5 text-white">
            <div className="flex items-start justify-between gap-5">
              <div>
                <div className="text-[62px] font-black tracking-[-0.08em] leading-none">GLOW</div>
                <div className="mt-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                  Salon supplies, delivered.
                </div>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f97316] shadow-lg shadow-orange-500/20">
                  <svg viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-white stroke-[2]" aria-hidden="true">
                    <path d="M3 4h2l2.4 9.1a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L19 7H7" />
                    <circle cx="10" cy="17.5" r="1.5" />
                    <circle cx="17" cy="17.5" r="1.5" />
                  </svg>
                </div>
                <div className="text-right">
                  <div className="text-[15px] font-bold text-[#ffb267]">Professional Products</div>
                  <div className="text-[15px] font-semibold text-slate-200">for a Brighter You</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#edf2f5] px-8 py-7">
            <div className="mb-6 flex items-start justify-between gap-8">
              <div className="flex-1">
                <div className="mb-4 flex items-center gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#f97316] text-lg font-bold text-white shadow-[0_10px_20px_rgba(249,115,22,0.25)]">
                    ✓
                  </span>
                  <span className="text-[18px] font-extrabold uppercase tracking-[0.12em] text-[#0d2d48]">Receipt</span>
                </div>

                <h2 className="text-[50px] font-black leading-[1.05] tracking-[-0.06em] text-slate-900">
                  Thank you
                  <span className="block text-[#f97316]">for your purchase!</span>
                </h2>

                <p className="mt-4 max-w-[540px] text-[18px] leading-8 text-slate-600">
                  Your order has been received and is being processed. We appreciate your trust in Glow.
                </p>
              </div>

              <div className="w-[320px] rounded-[18px] border border-[#dfe7ef] bg-[#edf3f7] p-5 shadow-sm">
                <div className="mb-4 text-[18px] font-extrabold text-slate-900">Your Receipt</div>
                <div className="mb-3 flex items-center gap-3 text-[14px] text-slate-700">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#dfeaf3] text-[#0d2d48] text-[11px]">●</span>
                  <span className="font-medium">Glow Salon Supplies</span>
                </div>
                <div className="mb-3 flex items-center gap-3 text-[14px] text-slate-700">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#dfeaf3] text-[#0d2d48] text-[11px]">●</span>
                  <span>Kampala, Uganda</span>
                </div>
                <div className="mb-4 flex items-center gap-3 text-[14px] text-slate-700">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#dfeaf3] text-[#0d2d48] text-[11px]">●</span>
                  <span>+256 700 123 456</span>
                </div>
                <div className="mb-4 flex items-center gap-3 text-[14px] text-slate-700">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#dfeaf3] text-[#0d2d48] text-[11px]">●</span>
                  <span>support@glow.ug</span>
                </div>

                <div className="ml-auto flex h-[110px] w-[110px] items-center justify-center rounded-[12px] bg-white p-2 shadow-inner ring-1 ring-slate-200">
                  <div className="grid h-full w-full grid-cols-5 gap-[3px] bg-slate-900 p-[8px]">
                    {Array.from({ length: 25 }, (_, index) => (
                      <span
                        key={index}
                        className={`block h-[6px] w-[6px] ${index % 2 === 0 ? 'bg-slate-900' : 'bg-white'}`}
                      />
                    ))}
                  </div>
                </div>

                <div className="mt-3 text-center text-[12px] font-semibold text-slate-700">
                  Scan for<br />order updates
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 rounded-[18px] bg-[#dfeaf3] p-4 text-slate-700">
              <div className="flex items-center gap-3 rounded-[12px] bg-[#edf4f9] p-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#dfeaf3] text-[18px]">🧾</span>
                <div>
                  <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-500">Order Number</div>
                  <div className="mt-1 text-[18px] font-extrabold text-slate-900">#{receipt.receiptNumber}</div>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-[12px] bg-[#edf4f9] p-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#dfeaf3] text-[18px]">📅</span>
                <div>
                  <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-500">Order Date</div>
                  <div className="mt-1 text-[16px] font-extrabold text-slate-900">{orderDate.day}</div>
                  <div className="text-[12px] text-slate-600">{orderDate.time}</div>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-[12px] bg-[#edf4f9] p-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#dfeaf3] text-[18px]">💳</span>
                <div>
                  <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-500">Payment Method</div>
                  <div className="mt-1 text-[18px] font-extrabold text-slate-900">{receipt.paymentMethod || 'Mobile Money'}</div>
                </div>
              </div>
            </div>

            <div className="mt-7 overflow-hidden rounded-[14px] border border-[#dfe7ef] bg-white">
              <div className="grid grid-cols-[1.6fr_0.5fr_0.7fr_0.7fr] bg-[#0d2d48] px-4 py-3 text-[12px] font-bold uppercase tracking-[0.12em] text-white">
                <div>Item</div>
                <div className="text-center">Qty</div>
                <div className="text-right">Unit Price</div>
                <div className="text-right">Total</div>
              </div>

              {receipt.items && receipt.items.length > 0 ? (
                receipt.items.map((item, index) => (
                  <div key={`${item.id || index}`} className="grid grid-cols-[1.6fr_0.5fr_0.7fr_0.7fr] border-t border-[#e5edf4] px-4 py-4 text-[15px] text-slate-700 last:border-b-0">
                    <div>
                      <div className="font-extrabold text-slate-900">{item.productName}</div>
                      <div className="mt-2 text-[12px] text-slate-500">
                        {item.productName.includes('Hair') ? 'Hair Care' : 'Professional Grade'}
                      </div>
                    </div>
                    <div className="text-center font-semibold text-slate-700">{item.quantity}</div>
                    <div className="text-right font-semibold text-slate-700">{formatCurrency(item.price)}</div>
                    <div className="text-right font-semibold text-slate-800">{formatCurrency(item.total)}</div>
                  </div>
                ))
              ) : (
                <div className="px-4 py-5 text-slate-500">No item details available.</div>
              )}

              <div className="border-t border-[#e5edf4] bg-[#f8fafc] px-5 py-4 text-[15px] text-slate-700">
                <div className="ml-auto max-w-[260px] space-y-2 text-right">
                  <div className="flex items-center justify-between">
                    <span>Subtotal (3 items)</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(receipt.subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Delivery Fee</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(receipt.shipping)}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded-[10px] bg-[#f7d6ad] px-4 py-3 text-[22px] font-extrabold text-slate-900">
                    <span>Total Paid</span>
                    <span>{formatCurrency(receipt.total)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-5">
              <div className="rounded-[14px] border border-[#dfe7ef] bg-[#dfeaf3] p-5">
                <div className="mb-3 flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f97316] text-[18px]">🚚</span>
                  <span className="text-[20px] font-extrabold text-slate-900">Delivery Information</span>
                </div>
                <div className="mt-3 text-[16px] font-bold text-slate-900">Estimated Delivery Date</div>
                <div className="mt-1 text-[20px] font-black text-slate-900">{formatDate(receipt.issuedAt)}</div>
                <div className="mt-3 inline-block rounded-full bg-[#dbeafe] px-3 py-1 text-[12px] font-bold uppercase tracking-[0.12em] text-sky-800">
                  Processing
                </div>
                <p className="mt-4 text-[14px] leading-6 text-slate-600">
                  You’ll receive a notification once your order is out for delivery.
                </p>
              </div>

              <div className="rounded-[14px] border border-[#dfe7ef] bg-[#dfeaf3] p-5">
                <div className="mb-3 flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f97316] text-[18px]">🧾</span>
                  <span className="text-[20px] font-extrabold text-slate-900">Order Summary</span>
                </div>

                <div className="space-y-3 text-[15px] text-slate-700">
                  <div className="flex items-center justify-between">
                    <span>Items Total</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(receipt.subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Delivery Fee</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(receipt.shipping)}</span>
                  </div>
                  <div className="mt-4 border-t border-slate-300 pt-3 text-[22px] font-extrabold text-slate-900">
                    <div className="flex items-center justify-between">
                      <span>Total Paid</span>
                      <span>{formatCurrency(receipt.total)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between gap-5 rounded-[16px] bg-[#0d2d48] px-6 py-5 text-white">
              <div className="flex items-center gap-3">
                <span className="text-[18px] font-extrabold">Need help?</span>
                <span className="text-[14px] text-slate-300">Our support team is here for you.</span>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-5 text-[14px] text-slate-200">
                <span>+256 700 123 456</span>
                <span>support@glow.ug</span>
                <span>Mon - Fri, 8AM - 6PM</span>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between border-t border-slate-300 pt-6">
              <div className="text-[48px] font-black tracking-[-0.08em] text-slate-900">GLOW</div>
              <div className="flex items-center gap-6 text-[14px] font-medium text-slate-700">
                <span>Quality Products</span>
                <span>Secure Payments</span>
                <span>Fast Delivery</span>
              </div>
            </div>

            <div className="mt-3 text-center text-[12px] text-slate-500">
              © 2025 Glow. All rights reserved.<br />
              Professional products. Better results.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

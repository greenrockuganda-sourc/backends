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
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto print:shadow-none print:rounded-none print:max-w-none print:max-h-none print:p-0">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-border flex items-center justify-between p-6 no-print">
          <h2 className="text-xl font-bold text-foreground">Receipt Preview</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Actions */}
        <div className="bg-muted/50 p-4 flex gap-2 no-print">
          <Button
            variant="default"
            size="sm"
            onClick={handleDownloadPDF}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="gap-2"
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>

        {/* Receipt Content */}
        <div ref={receiptRef} className="receipt-container p-8 bg-white">
          {/* Company Header */}
          <div className="text-center mb-10 pb-8 border-b-2 border-foreground/20">
            <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 bg-primary/10 rounded-lg border border-primary/30">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">SA</span>
              </div>
              <h1 className="text-2xl font-bold text-foreground">Seller Admin</h1>
            </div>
            <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wide mb-4">
              Official Receipt
            </p>
            <p className="text-lg font-bold text-foreground mb-1">
              {receipt.receiptNumber}
            </p>
            <p className="text-xs text-muted-foreground">
              Issued: {formatDate(receipt.issuedAt)}
            </p>
          </div>

          {/* Customer Information */}
          <div className="grid grid-cols-2 gap-8 mb-8 pb-8 border-b border-border/30">
            <div className="bg-muted/20 p-4 rounded-lg">
              <h3 className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wide">
                Bill To
              </h3>
              <p className="font-bold text-foreground text-base mb-2">{receipt.customerName}</p>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p className="break-all">{receipt.customerEmail}</p>
                <p>{receipt.customerPhone}</p>
              </div>
            </div>
            <div className="bg-muted/20 p-4 rounded-lg">
              <h3 className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wide">
                Transaction Details
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-semibold text-foreground">Order ID:</span>
                  <span className="text-foreground font-mono">{receipt.orderId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-foreground">Payment:</span>
                  <span className="text-foreground">{receipt.paymentMethod}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-10">
            <h3 className="text-xs font-bold text-muted-foreground mb-4 uppercase tracking-wide">
              Items Purchased
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t-2 border-b-2 border-foreground/30 bg-muted/30">
                  <th className="text-left py-4 font-bold text-foreground">Description</th>
                  <th className="text-center py-4 font-bold text-foreground w-16">Qty</th>
                  <th className="text-right py-4 font-bold text-foreground w-28">Unit Price</th>
                  <th className="text-right py-4 font-bold text-foreground w-28">Amount</th>
                </tr>
              </thead>
              <tbody>
                {receipt.items.map((item, index) => (
                  <tr key={index} className="border-b border-border/20 hover:bg-muted/10">
                    <td className="py-4 text-foreground font-medium">{item.productName}</td>
                    <td className="text-center py-4 text-foreground">{item.quantity}</td>
                    <td className="text-right py-4 text-foreground">
                      ${item.price.toFixed(2)}
                    </td>
                    <td className="text-right py-4 text-foreground font-bold">
                      ${item.total.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end mb-10 pb-10 border-b border-border/30">
            <div className="w-72">
              <div className="space-y-3 mb-4 p-4 bg-muted/20 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="text-foreground font-semibold">${receipt.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax (included):</span>
                  <span className="text-foreground font-semibold">${receipt.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping:</span>
                  <span className="text-foreground font-semibold">${receipt.shipping.toFixed(2)}</span>
                </div>
                <div className="border-t border-border/30 pt-3 flex justify-between text-base font-bold">
                  <span className="text-foreground">Total Amount:</span>
                  <span className="text-primary text-lg">${receipt.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center space-y-4">
            <div className="pt-4 pb-6 border-t border-dashed border-border/30">
              <p className="text-sm font-semibold text-foreground mb-3">
                Thank you for your purchase!
              </p>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                This is an official receipt. Please keep it for your records.
                For inquiries, please contact customer service.
              </p>
              <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-4 border-t border-dashed border-border/30">
                <span>Receipt ID: {receipt.receiptNumber}</span>
                <span>•</span>
                <span>{receipt.issuedBy ? `Issued by: ${receipt.issuedBy}` : 'Seller Dashboard'}</span>
              </div>
            </div>
          </div>

          {/* Print-only footer */}
          <div className="hidden print:block text-center text-xs text-muted-foreground mt-8 pt-6 border-t border-foreground/10">
            <p>Printed on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

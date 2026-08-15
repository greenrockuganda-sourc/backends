'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle,
  Download,
  Mail,
  Trash2,
  X,
  AlertCircle,
} from 'lucide-react'

interface OrderBulkActionsProps {
  selectedCount: number
  onClearSelection: () => void
  selectedOrderIds: string[]
}

export function OrderBulkActions({
  selectedCount,
  onClearSelection,
  selectedOrderIds,
}: OrderBulkActionsProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [actionMessage, setActionMessage] = useState('')

  const handleBulkStatusUpdate = async (status: string) => {
    setIsLoading(true)
    setActionMessage(`Updating ${selectedCount} orders to ${status}...`)
    
    try {
      // This would call your Django API
      // await djangoOrdersApi.bulkUpdate(selectedOrderIds.map(id => ({ id, status })))
      await new Promise(resolve => setTimeout(resolve, 1000))
      setActionMessage(`Successfully updated ${selectedCount} orders`)
      setTimeout(() => {
        setActionMessage('')
        onClearSelection()
      }, 2000)
    } catch (error) {
      setActionMessage('Failed to update orders')
    } finally {
      setIsLoading(false)
    }
  }

  const handleExport = async () => {
    setIsLoading(true)
    setActionMessage('Exporting orders...')
    
    try {
      // This would call your export API
      await new Promise(resolve => setTimeout(resolve, 1000))
      setActionMessage('Orders exported successfully')
      setTimeout(() => setActionMessage(''), 2000)
    } catch (error) {
      setActionMessage('Failed to export orders')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendNotification = async () => {
    setIsLoading(true)
    setActionMessage(`Sending notifications to ${selectedCount} customers...`)
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1000))
      setActionMessage('Notifications sent successfully')
      setTimeout(() => setActionMessage(''), 2000)
    } catch (error) {
      setActionMessage('Failed to send notifications')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {selectedCount} selected
            </span>
            {actionMessage && (
              <Badge variant="secondary" className="text-xs">
                {actionMessage}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Update Buttons */}
          <div className="hidden sm:flex items-center gap-1 border-r border-blue-500/20 pr-2 mr-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkStatusUpdate('confirmed')}
              disabled={isLoading}
              className="text-xs"
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Confirm
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkStatusUpdate('shipped')}
              disabled={isLoading}
              className="text-xs"
            >
              Ship
            </Button>
          </div>

          {/* Other Actions */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            disabled={isLoading}
            className="gap-1 text-xs"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleSendNotification}
            disabled={isLoading}
            className="gap-1 text-xs"
          >
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Notify</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={onClearSelection}
            disabled={isLoading}
            className="gap-1 text-xs"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

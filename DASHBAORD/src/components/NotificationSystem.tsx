import { useState } from 'react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'

export interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
}

interface NotificationSystemProps {
  notifications: Notification[]
  onDismiss: (id: string) => void
}

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

const colorMap = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
}

const iconColorMap = {
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-yellow-500',
  info: 'text-blue-500',
}

export default function NotificationSystem({ notifications, onDismiss }: NotificationSystemProps) {
  return (
    <div className="fixed top-4 right-4 z-50 flex max-h-screen w-full max-w-sm flex-col gap-2">
      {notifications.map((notification) => {
        const Icon = iconMap[notification.type]
        return (
          <div
            key={notification.id}
            className={`flex items-start gap-3 rounded-lg border p-4 shadow-lg transition-all duration-300 ${colorMap[notification.type]}`}
            style={{
              animation: 'slideIn 0.3s ease-out',
            }}
          >
            <Icon className={`h-5 w-5 flex-shrink-0 ${iconColorMap[notification.type]}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{notification.title}</p>
              {notification.message && (
                <p className="mt-1 text-sm opacity-90">{notification.message}</p>
              )}
            </div>
            <button
              onClick={() => onDismiss(notification.id)}
              className="flex-shrink-0 rounded-lg p-1 hover:bg-black/5 transition-colors"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

// Hook for managing notifications
export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const addNotification = (notification: Omit<Notification, 'id'>) => {
    const id = `notification-${Date.now()}-${Math.random()}`;
    const newNotification = { ...notification, id };
    
    setNotifications((prev) => [...prev, newNotification])

    const duration = notification.duration ?? 5000
    if (duration > 0) {
      setTimeout(() => {
        dismissNotification(id)
      }, duration)
    }

    return id
  }

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const clearAll = () => {
    setNotifications([])
  }

  return {
    notifications,
    addNotification,
    dismissNotification,
    clearAll,
  }
}
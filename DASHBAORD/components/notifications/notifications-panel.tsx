'use client'

import { useEffect, useState } from 'react'
import { Notification, notificationsStore } from '@/lib/notifications'
import { Button } from '@/components/ui/button'
import { Bell, X, CheckCheck, Trash2, Info, AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react'

export function NotificationsPanel() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setNotifications(notificationsStore.getAll())

    const unsubscribe = notificationsStore.subscribe((updatedNotifications) => {
      setNotifications(updatedNotifications)
    })

    return () => unsubscribe()
  }, [])

  if (!mounted) return null

  const unreadCount = notifications.filter(n => !n.read).length
  const hasNotifications = notifications.length > 0

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'error':
        return <AlertCircle className="h-5 w-5 text-destructive" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />
      default:
        return <Info className="h-5 w-5 text-blue-600" />
    }
  }

  return (
    <div className="relative">
      {/* Notification Bell Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="relative hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full animate-pulse" />
        )}
      </Button>

      {/* Notifications Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-12 w-96 max-h-96 bg-card rounded-lg border border-border shadow-xl overflow-hidden z-50 flex flex-col">
          {/* Header */}
          <div className="bg-muted/30 border-b border-border p-4 flex items-center justify-between sticky top-0">
            <div>
              <h3 className="font-semibold text-foreground">Notifications</h3>
              {unreadCount > 0 && (
                <p className="text-xs text-muted-foreground">{unreadCount} unread</p>
              )}
            </div>
            <div className="flex gap-1">
              {hasNotifications && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => notificationsStore.markAllAsRead()}
                  className="text-xs h-8 px-2"
                >
                  <CheckCheck className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Notifications List */}
          {notifications.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-center">
              <div>
                <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-sm text-muted-foreground">No notifications yet</p>
              </div>
            </div>
          ) : (
            <div className="overflow-y-auto flex-1">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border-b border-border hover:bg-muted/30 transition-colors cursor-pointer ${
                    !notification.read ? 'bg-muted/10' : ''
                  }`}
                  onClick={() => {
                    notificationsStore.markAsRead(notification.id)
                  }}
                >
                  <div className="flex gap-3">
                    <div className="mt-1 flex-shrink-0">{getIcon(notification.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm text-foreground">
                          {notification.title}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 -mr-2"
                          onClick={(e) => {
                            e.stopPropagation()
                            notificationsStore.remove(notification.id)
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(notification.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          {hasNotifications && (
            <div className="bg-muted/20 border-t border-border p-3 text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => notificationsStore.clear()}
                className="text-xs"
              >
                Clear all
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

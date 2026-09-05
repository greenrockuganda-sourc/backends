export interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  timestamp: Date
  read: boolean
  actionUrl?: string
  icon?: React.ReactNode
}

// In-memory store for notifications
let notifications: Notification[] = []
let listeners: Set<(notifications: Notification[]) => void> = new Set()

export const notificationsStore = {
  getAll() {
    return notifications
  },

  getUnread() {
    return notifications.filter(n => !n.read)
  },

  add(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) {
    const newNotification: Notification = {
      ...notification,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      read: false,
    }
    notifications.unshift(newNotification)
    if (notifications.length > 50) {
      notifications = notifications.slice(0, 50)
    }
    this.notify()
    return newNotification
  },

  markAsRead(id: string) {
    const notification = notifications.find(n => n.id === id)
    if (notification) {
      notification.read = true
      this.notify()
    }
  },

  markAllAsRead() {
    notifications.forEach(n => n.read = true)
    this.notify()
  },

  remove(id: string) {
    notifications = notifications.filter(n => n.id !== id)
    this.notify()
  },

  clear() {
    notifications = []
    this.notify()
  },

  subscribe(listener: (notifications: Notification[]) => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  private notify() {
    listeners.forEach(listener => listener([...notifications]))
  },
}

// Helper functions for common notifications
export const createNotification = {
  success(title: string, message: string) {
    return notificationsStore.add({
      type: 'success',
      title,
      message,
    })
  },

  error(title: string, message: string) {
    return notificationsStore.add({
      type: 'error',
      title,
      message,
    })
  },

  warning(title: string, message: string) {
    return notificationsStore.add({
      type: 'warning',
      title,
      message,
    })
  },

  info(title: string, message: string) {
    return notificationsStore.add({
      type: 'info',
      title,
      message,
    })
  },

  lowStock(productName: string, quantity: number) {
    return notificationsStore.add({
      type: 'warning',
      title: 'Low Stock Alert',
      message: `${productName} has only ${quantity} units remaining`,
    })
  },

  orderPlaced(orderNumber: string, customerName: string) {
    return notificationsStore.add({
      type: 'success',
      title: 'New Order',
      message: `Order ${orderNumber} from ${customerName} has been placed`,
    })
  },

  orderShipped(orderNumber: string) {
    return notificationsStore.add({
      type: 'info',
      title: 'Order Shipped',
      message: `Order ${orderNumber} has been shipped`,
    })
  },

  deliveryCompleted(orderNumber: string) {
    return notificationsStore.add({
      type: 'success',
      title: 'Delivery Complete',
      message: `Order ${orderNumber} has been delivered`,
    })
  },
}

self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : {}
  const title = payload.title || 'Glow Salon Supplies'
  const options = {
    body: payload.message || 'You have a new notification.',
    icon: '/icon-light-32x32.png',
    badge: '/icon-light-32x32.png',
    data: payload.data || {},
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const destination = event.notification.data?.url || '/'
  event.waitUntil(clients.openWindow(destination))
})

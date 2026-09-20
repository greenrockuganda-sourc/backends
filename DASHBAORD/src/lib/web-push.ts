import { registerBrowserPushSubscription } from '@/lib/api'

declare global {
  interface Window {
    __GLOW_RUNTIME_CONFIG__?: {
      vapidPublicKey?: string
    }
  }
}

function decodeVapidPublicKey(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from(raw, (character) => character.charCodeAt(0))
}

export async function enableBrowserPushNotifications(accessToken: string) {
  const vapidPublicKey = (
    window.__GLOW_RUNTIME_CONFIG__?.vapidPublicKey
    || import.meta.env.VITE_VAPID_PUBLIC_KEY
    || ''
  ).trim()
  if (!vapidPublicKey || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false
  }

  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission()
  if (permission !== 'granted') {
    return false
  }

  const registration = await navigator.serviceWorker.register('/sw.js')
  const subscription = await registration.pushManager.getSubscription()
    || await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeVapidPublicKey(vapidPublicKey),
    })

  await registerBrowserPushSubscription(accessToken, subscription.toJSON())
  return true
}

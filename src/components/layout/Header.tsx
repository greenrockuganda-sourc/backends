import { Menu, Bell, User, LogOut } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { fetchNotifications, markNotificationRead, sendNewArrivalNotification } from '@/lib/api'

interface HeaderProps {
  onMenuClick: () => void
  user?: any
  token: string
  onLogout: () => void
  onProfileClick?: () => void
}

export default function Header({ onMenuClick, user, token, onLogout, onProfileClick }: HeaderProps) {
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNewArrivalForm, setShowNewArrivalForm] = useState(false)
  const [arrivalTitle, setArrivalTitle] = useState('New arrival at Glow')
  const [arrivalMessage, setArrivalMessage] = useState('')
  const [arrivalStatus, setArrivalStatus] = useState<string | null>(null)
  const [sendingArrival, setSendingArrival] = useState(false)

  const loadNotifications = useCallback(async () => {
    try {
      const data = await fetchNotifications(token)
      setNotifications(Array.isArray(data) ? data : [])
    } catch {
      // The dashboard remains usable when the notification service is unavailable.
    }
  }, [token])

  useEffect(() => {
    void loadNotifications()
    const refresh = window.setInterval(() => void loadNotifications(), 30000)
    return () => window.clearInterval(refresh)
  }, [loadNotifications])

  const unreadCount = notifications.filter((notification) => !notification.is_read).length

  const openNotifications = () => {
    setShowNotifications((visible) => !visible)
    setShowUserMenu(false)
    if (!showNotifications) void loadNotifications()
  }

  const readNotification = async (notification: any) => {
    if (notification.is_read) return
    setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, is_read: true } : item))
    try {
      await markNotificationRead(token, notification.id)
    } catch {
      void loadNotifications()
    }
  }

  const sendNewArrival = async () => {
    const message = arrivalMessage.trim()
    if (!message) {
      setArrivalStatus('Enter a message for your customers.')
      return
    }
    setSendingArrival(true)
    setArrivalStatus(null)
    try {
      const result = await sendNewArrivalNotification(token, arrivalTitle.trim() || 'New arrival at Glow', message)
      setArrivalStatus(`Sent to ${result.recipient_count} customer${result.recipient_count === 1 ? '' : 's'}.`)
      setArrivalMessage('')
      setShowNewArrivalForm(false)
    } catch (error) {
      setArrivalStatus(error instanceof Error ? error.message : 'Could not send the notification.')
    } finally {
      setSendingArrival(false)
    }
  }

  const displayName = user ? [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || 'Seller' : 'Seller'
  const initials = (displayName || 'S')
    .split(' ')
    .map((part: string) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <header className="sticky-header border-b border-blue-800 bg-blue-900 px-3 py-2 sm:px-6 sm:py-3">
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 hover:bg-blue-800 rounded-lg transition-colors"
            aria-label="Open menu"
          >
            <Menu size={22} className="text-white" />
          </button>
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="h-9 w-9 sm:h-12 sm:w-12 rounded-lg bg-white/10 p-1 flex-shrink-0">
              <img src="https://res.cloudinary.com/h78tlu47/image/upload/v1784708343/icon_sotujz.jpg" alt="Glow logo" className="h-full w-full rounded-lg object-contain" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base sm:text-lg md:text-2xl font-bold text-white">Glow</h1>
              <p className="hidden text-xs text-blue-200 sm:block">Dashboard</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-4">
          <div className="relative">
          <button onClick={openNotifications} className="relative p-2 text-blue-100 hover:bg-blue-800 rounded-lg transition-colors" aria-label="Notifications" aria-expanded={showNotifications}>
            <Bell size={20} />
            {unreadCount > 0 && <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-400 px-1 text-[10px] font-bold text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-[min(24rem,calc(100vw-1.5rem))] rounded-xl border border-gray-200 bg-white p-3 text-gray-900 shadow-xl z-50">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="font-semibold">Notifications</p>
                <button onClick={() => { setShowNewArrivalForm((value) => !value); setArrivalStatus(null) }} className="rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">New arrival</button>
              </div>
              {showNewArrivalForm && (
                <div className="mb-3 rounded-lg bg-blue-50 p-3">
                  <p className="mb-2 text-xs text-blue-800">Each customer receives this message addressed by their first name.</p>
                  <input value={arrivalTitle} onChange={(event) => setArrivalTitle(event.target.value)} maxLength={255} className="mb-2 w-full rounded-md border border-blue-200 bg-white px-2 py-1.5 text-sm" aria-label="Notification title" />
                  <textarea value={arrivalMessage} onChange={(event) => setArrivalMessage(event.target.value)} maxLength={1000} className="min-h-20 w-full rounded-md border border-blue-200 bg-white px-2 py-1.5 text-sm" placeholder="e.g. Karseell shampoo is now in stock." aria-label="New-arrival message" />
                  <button disabled={sendingArrival} onClick={() => void sendNewArrival()} className="mt-2 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">{sendingArrival ? 'Sending…' : 'Send notification'}</button>
                </div>
              )}
              {arrivalStatus && <p className="mb-2 text-xs text-blue-700">{arrivalStatus}</p>}
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? <p className="px-1 py-4 text-sm text-gray-500">No notifications yet.</p> : notifications.slice(0, 20).map((notification) => (
                  <button key={notification.id} onClick={() => void readNotification(notification)} className={`block w-full border-t border-gray-100 px-1 py-2 text-left ${notification.is_read ? 'opacity-70' : 'bg-blue-50/60'}`}>
                    <p className="text-sm font-semibold">{notification.title}</p>
                    <p className="mt-0.5 text-xs leading-5 text-gray-600">{notification.message}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
          </div>

          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1.5 sm:p-2 hover:bg-blue-800 rounded-lg transition-colors"
              aria-label="User menu"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 bg-white text-blue-900 rounded-full flex items-center justify-center font-bold text-sm">
                {initials}
              </div>
              <span className="hidden text-sm font-medium text-white md:inline">{displayName}</span>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 z-50 slide-up">
                <div className="p-4 border-b border-gray-200">
                  <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
                  <p className="text-xs text-gray-500 truncate">{user?.email || 'seller@example.com'}</p>
                </div>
                <button onClick={() => { onProfileClick?.(); setShowUserMenu(false) }} className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  <User size={16} />
                  Profile
                </button>
                <button
                  onClick={() => { onLogout(); setShowUserMenu(false) }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-blue-600 hover:bg-blue-50 border-t border-gray-200 transition-colors"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

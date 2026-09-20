import { Menu, Bell, User, LogOut } from 'lucide-react'
import { useState } from 'react'

interface HeaderProps {
  onMenuClick: () => void
  user?: any
  onLogout: () => void
  onProfileClick?: () => void
  notifications?: any[]
  onNotificationRead?: (notificationId: string) => void
  onEnableBrowserPush?: () => void
  onCustomerBroadcast?: (title: string, message: string) => Promise<{ recipients: number }>
}

export default function Header({ onMenuClick, user, onLogout, onProfileClick, notifications = [], onNotificationRead, onEnableBrowserPush, onCustomerBroadcast }: HeaderProps) {
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showBroadcastForm, setShowBroadcastForm] = useState(false)
  const [broadcastTitle, setBroadcastTitle] = useState('')
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [broadcastStatus, setBroadcastStatus] = useState('')
  const [sendingBroadcast, setSendingBroadcast] = useState(false)

  const displayName = user ? [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || 'Seller' : 'Seller'
  const initials = (displayName || 'S')
    .split(' ')
    .map((part: string) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const unreadNotifications = notifications.filter((notification) => !notification.is_read)

  const submitBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastMessage.trim() || !onCustomerBroadcast) return
    setSendingBroadcast(true)
    setBroadcastStatus('')
    try {
      const result = await onCustomerBroadcast(broadcastTitle.trim(), broadcastMessage.trim())
      setBroadcastStatus(`Sent to ${result.recipients} customer${result.recipients === 1 ? '' : 's'}.`)
      setBroadcastTitle('')
      setBroadcastMessage('')
    } catch {
      setBroadcastStatus('Unable to send customer notification.')
    } finally {
      setSendingBroadcast(false)
    }
  }

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
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 text-blue-100 hover:bg-blue-800 rounded-lg transition-colors"
              aria-label="Notifications"
            >
              <Bell size={20} />
              {unreadNotifications.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-400 rounded-full" />}
            </button>
            {showNotifications && (
              <div className="absolute right-0 mt-2 max-h-96 w-80 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg z-50">
                <div className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-900">Notifications</div>
                {typeof Notification !== 'undefined' && Notification.permission !== 'granted' && (
                  <button
                    onClick={onEnableBrowserPush}
                    className="m-3 w-[calc(100%-1.5rem)] rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800"
                  >
                    Enable background alerts
                  </button>
                )}
                <button
                  onClick={() => setShowBroadcastForm(!showBroadcastForm)}
                  className="mx-3 mb-3 w-[calc(100%-1.5rem)] rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                >
                  Notify customers
                </button>
                {showBroadcastForm && (
                  <div className="border-y border-gray-100 bg-gray-50 p-3">
                    <input
                      value={broadcastTitle}
                      onChange={(event) => setBroadcastTitle(event.target.value)}
                      placeholder="Notification title"
                      className="mb-2 w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
                    />
                    <textarea
                      value={broadcastMessage}
                      onChange={(event) => setBroadcastMessage(event.target.value)}
                      placeholder="Message for all customers"
                      rows={3}
                      className="mb-2 w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
                    />
                    <button
                      disabled={sendingBroadcast || !broadcastTitle.trim() || !broadcastMessage.trim()}
                      onClick={() => void submitBroadcast()}
                      className="w-full rounded bg-blue-700 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {sendingBroadcast ? 'Sending…' : 'Send to customers'}
                    </button>
                    {broadcastStatus && <p className="mt-2 text-xs text-gray-600">{broadcastStatus}</p>}
                  </div>
                )}
                {notifications.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-gray-500">No notifications yet.</p>
                ) : notifications.slice(0, 20).map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => onNotificationRead?.(String(notification.id))}
                    className={`block w-full border-b border-gray-100 px-4 py-3 text-left hover:bg-blue-50 ${notification.is_read ? 'bg-white' : 'bg-blue-50/70'}`}
                  >
                    <p className="text-sm font-semibold text-gray-900">{notification.title}</p>
                    <p className="mt-1 text-xs text-gray-600">{notification.message}</p>
                  </button>
                ))}
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

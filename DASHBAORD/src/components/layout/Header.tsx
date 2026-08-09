import { Menu, Bell, User, LogOut } from 'lucide-react'
import { useState } from 'react'

interface HeaderProps {
  onMenuClick: () => void
  user?: any
  onLogout: () => void
  onProfileClick?: () => void
}

export default function Header({ onMenuClick, user, onLogout, onProfileClick }: HeaderProps) {
  const [showUserMenu, setShowUserMenu] = useState(false)

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
          <button className="relative p-2 text-blue-100 hover:bg-blue-800 rounded-lg transition-colors" aria-label="Notifications">
            <Bell size={20} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-400 rounded-full"></span>
          </button>

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
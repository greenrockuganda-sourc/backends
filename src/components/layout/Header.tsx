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
    <header className="border-b border-gray-200 bg-white px-3 py-3 sm:px-6 sm:py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
          >
            <Menu size={24} className="text-gray-700" />
          </button>
          <div className="flex items-center gap-3">
            <img src="https://res.cloudinary.com/h78tlu47/image/upload/v1784708343/icon_sotujz.jpg" alt="Glow logo" className="h-12 w-12 rounded-lg object-contain bg-violet-50 p-1" />
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold text-gray-900 sm:text-2xl">Glow</h1>
              <p className="hidden text-xs text-gray-500 sm:block">Dashboard</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <button className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <Bell size={20} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                {initials}
              </div>
              <span className="hidden text-sm font-medium text-gray-900 sm:inline">{displayName}</span>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <div className="p-4 border-b border-gray-200">
                  <p className="text-sm font-medium text-gray-900">{displayName}</p>
                  <p className="text-xs text-gray-500">{user?.email || 'seller@example.com'}</p>
                </div>
                <button onClick={() => onProfileClick?.()} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  <User size={16} />
                  Profile
                </button>
                <button
                  onClick={onLogout}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 border-t border-gray-200"
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

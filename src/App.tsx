import { useEffect, useState } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import Dashboard from '@/pages/Dashboard'
import Products from '@/pages/Products'
import Orders from '@/pages/Orders'
import Deliveries from '@/pages/Deliveries'
import Receipts from '@/pages/Receipts'
import Reports from '@/pages/Reports'
import Settings from '@/pages/Settings'
import Login from '@/pages/Login'
import { fetchProfile, registerAuthTokenUpdater } from '@/lib/api'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { UserProfile } from '@/types'
import { Home, Package, ShoppingCart, Truck, FileText, BarChart3, Settings as SettingsIcon } from 'lucide-react'
import NotificationSystem, { useNotifications } from '@/components/NotificationSystem'

type Page = 'dashboard' | 'products' | 'orders' | 'deliveries' | 'receipts' | 'reports' | 'settings'
type MobileNavId = Page | 'more'

const mobileNavItems: { id: MobileNavId; label: string; icon: typeof Home }[] = [
  { id: 'dashboard', label: 'Home', icon: Home },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'orders', label: 'Orders', icon: ShoppingCart },
  { id: 'deliveries', label: 'Deliveries', icon: Truck },
  { id: 'more', label: 'More', icon: BarChart3 },
]

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [accessToken, setAccessToken] = useState<string | null>(() => localStorage.getItem('access'))
  const [user, setUser] = useState<UserProfile | null>(() => {
    const stored = localStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  })
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const { notifications, dismissNotification } = useNotifications()

  useEffect(() => {
    registerAuthTokenUpdater((token) => {
      setAccessToken(token)
    })
  }, [])

  const clearAuthSession = () => {
    localStorage.removeItem('access')
    localStorage.removeItem('refresh')
    localStorage.removeItem('user')
    setAccessToken(null)
    setUser(null)
    setProfileError(null)
    setShowMoreMenu(false)
  }

  useEffect(() => {
    if (!accessToken) {
      return
    }

    let active = true
    setLoadingProfile(true)
    setProfileError(null)

    fetchProfile(accessToken)
      .then((profile) => {
        if (!active) {
          return
        }

        if (!profile || !profile.role || !['Seller', 'Admin'].includes(profile.role)) {
          clearAuthSession()
          return
        }

        setUser(profile)
        localStorage.setItem('user', JSON.stringify(profile))
      })
      .catch(() => {
        if (active) {
          clearAuthSession()
          setProfileError('Unable to load your profile from the server. Please sign in again.')
        }
      })
      .finally(() => {
        if (active) {
          setLoadingProfile(false)
        }
      })

    return () => {
      active = false
    }
  }, [accessToken])

  const handleLogin = (newAccessToken: string, refreshToken: string, profile: UserProfile) => {
    localStorage.setItem('access', newAccessToken)
    localStorage.setItem('refresh', refreshToken)
    localStorage.setItem('user', JSON.stringify(profile))
    setAccessToken(newAccessToken)
    setUser(profile)
  }

  const handleProfileSave = (updatedProfile: UserProfile) => {
    setUser(updatedProfile)
    localStorage.setItem('user', JSON.stringify(updatedProfile))
  }

  const handleLogout = () => {
    clearAuthSession()
  }

  const handleNavigate = (page: Page) => {
    setCurrentPage(page)
    setSidebarOpen(false)
    setShowMoreMenu(false)
  }

  if (!accessToken) {
    return <Login onLogin={handleLogin} />
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard token={accessToken} user={user} />
      case 'products':
        return <Products token={accessToken} />
      case 'orders':
        return <Orders token={accessToken} />
      case 'deliveries':
        return <Deliveries token={accessToken} />
      case 'receipts':
        return <Receipts token={accessToken} />
      case 'reports':
        return <Reports token={accessToken} />
      case 'settings':
        return <Settings token={accessToken} user={user} onProfileSave={handleProfileSave} />
      default:
        return <Dashboard token={accessToken} user={user} />
    }
  }

  const isMobileNavActive = (id: MobileNavId) => {
    if (id === 'more') {
      return ['receipts', 'reports', 'settings'].includes(currentPage)
    }
    return currentPage === id
  }

  const handleMobileNav = (id: MobileNavId) => {
    if (id === 'more') {
      setShowMoreMenu(!showMoreMenu)
      return
    }
    handleNavigate(id)
  }

  return (
    <div className="flex min-h-screen w-full overflow-x-hidden bg-gray-50">
      <Sidebar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} user={user} onLogout={handleLogout} onProfileClick={() => handleNavigate('settings')} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-20 lg:pb-0">
          {loadingProfile && (
            <div className="px-4 py-3 text-sm text-slate-600">Loading your account details...</div>
          )}
          {profileError && (
            <div className="mx-4 mt-4 rounded-lg border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              {profileError}
            </div>
          )}
          {renderPage()}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-bottom-nav lg:hidden no-print">
        {mobileNavItems.map((item) => {
          const Icon = item.icon
          const isActive = isMobileNavActive(item.id)
          return (
            <button
              key={item.id}
              onClick={() => handleMobileNav(item.id)}
              className={isActive ? 'active' : ''}
              aria-label={item.label}
            >
              <Icon />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Mobile "More" Menu */}
      {showMoreMenu && (
        <div className="fixed inset-0 z-50 lg:hidden no-print" onClick={() => setShowMoreMenu(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-4 pb-8 slide-up safe-bottom">
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4" />
            <p className="text-sm font-semibold text-gray-900 mb-3 px-2">More options</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'receipts' as Page, label: 'Receipts', icon: FileText },
                { id: 'reports' as Page, label: 'Reports', icon: BarChart3 },
                { id: 'settings' as Page, label: 'Settings', icon: SettingsIcon },
              ].map((item) => {
                const Icon = item.icon
                const isActive = currentPage === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigate(item.id)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl transition-colors ${
                      isActive ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon size={24} />
                    <span className="text-xs font-medium">{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <ToastContainer
        position="bottom-right"
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        pauseOnHover
        draggable
      />
      
      <NotificationSystem
        notifications={notifications}
        onDismiss={dismissNotification}
      />
    </div>
  )
}

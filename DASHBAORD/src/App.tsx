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

type Page = 'dashboard' | 'products' | 'orders' | 'deliveries' | 'receipts' | 'reports' | 'settings'

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

  useEffect(() => {
    registerAuthTokenUpdater((token) => {
      setAccessToken(token)
    })
  }, [])

  useEffect(() => {
    if (!accessToken) {
      return
    }

    let active = true
    setLoadingProfile(true)
    setProfileError(null)

    fetchProfile(accessToken)
      .then((profile) => {
        if (active) {
          setUser(profile)
          localStorage.setItem('user', JSON.stringify(profile))
        }
      })
      .catch(() => {
        if (active) {
          setProfileError('Unable to load your profile from the server.')
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
    localStorage.removeItem('access')
    localStorage.removeItem('refresh')
    localStorage.removeItem('user')
    setAccessToken(null)
    setUser(null)
    setProfileError(null)
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

  return (
    <div className="flex min-h-screen w-full overflow-x-hidden bg-gray-50">
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} user={user} onLogout={handleLogout} onProfileClick={() => setCurrentPage('settings')} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          {loadingProfile && (
            <div className="px-4 py-3 text-sm text-slate-600">Loading your account details...</div>
          )}
          {profileError && (
            <div className="mx-4 mt-4 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
              {profileError}
            </div>
          )}
          {renderPage()}
        </main>
      </div>
      <ToastContainer
        position="bottom-right"
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        pauseOnHover
        draggable
      />
    </div>
  )
}

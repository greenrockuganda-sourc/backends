import { Home, Package, ShoppingCart, Truck, FileText, Settings as SettingsIcon, X, BarChart3 } from 'lucide-react'

interface SidebarProps {
  currentPage: string
  onNavigate: (page: any) => void
  isOpen: boolean
  onClose: () => void
}

export default function Sidebar({ currentPage, onNavigate, isOpen, onClose }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'deliveries', label: 'Deliveries', icon: Truck },
    { id: 'receipts', label: 'Receipts', icon: FileText },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ]

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden fade-in"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:relative top-0 left-0 h-full w-[85vw] max-w-xs sm:w-72 bg-white border-r border-gray-200
        transform transition-transform duration-300 ease-in-out z-40 lg:z-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        flex flex-col shadow-2xl lg:shadow-none
      `}>
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-base sm:text-lg">SD</span>
            </div>
            <div className="min-w-0">
              <span className="font-bold text-gray-900 hidden sm:inline text-lg">Seller</span>
              <span className="font-bold text-gray-900 sm:hidden">Seller</span>
              <p className="text-xs text-gray-500 hidden sm:block">Dashboard</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="lg:hidden text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 px-3 sm:px-4 py-4 sm:py-6 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = currentPage === item.id
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id)
                  onClose()
                }}
                className={`
                  w-full flex items-center gap-3 px-3 sm:px-4 py-3 rounded-xl font-medium
                  transition-all duration-200 text-sm sm:text-base
                  ${isActive 
                    ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600 shadow-sm' 
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
              >
                <Icon size={20} className="flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-center">
            <p className="text-xs text-gray-500">Seller Dashboard</p>
            <p className="text-xs text-gray-400">v1.0.0</p>
          </div>
        </div>
      </aside>
    </>
  )
}
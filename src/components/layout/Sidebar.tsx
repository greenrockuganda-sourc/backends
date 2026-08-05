import { Home, Package, ShoppingCart, Truck, FileText, Settings as SettingsIcon, X } from 'lucide-react'

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
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ]

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:relative top-0 left-0 h-screen w-[85vw] max-w-xs sm:w-72 bg-white border-r border-gray-200
        transform transition-transform duration-300 z-40 lg:z-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        flex flex-col
      `}>
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">SD</span>
            </div>
            <span className="font-bold text-gray-900 hidden sm:inline">Seller</span>
          </div>
          <button 
            onClick={onClose}
            className="lg:hidden text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
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
                  w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium
                  transition-colors duration-200
                  ${isActive 
                    ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600' 
                    : 'text-gray-700 hover:bg-gray-50'
                  }
                `}
              >
                <Icon size={20} />
                <span>{item.label}</span>
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

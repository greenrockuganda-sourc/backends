'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  FileText,
  Settings,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/' },
  { icon: Package, label: 'Products', href: '/products' },
  { icon: ShoppingCart, label: 'Inventory', href: '/inventory' },
  { icon: ShoppingCart, label: 'Orders', href: '/orders' },
  { icon: Truck, label: 'Deliveries', href: '/deliveries' },
  { icon: FileText, label: 'Receipts', href: '/receipts' },
  { icon: Settings, label: 'Settings', href: '/settings' },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-card/50 backdrop-blur-sm">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
              <span className="text-primary-foreground font-bold text-base">SA</span>
            </div>
            <div>
              <h1 className="font-bold text-base text-foreground">Seller Admin</h1>
              <p className="text-xs text-muted-foreground">Management</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link key={item.href} href={item.href}>
                <button
                  className={cn(
                    'nav-link w-full',
                    isActive && 'active'
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-border p-4 space-y-3">
          <div className="px-2 py-2 rounded-lg bg-muted/30">
            <p className="text-xs font-semibold text-foreground">Status</p>
            <p className="text-xs text-muted-foreground mt-1">All systems online</p>
          </div>
          <p className="text-xs text-muted-foreground">v1.0.0</p>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 flex flex-col border-r border-border bg-card/95 backdrop-blur-md transform transition-transform md:hidden',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
              <span className="text-primary-foreground font-bold text-base">SA</span>
            </div>
            <div>
              <h1 className="font-bold text-base text-foreground">Seller Admin</h1>
              <p className="text-xs text-muted-foreground">Management</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link key={item.href} href={item.href} onClick={onClose}>
                <button
                  className={cn(
                    'nav-link w-full',
                    isActive && 'active'
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              </Link>
            )
          })}
        </nav>
      </aside>
    </>
  )
}

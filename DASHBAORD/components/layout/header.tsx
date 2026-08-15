'use client'

import { Menu, Settings, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NotificationsPanel } from '@/components/notifications/notifications-panel'

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
      <div className="flex h-16 items-center justify-between px-4 md:px-8">
        {/* Left Side */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="md:hidden hover:bg-muted"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold text-foreground hidden sm:block">
            Seller Admin
          </h1>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-1 md:gap-2">
          <div className="hidden sm:block">
            <NotificationsPanel />
          </div>
          <Button variant="ghost" size="icon" className="hidden sm:flex hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <Settings className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  )
}

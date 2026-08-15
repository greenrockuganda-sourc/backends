'use client'

import { LucideIcon } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  subtext: string
  loading?: boolean
}

export function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  loading,
}: StatCardProps) {
  return (
    <div className="stat-card group">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
          {loading ? (
            <Skeleton className="h-10 w-28 mt-3" />
          ) : (
            <p className="text-3xl font-bold text-foreground mt-3 tracking-tight">{value}</p>
          )}
          <p className="text-xs text-muted-foreground mt-2.5">{subtext}</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 p-4 group-hover:from-primary/30 group-hover:to-primary/10 transition-all duration-200">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </div>
    </div>
  )
}

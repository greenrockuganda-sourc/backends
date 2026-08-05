'use client'

import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Dashboard } from '@/components/dashboard/dashboard'

export default function Home() {
  return (
    <DashboardLayout>
      <Dashboard />
    </DashboardLayout>
  )
}

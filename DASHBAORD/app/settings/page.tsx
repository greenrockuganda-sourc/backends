'use client'

import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Save, LogOut } from 'lucide-react'
import { useState } from 'react'

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    storeName: 'My Store',
    email: 'admin@example.com',
    phone: '+1234567890',
    address: '123 Business St, City, State 12345',
    currency: 'USD',
    taxRate: '10',
    shippingRate: '5',
  })

  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-2">Manage your account and store settings</p>
        </div>

        {saved && (
          <div className="rounded-lg bg-success/10 border border-success p-4">
            <p className="text-success text-sm font-medium">Settings saved successfully!</p>
          </div>
        )}

        <div className="bg-card rounded-lg border border-border p-6 space-y-6">
          {/* Store Information */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Store Information</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">Store Name</label>
                <input
                  type="text"
                  value={settings.storeName}
                  onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-foreground bg-input"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Email</label>
                <input
                  type="email"
                  value={settings.email}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-foreground bg-input"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Phone</label>
                <input
                  type="tel"
                  value={settings.phone}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-foreground bg-input"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Address</label>
                <textarea
                  value={settings.address}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-foreground bg-input resize-none"
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Business Settings */}
          <div className="border-t border-border pt-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Business Settings</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground">Currency</label>
                <select
                  value={settings.currency}
                  onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-foreground bg-input"
                >
                  <option>USD</option>
                  <option>EUR</option>
                  <option>GBP</option>
                  <option>INR</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Tax Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={settings.taxRate}
                  onChange={(e) => setSettings({ ...settings, taxRate: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-foreground bg-input"
                />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-foreground">Shipping Rate ({settings.currency})</label>
                <input
                  type="number"
                  step="0.01"
                  value={settings.shippingRate}
                  onChange={(e) => setSettings({ ...settings, shippingRate: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-foreground bg-input"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="border-t border-border pt-6 flex gap-3">
            <Button onClick={handleSave} className="gap-2">
              <Save className="h-4 w-4" />
              Save Settings
            </Button>
            <Button variant="destructive" className="gap-2 ml-auto">
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

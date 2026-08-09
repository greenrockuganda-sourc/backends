import { useState } from 'react'
import { Lock, Mail, ShieldCheck } from 'lucide-react'
import { login } from '@/lib/api'

interface LoginProps {
  onLogin: (accessToken: string, refreshToken: string, user: any) => void
}

export default function Login({ onLogin }: LoginProps) {
  const [identifier, setIdentifier] = useState('joshuajessey3@gmail.com')
  const [password, setPassword] = useState('changemenow@')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const data = await login(identifier, password)
      onLogin(data.access, data.refresh, data.user || { email: identifier })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-6 sm:p-8 shadow-2xl shadow-black/40 slide-up">
        <div className="mb-8 flex items-center gap-3">
          <div className="rounded-xl bg-blue-600 p-3">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white">Seller Dashboard</h1>
            <p className="text-sm text-slate-400">Sign in to manage your store</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Email or phone</label>
            <div className="flex items-center rounded-lg border border-slate-700 bg-slate-800 px-3">
              <Mail className="mr-2 h-4 w-4 text-slate-400" />
              <input
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                className="w-full bg-transparent py-3 text-sm text-white outline-none"
                placeholder="Enter your email or phone"
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Password</label>
            <div className="flex items-center rounded-lg border border-slate-700 bg-slate-800 px-3">
              <Lock className="mr-2 h-4 w-4 text-slate-400" />
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                className="w-full bg-transparent py-3 text-sm text-white outline-none"
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-sm text-blue-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}

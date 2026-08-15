import { useState } from 'react'
import { Lock, Mail, ShieldCheck } from 'lucide-react'
import { login, register } from '@/lib/api'

interface LoginProps {
  onLogin: (accessToken: string, refreshToken: string, user: any) => void
}

export default function Login({ onLogin }: LoginProps) {
  const [isRegistering, setIsRegistering] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setSuccessMessage(null)

    if (isRegistering) {
      if (!firstName.trim() || !lastName.trim() || !identifier.trim() || !phoneNumber.trim() || !password) {
        setError('Please fill in all signup fields.')
        setLoading(false)
        return
      }
    } else if (!identifier.trim() || !password) {
      setError('Please enter your email or phone and password.')
      setLoading(false)
      return
    }

    try {
      if (isRegistering) {
        await register({
          first_name: firstName,
          last_name: lastName,
          email: identifier,
          phone_number: phoneNumber,
          password,
          role: 'Seller',
        })
        setSuccessMessage('Account created successfully. Please sign in.')
        setIsRegistering(false)
        setPassword('')
        setPhoneNumber('')
        return
      }

      const data = await login(identifier, password)
      const user = data.user || { email: identifier }
      if (!user.role || !['Seller', 'Admin'].includes(user.role)) {
        setError('Access denied. Only authorized dashboard users can sign in.')
        setLoading(false)
        return
      }

      onLogin(data.access, data.refresh, user)
    } catch (err) {
      setError(err instanceof Error ? err.message : isRegistering ? 'Unable to create account' : 'Unable to sign in')
    } finally {
      setLoading(false)
    }
  }

  const toggleMode = () => {
    setIsRegistering(!isRegistering)
    setError(null)
    setSuccessMessage(null)
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-6 sm:p-8 shadow-2xl shadow-black/40 slide-up">
        <div className="mb-8 flex items-center gap-3">
          <div className="rounded-xl bg-blue-600 p-3">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white">
              {isRegistering ? 'Create your account' : 'Seller Dashboard'}
            </h1>
            <p className="text-sm text-slate-400">
              {isRegistering ? 'Sign up to manage your store' : 'Sign in to manage your store'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {isRegistering && (
            <>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">First name</label>
                <input
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-3 text-sm text-white outline-none"
                  placeholder="First name"
                  autoComplete="given-name"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Last name</label>
                <input
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-3 text-sm text-white outline-none"
                  placeholder="Last name"
                  autoComplete="family-name"
                />
              </div>
            </>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              {isRegistering ? 'Email address' : 'Email or phone'}
            </label>
            <div className="flex items-center rounded-lg border border-slate-700 bg-slate-800 px-3">
              <Mail className="mr-2 h-4 w-4 text-slate-400" />
              <input
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                className="w-full bg-transparent py-3 text-sm text-white outline-none"
                placeholder={isRegistering ? 'Enter your email' : 'Enter your email or phone'}
                autoComplete={isRegistering ? 'email' : 'email'}
              />
            </div>
          </div>

          {isRegistering && (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Phone number</label>
              <div className="flex items-center rounded-lg border border-slate-700 bg-slate-800 px-3">
                <input
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  className="w-full bg-transparent py-3 text-sm text-white outline-none"
                  placeholder="Enter your phone number"
                  autoComplete="tel"
                />
              </div>
            </div>
          )}

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
                autoComplete={isRegistering ? 'new-password' : 'current-password'}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-sm text-blue-300">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              {successMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? (isRegistering ? 'Creating account...' : 'Signing in...') : (isRegistering ? 'Create account' : 'Sign in')}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-slate-400">
          {isRegistering ? (
            <>
              Already have an account?{' '}
              <button type="button" onClick={toggleMode} className="text-blue-400 hover:text-blue-300 underline">
                Sign in
              </button>
            </>
          ) : (
            <>
              Don't have an account?{' '}
              <button type="button" onClick={toggleMode} className="text-blue-400 hover:text-blue-300 underline">
                Sign up
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

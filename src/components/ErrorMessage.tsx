import { AlertTriangle, RefreshCw } from 'lucide-react'

interface ErrorMessageProps {
  message: string
  onRetry?: () => void
  title?: string
}

export default function ErrorMessage({ message, onRetry, title = 'Something went wrong' }: ErrorMessageProps) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-blue-900">{title}</h3>
          <p className="mt-1 text-sm text-blue-700">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <RefreshCw size={16} />
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

interface RetryableErrorBoundaryProps {
  error: string | null
  onRetry?: () => void
  children?: React.ReactNode
}

export function RetryableError({ error, onRetry, children }: RetryableErrorBoundaryProps) {
  if (!error) {
    return <>{children}</>
  }

  return (
    <div className="mb-6">
      <ErrorMessage message={error} onRetry={onRetry} />
    </div>
  )
}
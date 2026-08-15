import { TrendingUp, TrendingDown } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string
  icon: React.ReactNode
  change?: string
  trend?: 'up' | 'down'
  color?: 'blue'
}

const colorMap = {
  blue: 'bg-blue-50 text-blue-600',
}

export default function StatCard({ 
  title, 
  value, 
  icon, 
  change, 
  trend,
  color = 'blue'
}: StatCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-lg sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="mt-2 text-xl font-bold text-gray-900 sm:text-2xl">{value}</p>
          {change && (
            <p className={`mt-2 flex items-center gap-1 text-xs text-blue-600`}>
              {trend === 'up' && <TrendingUp size={14} />}
              {trend === 'down' && <TrendingDown size={14} />}
              {change}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colorMap[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

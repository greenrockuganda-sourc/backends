import React from 'react'

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular'
  width?: string | number
  height?: string | number
  animation?: 'pulse' | 'wave' | 'none'
}

export default function Skeleton({
  className = '',
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse'
}: SkeletonProps) {
  const baseStyles = 'bg-gray-200'
  const animationStyles = animation === 'pulse' ? 'animate-pulse' : animation === 'wave' ? 'animate-shimmer' : ''
  
  const variantStyles = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  }

  const style: React.CSSProperties = {
    width: width,
    height: height,
  }

  return (
    <div
      className={`${baseStyles} ${animationStyles} ${variantStyles[variant]} ${className}`}
      style={style}
    />
  )
}

export function SkeletonTable({ rows = 5, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex gap-4 mb-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`header-${i}`} height={20} width={`${100 / columns}%`} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={`row-${rowIndex}`} className="flex gap-4 mb-3">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={`cell-${rowIndex}-${colIndex}`}
              height={16}
              width={`${100 / columns}%`}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <Skeleton height={12} width="60%" className="mb-2" />
      <Skeleton height={28} width="40%" />
    </div>
  )
}

export function SkeletonStats() {
  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

export function SkeletonChart() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <Skeleton height={20} width="30%" className="mb-4" />
      <Skeleton height={200} width="100%" />
    </div>
  )
}
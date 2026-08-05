import { mockStats } from '@/lib/mock-data'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 500))
    return NextResponse.json(mockStats)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}

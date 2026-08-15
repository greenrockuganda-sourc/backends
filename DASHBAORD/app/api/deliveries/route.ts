import { mockDeliveries } from '@/lib/mock-data'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    await new Promise(resolve => setTimeout(resolve, 300))
    return NextResponse.json(mockDeliveries)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch deliveries' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const newDelivery = {
      ...body,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    return NextResponse.json(newDelivery, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create delivery' },
      { status: 400 }
    )
  }
}

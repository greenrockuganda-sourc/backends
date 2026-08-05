import { mockOrders } from '@/lib/mock-data'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    await new Promise(resolve => setTimeout(resolve, 300))
    return NextResponse.json(mockOrders)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const newOrder = {
      ...body,
      id: Date.now().toString(),
      orderNumber: `ORD-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    return NextResponse.json(newOrder, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 400 }
    )
  }
}

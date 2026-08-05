import { mockProducts } from '@/lib/mock-data'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    await new Promise(resolve => setTimeout(resolve, 300))
    return NextResponse.json(mockProducts)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const newProduct = {
      ...body,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    return NextResponse.json(newProduct, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 400 }
    )
  }
}

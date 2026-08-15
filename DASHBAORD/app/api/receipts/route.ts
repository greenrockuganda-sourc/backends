import { NextResponse } from 'next/server'

export async function GET() {
  try {
    await new Promise(resolve => setTimeout(resolve, 300))
    return NextResponse.json([])
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch receipts' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const newReceipt = {
      ...body,
      id: Date.now().toString(),
      receiptNumber: `REC-${Date.now()}`,
      issuedAt: new Date().toISOString(),
    }
    return NextResponse.json(newReceipt, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create receipt' },
      { status: 400 }
    )
  }
}

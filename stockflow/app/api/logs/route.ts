import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    // Verify user has appropriate role
    const user = await requireRole('OPERATOR', 'ADMIN')

    const body = await request.json()
    const { orderId, department, inputWeight, outputWeight, scrapWeight, timestamp } = body

    // Validate input
    if (!orderId || !department || inputWeight === undefined || outputWeight === undefined || scrapWeight === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate weight balance (within tolerance of 0.01kg)
    const balance = inputWeight - (outputWeight + scrapWeight)
    if (Math.abs(balance) > 0.01) {
      return NextResponse.json(
        { 
          error: 'Weight does not balance',
          details: { inputWeight, outputWeight, scrapWeight, balance }
        },
        { status: 422 }
      )
    }

    // Get the order to find current stage
    const order = await prisma.productionOrder.findFirst({
      where: { id: orderId },
      include: { design: true },
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Create stage log in database
    const stageLog = await prisma.stageLog.create({
      data: {
        orderId,
        stageName: department,
        department: department, // Use the provided department
        sequence: order.currentStage,
        kgIn: inputWeight,
        kgOut: outputWeight,
        kgScrap: scrapWeight,
        operatorId: user.id,
        notes: `Logged at ${new Date().toLocaleString()}`,
        completedAt: new Date(timestamp),
      },
      include: {
        operator: {
          select: { name: true, email: true },
        },
      },
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Stage log created successfully',
        data: stageLog,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Stage log API error:', error)

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create stage log' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole('ADMIN')

    const searchParams = request.nextUrl.searchParams
    const stageName = searchParams.get('stageName')
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    const query: any = {}
    if (stageName) {
      query.stageName = stageName
    }

    const logs = await prisma.stageLog.findMany({
      where: query,
      include: {
        operator: {
          select: { name: true, email: true, department: true },
        },
        order: {
          select: { 
            id: true, 
            quantity: true,
            design: { select: { name: true } }
          },
        },
      },
      orderBy: { completedAt: 'desc' },
      take: limit,
    })

    return NextResponse.json(
      {
        success: true,
        data: logs,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Stage log retrieval error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve stage logs' },
      { status: 500 }
    )
  }
}

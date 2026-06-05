export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { requireActiveAuth } from '@/lib/auth'
import { completeStage } from '@/app/actions/stage-completion'

export async function POST(request: NextRequest) {
  try {
    // Verify user has appropriate role (tenant-aware)
    const user = await requireActiveAuth()
    if (!['OPERATOR', 'ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const db = getTenantPrisma(user.organizationId)

    const body = await request.json()
    const { orderId, department, inputWeight, outputWeight, scrapWeight, piecesIn, piecesOut } = body

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

    // Get the order to find current stage (automatically scoped)
    const order = await db.productionOrder.findFirst({
      where: { id: orderId },
      include: { design: { include: { stages: true } } },
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    if (!order.design) {
      return NextResponse.json(
        { error: 'Direct orders use production output recording instead of stage logging' },
        { status: 400 }
      )
    }

    const stage = order.design.stages.find(stage => stage.sequence === order.currentStage)
    if (!stage) {
      return NextResponse.json({ error: 'Current stage not found' }, { status: 400 })
    }
    const result = await completeStage({
      orderId,
      stageId: stage.id,
      stageName: stage.name,
      department,
      sequence: stage.sequence,
      kgIn: Number(inputWeight),
      kgOut: Number(outputWeight),
      kgScrap: Number(scrapWeight),
      piecesIn: piecesIn === undefined || piecesIn === null || piecesIn === "" ? undefined : Number(piecesIn),
      piecesOut: piecesOut === undefined || piecesOut === null || piecesOut === "" ? undefined : Number(piecesOut),
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Stage log created successfully',
        data: {
          ...result.stageLog,
          kgIn: Number(result.stageLog.kgIn),
          kgOut: Number(result.stageLog.kgOut),
          kgScrap: Number(result.stageLog.kgScrap),
          piecesIn: result.stageLog.piecesIn,
          piecesOut: result.stageLog.piecesOut,
          completedAt: result.stageLog.completedAt.toISOString(),
        },
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
    const user = await requireActiveAuth()
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const db = getTenantPrisma(user.organizationId)

    const searchParams = request.nextUrl.searchParams
    const stageName = searchParams.get('stageName')
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    const query: any = {}
    if (stageName) {
      query.stageName = stageName
    }

    const logs = await db.stageLog.findMany({
      where: query,
      include: {
        User: {
          select: { name: true, email: true, department: true },
        },
        ProductionOrder: {
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

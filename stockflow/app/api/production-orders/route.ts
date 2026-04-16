import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { orderNumber, designId, initialWeight, priority } = body

    // Validate required fields
    if (!orderNumber || !designId || !initialWeight || !priority) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate priority enum
    if (!['LOW', 'MEDIUM', 'HIGH'].includes(priority)) {
      return NextResponse.json(
        { error: 'Invalid priority value' },
        { status: 400 }
      )
    }

    // Validate weight
    if (initialWeight <= 0 || initialWeight > 10000) {
      return NextResponse.json(
        { error: 'Invalid weight value' },
        { status: 400 }
      )
    }

    // Check if design exists
    const design = await prisma.design.findUnique({
      where: { id: designId },
    })

    if (!design) {
      return NextResponse.json(
        { error: 'Design not found' },
        { status: 404 }
      )
    }

    // Generate a unique order number (e.g., PO-123456)
    const generatedOrderNumber = `PO-${Date.now().toString().slice(-6)}`;

    // Create production order
    const productionOrder = await prisma.productionOrder.create({
      data: {
        orderNumber: generatedOrderNumber,
        designId,
        quantity: 1,
        targetKg: initialWeight,
        priority: priority || 'MEDIUM',
        status: 'PENDING',
        currentDept: "Cutting", // Default first department
        currentStage: 1         // Default first stage
      },
      include: {
        design: true,
      },
    })

    return NextResponse.json(
      {
        message: 'Production order created successfully',
        order: productionOrder,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating production order:', error)
    return NextResponse.json(
      { error: 'Failed to create production order' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const dept = searchParams.get('dept')
    const priority = searchParams.get('priority')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Build query conditions
    const where: any = {}

    // Map UI status to database status
    const statusMap: any = {
      PENDING: 'PENDING',
      RELEASED: 'APPROVED',
      IN_PROGRESS: 'IN_PRODUCTION',
      COMPLETED: 'COMPLETED',
    }

    if (status) {
      if (status.includes(',')) {
        where.status = { in: status.split(',').map(s => statusMap[s] || s) }
      } else {
        where.status = statusMap[status] || status
      }
    }

    if (dept) {
      where.currentDept = dept
    }

    if (priority) {
      where.priority = priority
    }

    // Fetch orders with design information
    const [orders, total] = await Promise.all([
      prisma.productionOrder.findMany({
        where,
        include: {
          design: {
            select: {
              name: true,
              targetWeight: true,
            },
          },
        },
        orderBy: [
          // Sort by creation date (newest first)
          { createdAt: 'desc' },
        ],
        take: limit,
        skip: offset,
      }),
      prisma.productionOrder.count({ where }),
    ])

    // Transform data for frontend
    const transformedOrders = orders.map((order) => ({
      id: order.id,
      code: order.orderNumber || `ORD-${order.id.slice(0, 8).toUpperCase().replace(/-/g, '').slice(0, 6)}`,
      designName: order.design?.name || 'Unknown Design',
      targetKg: order.targetKg,
      currentDept: order.currentDept || 'Unassigned',
      quantity: order.quantity,
      priority: order.priority,
      yieldEstimate: order.design?.targetWeight ? Math.round((order.targetKg / order.design.targetWeight) * 100) : 85,
      status: order.status,
    }))

    return NextResponse.json(
      {
        success: true,
        data: transformedOrders,
        pagination: {
          total,
          limit,
          offset,
          pages: Math.ceil(total / limit),
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Production orders fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch production orders' },
      { status: 500 }
    )
  }
}

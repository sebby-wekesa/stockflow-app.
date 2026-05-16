export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { getSecurityHeaders } from '@/lib/security'

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // Apply rate limiting: 10 requests per minute per IP
  const rateLimitResult = await rateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
  })(request as any);

  if (!rateLimitResult.success) {
    logger.security('Rate limit exceeded for production order creation', {
      ip: request.headers.get('x-forwarded-for') || 'unknown',
    });
      const response = NextResponse.json(
        { error: rateLimitResult.error },
        { status: 429 }
      );

      Object.entries(getSecurityHeaders()).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;
  }

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
        Design: true,
      },
    })

    const duration = Date.now() - startTime;
    logger.performance('Production order created', duration, {
      orderId: productionOrder.id,
      orderNumber: productionOrder.orderNumber,
    });

    const response = NextResponse.json(
      {
        message: 'Production order created successfully',
        order: productionOrder,
      },
      { status: 201 }
    );

    // Add security headers
    Object.entries(getSecurityHeaders()).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    logger.error('Failed to create production order', error, {
      orderNumber,
      designId,
      initialWeight,
      priority
    });

    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('Unique constraint')) {
        return NextResponse.json(
          { error: 'Order number already exists' },
          { status: 409 }
        )
      }
      if (error.message.includes('Foreign key constraint')) {
        return NextResponse.json(
          { error: 'Invalid design ID' },
          { status: 400 }
        )
      }
    }

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
        select: {
          id: true,
          orderNumber: true,
          targetKg: true,
          quantity: true,
          priority: true,
          status: true,
          Design: {
            select: {
              name: true,
              targetDimensions: true,
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
      orderNumber: order.orderNumber,
      designName: order.Design?.name || 'Unknown Design',
      targetKg: order.targetKg,
      quantity: order.quantity,
      priority: order.priority,
      specs: `${order.Design?.targetDimensions || ''}`,
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

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { requireActiveAuth } from '@/lib/auth'
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
    const user = await requireActiveAuth();
    if (!['ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const db = getTenantPrisma(user.organizationId);

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

    // Check if design exists (tenant scoped)
    const design = await db.design.findUnique({
      where: { id: designId },
      include: { stages: { orderBy: { sequence: 'asc' }, take: 1 } },
    })

    if (!design) {
      return NextResponse.json(
        { error: 'Design not found' },
        { status: 404 }
      )
    }
    if (design.stages.length === 0) {
      return NextResponse.json({ error: 'Design has no production stages' }, { status: 400 });
    }

    // Generate a unique order number (e.g., PO-123456)
    const generatedOrderNumber = `PO-${Date.now().toString().slice(-6)}`;

    // Create production order (organizationId injected automatically by tenant client)
    const productionOrder = await db.productionOrder.create({
      data: {
        orderNumber: generatedOrderNumber,
        designId,
        quantity: 1,
        targetKg: initialWeight,
        priority: priority || 'MEDIUM',
        status: 'PENDING',
        currentStage: design.stages[0].sequence,
        currentDept: design.stages[0].department,
      } as any,
      include: {
        design: true,
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
      errorContext: 'production order creation'
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
    const user = await requireActiveAuth();
    if (!['ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const db = getTenantPrisma(user.organizationId);

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const dept = searchParams.get('dept')
    const priority = searchParams.get('priority')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Build query conditions (tenant scoping is automatic via db client)
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

    // Fetch orders with design information (automatically scoped to user's org)
    const [orders, total] = await Promise.all([
      db.productionOrder.findMany({
        where,
        select: {
          id: true,
          orderNumber: true,
          targetKg: true,
          quantity: true,
          priority: true,
          status: true,
          design: {
            select: {
              name: true,
              targetDimensions: true,
            },
          },
        },
        orderBy: [
          { createdAt: 'desc' },
        ],
        take: limit,
        skip: offset,
      }),
      db.productionOrder.count({ where }),
    ])

    // Transform data for frontend
    const transformedOrders = orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      designName: order.design?.name || 'Unknown Design',
      targetKg: order.targetKg,
      quantity: order.quantity,
      priority: order.priority,
      specs: `${order.design?.targetDimensions || ''}`,
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

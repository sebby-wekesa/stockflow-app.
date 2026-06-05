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
    const {
      designId,
      initialWeight,
      priority,
      orderType,
      orderNumber,
      jobNumber,
      productName,
      expectedPieces,
      materialLines,
    } = body

    // Validate required fields
    if (!priority) {
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

    const requestedOrderNumber = String(jobNumber ?? orderNumber ?? '').trim()
    if (requestedOrderNumber.length > 64) {
      return NextResponse.json({ error: 'Job number cannot exceed 64 characters' }, { status: 400 })
    }

    const finalOrderNumber = requestedOrderNumber || `PO-${Date.now().toString().slice(-6)}`
    const existingOrder = await db.productionOrder.findFirst({
      where: { orderNumber: finalOrderNumber },
      select: { id: true },
    })
    if (existingOrder) {
      return NextResponse.json({ error: 'Job number already exists' }, { status: 409 })
    }

    if (orderType === 'direct') {
      if (!productName || typeof productName !== 'string' || productName.trim().length < 2) {
        return NextResponse.json({ error: 'Product name is required' }, { status: 400 })
      }
      if (!Number.isInteger(Number(expectedPieces)) || Number(expectedPieces) <= 0) {
        return NextResponse.json({ error: 'Expected finished pieces must be a positive whole number' }, { status: 400 })
      }
      if (!Array.isArray(materialLines) || materialLines.length === 0) {
        return NextResponse.json({ error: 'Add at least one material line' }, { status: 400 })
      }

      const normalizedLines = materialLines.map((line: any) => ({
        rawMaterialId: String(line.rawMaterialId || ''),
        cutLength: line.cutLength === '' || line.cutLength == null ? null : Number(line.cutLength),
        pieces: Number(line.pieces),
        totalLength: line.totalLength === '' || line.totalLength == null ? null : Number(line.totalLength),
        weightKg: line.weightKg === '' || line.weightKg == null ? null : Number(line.weightKg),
      }))

      for (const line of normalizedLines) {
        if (!line.rawMaterialId) {
          return NextResponse.json({ error: 'Each material line needs a raw material' }, { status: 400 })
        }
        if (!Number.isInteger(line.pieces) || line.pieces <= 0) {
          return NextResponse.json({ error: 'Each material line needs positive pieces' }, { status: 400 })
        }
        if (line.cutLength != null && line.cutLength < 0) {
          return NextResponse.json({ error: 'Cut length cannot be negative' }, { status: 400 })
        }
        if (line.totalLength != null && line.totalLength < 0) {
          return NextResponse.json({ error: 'Total length cannot be negative' }, { status: 400 })
        }
        if (line.weightKg == null || !Number.isFinite(line.weightKg) || line.weightKg <= 0) {
          return NextResponse.json({ error: 'Each material line needs positive weight used in kg' }, { status: 400 })
        }
      }

      const materialIds = [...new Set(normalizedLines.map((line) => line.rawMaterialId))]
      const materials = await db.rawMaterial.findMany({
        where: { id: { in: materialIds } },
        select: { id: true, materialName: true, availableKg: true, availablePieces: true },
      })
      if (materials.length !== materialIds.length) {
        return NextResponse.json({ error: 'One or more raw materials were not found' }, { status: 400 })
      }

      const materialById = new Map(materials.map((material) => [material.id, material]))
      for (const line of normalizedLines) {
        const material = materialById.get(line.rawMaterialId)
        if (!material) continue
        const weightKg = line.weightKg ?? 0
        if (Number(material.availableKg) < weightKg) {
          return NextResponse.json(
            { error: `Insufficient kg for ${material.materialName}. Available: ${Number(material.availableKg).toFixed(2)}kg, requested: ${weightKg.toFixed(2)}kg` },
            { status: 400 }
          )
        }
        if (material.availablePieces < line.pieces) {
          return NextResponse.json(
            { error: `Insufficient pieces for ${material.materialName}. Available: ${material.availablePieces}, requested: ${line.pieces}` },
            { status: 400 }
          )
        }
      }

      const targetKg = normalizedLines.reduce((sum, line) => sum + (line.weightKg ?? 0), 0)
      const productionOrder = await db.productionOrder.create({
        data: {
          orderNumber: finalOrderNumber,
          productName: productName.trim(),
          expectedPieces: Number(expectedPieces),
          quantity: Number(expectedPieces),
          targetKg,
          priority: priority || 'MEDIUM',
          status: 'PENDING',
          currentStage: 1,
          materials: {
            create: normalizedLines.map((line) => ({
              organizationId: user.organizationId,
              rawMaterialId: line.rawMaterialId,
              cutLength: line.cutLength,
              pieces: line.pieces,
              totalLength: line.totalLength,
              weightKg: line.weightKg,
            })),
          },
        } as any,
        include: {
          materials: {
            include: {
              RawMaterial: {
                select: {
                  id: true,
                  materialName: true,
                  diameter: true,
                  width: true,
                  height: true,
                  length: true,
                },
              },
            },
          },
        },
      })

      const duration = Date.now() - startTime;
      logger.performance('Direct production order created', duration, {
        orderId: productionOrder.id,
        orderNumber: productionOrder.orderNumber,
      });

      const response = NextResponse.json(
        {
          message: 'Direct production order created successfully',
          order: {
            ...productionOrder,
            targetKg: Number(productionOrder.targetKg),
            materials: productionOrder.materials.map((line: any) => ({
              ...line,
              cutLength: line.cutLength == null ? null : Number(line.cutLength),
              totalLength: line.totalLength == null ? null : Number(line.totalLength),
              weightKg: line.weightKg == null ? null : Number(line.weightKg),
            })),
          },
        },
        { status: 201 }
      );

      Object.entries(getSecurityHeaders()).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;
    }

    if (!designId || !initialWeight) {
      return NextResponse.json(
        { error: 'Missing required fields' },
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

    // Create production order (organizationId injected automatically by tenant client)
    const productionOrder = await db.productionOrder.create({
      data: {
        orderNumber: finalOrderNumber,
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
          productName: true,
          expectedPieces: true,
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
      designName: order.design?.name || order.productName || 'Direct order',
      targetKg: Number(order.targetKg),
      quantity: order.quantity,
      expectedPieces: order.expectedPieces,
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

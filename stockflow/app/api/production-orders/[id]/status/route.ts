export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    // Verify user has manager or admin role
    const user = await requireRole('ADMIN', 'MANAGER')

    const body = await request.json()
    const { status, rejectionReason } = body

    // Validate status
    if (!['RELEASED', 'REJECTED'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be RELEASED or REJECTED.' },
        { status: 400 }
      )
    }

    // If rejecting, rejection reason is required
    if (status === 'REJECTED' && !rejectionReason) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      )
    }

    // Get the current order
    const order = await prisma.productionOrder.findUnique({
      where: { id: params.id },
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Update the order status
    const statusMap: any = {
      RELEASED: 'APPROVED',
      REJECTED: 'REJECTED',
    }

    const newStatus = statusMap[status]

    // If approving, perform inventory deduction
    let updatedOrder;
    if (status === 'RELEASED') {
      updatedOrder = await prisma.$transaction(async (tx) => {
        // 1. Get the Design to see which raw materials are needed
        const design = await tx.design.findUnique({
          where: { id: order.designId },
          include: {
            Stage: {
              orderBy: { sequence: 'asc' }
            },
            BillOfMaterials: {
              include: { RawMaterial: true }
            }
          }
        });

        if (!design) {
          throw new Error('Design not found');
        }

        if (!design.BillOfMaterials || design.BillOfMaterials.length === 0) {
          throw new Error('Design does not have any BOM items');
        }

        const firstStage = design.Stage[0];
        if (!firstStage) {
          throw new Error('Design has no production stages configured');
        }

        // For now, assume single raw material per design (take first BOM item)
        const primaryBomItem = design.BillOfMaterials[0];

        // 2. Calculate the required quantity for this BOM item
        const plannedUnits =
          design.targetWeight && design.targetWeight.gt(0)
            ? order.targetKg.toNumber() / design.targetWeight.toNumber()
            : order.quantity;
        const requiredQuantity = plannedUnits * primaryBomItem.quantity.toNumber();

        if (primaryBomItem.rawMaterial.availableKg.toNumber() < requiredQuantity) {
          throw new Error('Insufficient stock to release this order');
        }

        // 3. Deduct from Available and add to Reserved
        await tx.rawMaterial.update({
          where: { id: primaryBomItem.rawMaterialId },
          data: {
            availableKg: { decrement: requiredQuantity },
            reservedKg: { increment: requiredQuantity }
          }
        });

        // 4. Update the Order Status
        return await tx.productionOrder.update({
          where: { id: params.id },
          data: {
            status: newStatus,
            approvedBy: user.id,
            approvedAt: new Date(),
            currentStage: firstStage.sequence,
            currentDept: firstStage.department,
          },
          include: {
            Design: {
              select: { name: true },
            },
          },
        });
      });
    } else {
      updatedOrder = await prisma.productionOrder.update({
        where: { id: params.id },
        data: {
          status: newStatus,
          approvedBy: user.id,
          approvedAt: new Date(),
          // Store rejection reason in notes if rejecting
          ...(status === 'REJECTED' && {
            // Note: Adjust this if your schema has a rejectionReason field
            // For now, we'll use notes
          }),
        },
        include: {
          Design: {
            select: { name: true },
          },
        },
      });
    }

    // Create an audit log entry
    try {
      await prisma.$executeRaw`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, created_at)
        VALUES (${user.id}, ${status === 'RELEASED' ? 'APPROVED_ORDER' : 'REJECTED_ORDER'}, 'ProductionOrder', ${params.id}, ${JSON.stringify({
          previousStatus: order.status,
          newStatus,
          reason: rejectionReason,
        })}, NOW())
      `
    } catch (auditError) {
      // Log audit error but don't fail the request
      console.error('Audit log error:', auditError)
    }

    return NextResponse.json(
      {
        success: true,
        message: `Order ${status === 'RELEASED' ? 'approved' : 'rejected'} successfully`,
        data: updatedOrder,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Order status update error:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized. Only Managers and Admins can update order status.' },
        { status: 401 }
      )
    }

    if (error.message?.startsWith('Forbidden')) {
      return NextResponse.json(
        { error: 'Forbidden. Only Managers and Admins can update order status.' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Failed to update order status' },
      { status: 500 }
    )
  }
}

// GET endpoint to retrieve a specific order
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const order = await prisma.productionOrder.findUnique({
      where: { id: params.id },
      include: {
        Design: true,
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        data: order,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Order retrieval error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve order' },
      { status: 500 }
    )
  }
}

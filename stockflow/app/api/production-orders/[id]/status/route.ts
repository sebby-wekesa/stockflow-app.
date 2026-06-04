export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server'
import { getTenantPrisma, withTenantTransaction } from '@/lib/tenant-prisma'
import { requireActiveAuth } from '@/lib/auth'
import { assertOperatorDepartment } from '@/lib/operator-access'

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    // Verify user has manager or admin role (tenant aware)
    const user = await requireActiveAuth()
    if (!['ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const db = getTenantPrisma(user.organizationId)

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

    // Get the current order (tenant scoped)
    const order = await db.productionOrder.findUnique({
      where: { id: params.id },
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }
    assertOperatorDepartment(user, order.currentDept)
    if (order.status !== 'PENDING') {
      return NextResponse.json({ error: 'Only pending orders can be approved or rejected' }, { status: 400 })
    }

    // Update the order status
    const statusMap: any = {
      RELEASED: 'IN_PRODUCTION',
      REJECTED: 'REJECTED',
    }

    const newStatus = statusMap[status]

    // If approving, perform inventory deduction (tenant scoped)
    let updatedOrder;
    if (status === 'RELEASED') {
      updatedOrder = await withTenantTransaction(user.organizationId, async (tx) => {
        // 1. Get the Design to see which raw materials are needed
        const design = await tx.design.findUnique({
          where: { id: order.designId },
          include: {
            stages: {
              orderBy: { sequence: 'asc' }
            },
            billOfMaterials: {
              include: { RawMaterial: true }
            }
          }
        });

        if (!design) {
          throw new Error('Design not found');
        }

        if (!design.billOfMaterials || design.billOfMaterials.length === 0) {
          throw new Error('Design does not have any BOM items');
        }

        const firstStage = design.stages[0];
        if (!firstStage) {
          throw new Error('Design has no production stages configured');
        }

        const plannedUnits =
          design.targetWeight && design.targetWeight.gt(0)
            ? order.targetKg.toNumber() / design.targetWeight.toNumber()
            : order.quantity;

        // Reserve every BOM material before releasing the job.
        for (const bomItem of design.billOfMaterials) {
          const requiredQuantity = plannedUnits * bomItem.quantity.toNumber();
          if (!bomItem.RawMaterial || bomItem.RawMaterial.availableKg.toNumber() < requiredQuantity) {
            throw new Error(
              `Insufficient stock for ${bomItem.RawMaterial?.materialName ?? 'required material'}`
            );
          }

          await tx.rawMaterial.update({
            where: { id: bomItem.rawMaterialId },
            data: {
              availableKg: { decrement: requiredQuantity },
              reservedKg: { increment: requiredQuantity }
            }
          });
        }

        return await tx.productionOrder.update({
          where: { id: params.id },
          data: {
            status: newStatus,
            approvedBy: user.id,
            approvedAt: new Date(),
            rejectionReason: null,
            currentStage: firstStage.sequence,
            currentDept: firstStage.department,
          },
          include: {
            design: {
              select: { name: true },
            },
          },
        });
      });
    } else {
      updatedOrder = await db.productionOrder.update({
        where: { id: params.id },
        data: {
          status: newStatus,
          approvedBy: user.id,
          approvedAt: new Date(),
          rejectionReason: rejectionReason.trim(),
        },
        include: {
          design: {
            select: { name: true },
          },
        },
      });
    }

    // Create an audit log entry (using scoped client)
    try {
      await db.$executeRaw`
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
    assertOperatorDepartment(user, order.currentDept)

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
    const user = await requireActiveAuth()
    const db = getTenantPrisma(user.organizationId)

    const order = await db.productionOrder.findUnique({
      where: { id: params.id },
      include: {
        design: true,
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }
    assertOperatorDepartment(user, order.currentDept)

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

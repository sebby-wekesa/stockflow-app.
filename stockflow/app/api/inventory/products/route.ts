export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getTenantPrisma, withTenantTransaction } from '@/lib/tenant-prisma';
import { requireActiveAuth } from '@/lib/auth';

// GET /api/inventory/products?origin=LOCAL_PURCHASE|IMPORTED|FACTORY_MADE
export async function GET(request: NextRequest) {
  try {
    const user = await requireActiveAuth();
    const db = getTenantPrisma(user.organizationId);

    const { searchParams } = new URL(request.url);
    const origin = searchParams.get('origin') as
      | 'LOCAL_PURCHASE'
      | 'IMPORTED'
      | 'FACTORY_MADE'
      | null;

    const products = await db.product.findMany({
      where: origin ? { origin } : undefined,
      include: {
        Branch: { select: { name: true } },
        ProductReceipt: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ products });
  } catch (error) {
    console.error('[GET /api/inventory/products]', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

// POST /api/inventory/products
export async function POST(request: NextRequest) {
  try {
    const user = await requireActiveAuth();
    if (!['ADMIN', 'MANAGER', 'OPERATOR'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await request.json();
    const {
      name,
      origin,
      uom,
      quantity,
      unitCost,
      landingCost,
      vendor,
      branchId,
      reference,
      loggedBy,
    } = body;

    // Validate required fields
    if (!name || !origin || !uom || !quantity || quantity <= 0) {
      return NextResponse.json(
        { error: 'Missing required fields: name, origin, uom, quantity' },
        { status: 400 }
      );
    }

    if (!['LOCAL_PURCHASE', 'IMPORTED', 'FACTORY_MADE'].includes(origin)) {
      return NextResponse.json(
        { error: 'origin must be LOCAL_PURCHASE, IMPORTED, or FACTORY_MADE' },
        { status: 400 }
      );
    }

    // Transactional product upsert + receipt write (prevents partial writes and reduces
    // window for duplicate-product creation under concurrent receipts for same name+origin+branch)
    const { product, receipt, wasExisting } = await withTenantTransaction(user.organizationId, async (tx) => {
      // Re-lookup inside tx for consistency
      const existing = await tx.product.findFirst({
        where: { name, origin, branchId: branchId ?? null },
      });

      let product;
      let wasExisting = !!existing;

      if (existing) {
        product = await tx.product.update({
          where: { id: existing.id },
          data: {
            currentStock: existing.currentStock + Number(quantity),
            unitCost: unitCost ? Number(unitCost) : existing.unitCost,
            landingCost: landingCost ? Number(landingCost) : existing.landingCost,
            vendor: vendor || existing.vendor,
            updatedAt: new Date(),
          },
        });
      } else {
        // Generate a simple SKU
        const sku = `${origin.slice(0, 3)}-${name
          .replace(/\s+/g, '-')
          .toUpperCase()
          .slice(0, 20)}-${Date.now().toString().slice(-6)}`;

        product = await tx.product.create({
          data: {
            organizationId: user.organizationId,
            name,
            sku,
            origin,
            uom,
            currentStock: Number(quantity),
            unitCost: unitCost ? Number(unitCost) : null,
            landingCost: landingCost ? Number(landingCost) : null,
            vendor: vendor || null,
            branchId: branchId || null,
          },
        });
      }

      // Receipt inside same tx
      const receipt = await tx.productReceipt.create({
        data: {
          organizationId: user.organizationId,
          productId: product.id,
          qtyReceived: Number(quantity),
          unitCost: unitCost ? Number(unitCost) : null,
          landingCost: landingCost ? Number(landingCost) : null,
          reference: reference || null,
          vendor: vendor || null,
          loggedBy: loggedBy || null,
          branchId: branchId || null,
        },
      });

      return { product, receipt, wasExisting };
    }, { maxWait: 10000, timeout: 30000 });

    return NextResponse.json(
      {
        message: wasExisting ? 'Stock updated successfully' : 'Product added successfully',
        product,
        receipt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/inventory/products]', error);
    return NextResponse.json(
      { error: 'Failed to add stock' },
      { status: 500 }
    );
  }
}

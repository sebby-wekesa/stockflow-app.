export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/inventory/products?origin=LOCAL_PURCHASE|IMPORTED|FACTORY_MADE
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const origin = searchParams.get('origin') as
      | 'LOCAL_PURCHASE'
      | 'IMPORTED'
      | 'FACTORY_MADE'
      | null;

    const products = await prisma.product.findMany({
      where: origin ? { origin } : undefined,
      include: {
        Branch: { select: { name: true } },
        receipts: {
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

    // Upsert the Product (match on name + origin + branchId)
    const existing = await prisma.product.findFirst({
      where: { name, origin, branchId: branchId ?? null },
    });

    let product;
    if (existing) {
      product = await prisma.product.update({
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

      product = await prisma.product.create({
        data: {
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

    // Always write a receipt record for audit trail
    const receipt = await prisma.productReceipt.create({
      data: {
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

    return NextResponse.json(
      {
        message: existing ? 'Stock updated successfully' : 'Product added successfully',
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

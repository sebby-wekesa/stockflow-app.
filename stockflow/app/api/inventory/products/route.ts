export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { incrementProductShadowStock } from '@/lib/order-lifecycle';
import { getTenantPrisma } from '@/lib/tenant-prisma';
import { requireActiveAuth } from '@/lib/auth';
import { normalizeProductUom } from '@/lib/products';

// GET /api/inventory/products?origin=LOCAL_PURCHASE|IMPORTED|FACTORY_MADE
//                              &page=1&limit=200
//                              &include_receipts=1
//
// Pagination defaults to page=1, limit=200. Existing callers without these
// params keep working — they just get the first 200 products (down from
// "everything"). For very large catalogues callers should paginate.
//
// `include_receipts` is opt-in: when present, each product carries its 10
// most recent ProductReceipt rows (down from 50). Pages that don't need
// receipt history should omit the flag to skip the join entirely.
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

    // Defensive parsing of pagination params
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const limit = Math.min(
      500, // hard cap
      Math.max(1, parseInt(searchParams.get('limit') ?? '200', 10) || 200)
    );
    const includeReceipts = searchParams.get('include_receipts') !== null;

    const where = origin ? { origin } : undefined;

    // Run count + products in parallel
    const [total, raw] = await Promise.all([
      db.product.count({ where }),
      db.product.findMany({
        where,
        include: {
          Branch: { select: { name: true } },
          ...(includeReceipts
            ? {
                ProductReceipt: {
                  orderBy: { createdAt: 'desc' },
                  take: 10,
                },
              }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // Reshape: Prisma relations are PascalCase but the inventory UI expects
    // `branch` and `receipts`. Map them so existing consumers keep working.
    const products = (raw as any[]).map((p) => ({
      ...p,
      branch: p.Branch ?? null,
      receipts: p.ProductReceipt ?? [],
      Branch: undefined,
      ProductReceipt: undefined,
    }));

    return NextResponse.json({
      products,
      page,
      limit,
      total,
      hasMore: page * limit < total,
    });
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
    const productUom = normalizeProductUom(uom);

    if (!name || !origin || !uom || !quantity || quantity <= 0) {
      return NextResponse.json(
        { error: 'Missing required fields: name, origin, uom, quantity' },
        { status: 400 }
      );
    }

    if (!productUom) {
      return NextResponse.json(
        { error: 'uom must be KG' },
        { status: 400 }
      );
    }

    if (!['LOCAL_PURCHASE', 'IMPORTED', 'FACTORY_MADE'].includes(origin)) {
      return NextResponse.json(
        { error: 'origin must be LOCAL_PURCHASE, IMPORTED, or FACTORY_MADE' },
        { status: 400 }
      );
    }

    const { withTenantTransaction } = await import('@/lib/tenant-prisma');

    // Wrap the find-or-create + receipt write in one transaction so the
    // product upsert AND the receipt either both land or neither does.
    // Use atomic `increment` for the stock so concurrent POSTs to the same
    // name+origin+branch don't lose each other's deltas.
    const { product, receipt, wasUpdate } = await withTenantTransaction(
      user.organizationId,
      async (tx) => {
        const existing = await tx.product.findFirst({
          where: { name, origin, branchId: branchId ?? null },
        });

        let product: { id: string };
        let wasUpdate: boolean;

        if (existing) {
          product = await tx.product.update({
            where: { id: existing.id },
            data: {
              currentStock: { increment: Number(quantity) },
              ...(unitCost !== undefined && unitCost !== null
                ? { unitCost: Number(unitCost) }
                : {}),
              ...(landingCost !== undefined && landingCost !== null
                ? { landingCost: Number(landingCost) }
                : {}),
              ...(vendor ? { vendor } : {}),
            },
          });
          await incrementProductShadowStock(tx, existing.sku, Number(quantity));
          wasUpdate = true;
        } else {
          // Generate a simple SKU. Concurrent creates with the same name are
          // disambiguated by the unique (organizationId, sku) constraint —
          // if a collision happens, the transaction aborts and the caller
          // can retry.
          const sku = `${origin.slice(0, 3)}-${name
            .replace(/\s+/g, '-')
            .toUpperCase()
            .slice(0, 20)}-${Date.now().toString().slice(-6)}`;

          product = await tx.product.create({
            data: {
              name,
              sku,
              origin,
              uom: productUom,
              currentStock: Number(quantity),
              unitCost: unitCost ? Number(unitCost) : null,
              landingCost: landingCost ? Number(landingCost) : null,
              vendor: vendor || null,
              branchId: branchId || null,
            },
          });
          wasUpdate = false;
        }

        // Receipt write is now part of the same transaction
        const receipt = await tx.productReceipt.create({
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

        return { product, receipt, wasUpdate };
      },
      { maxWait: 10000, timeout: 30000 }
    );

    return NextResponse.json(
      {
        message: wasUpdate ? 'Stock updated successfully' : 'Product added successfully',
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

"use server";

import { getTenantPrisma } from "@/lib/tenant-prisma";
import { requireActiveAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { normalizeProductUom, type ProductUom } from "@/lib/products";
import { incrementProductShadowStock } from "@/lib/order-lifecycle";

// ─── Raw Materials ──────────────────────────────────────────────────────────

export async function getRawMaterials() {
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);

  const materials = await db.rawMaterial.findMany({
    include: { Supplier: true },
    orderBy: { materialName: "asc" },
  });

  return materials.map((m) => ({
    id: m.id,
    materialName: m.materialName,
    diameter: m.diameter,
    length: m.length,
    width: m.width,
    height: m.height,
    availableKg: m.availableKg,
    reservedKg: m.reservedKg,
    availablePieces: m.availablePieces,
    supplier: m.Supplier,
    createdAt: m.createdAt,
  }));
}

export async function addRawMaterial(formData: FormData) {
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);

  const materialName = String(formData.get("materialName") || "").trim();
  const diameter = String(formData.get("diameter") || "").trim();
  const supplierName = String(formData.get("supplier") || "").trim();
  const kg = Number(formData.get("kg"));
  const pieces = Number(formData.get("pieces"));

  if (!materialName || !diameter || !Number.isFinite(kg) || kg <= 0 || !Number.isInteger(pieces) || pieces <= 0) {
    throw new Error("Material name, diameter, received kilograms, and pieces are required.");
  }

  let supplierId: string | undefined;
  if (supplierName) {
    const existingSupplier = await db.supplier.findFirst({
      where: { name: supplierName },
      select: { id: true },
    });

    if (existingSupplier) {
      supplierId = existingSupplier.id;
    } else {
      const createdSupplier = await db.supplier.create({
        data: {
          name: supplierName,
          code: `SUP-${Date.now().toString().slice(-6)}`,
          organizationId: user.organizationId,
        },
        select: { id: true },
      });
      supplierId = createdSupplier.id;
    }
  }

  const sku = `RAW-${materialName.replace(/\s+/g, "-").toUpperCase()}-${diameter.replace(/\s+/g, "").toUpperCase()}`;

  const material = await db.rawMaterial.upsert({
    where: {
      organizationId_sku: {
        organizationId: user.organizationId,
        sku,
      },
    },
    update: {
      materialName,
      diameter,
      supplierId,
      availableKg: { increment: kg },
      availablePieces: { increment: pieces },
    },
    create: {
      organizationId: user.organizationId,
      sku,
      materialName,
      diameter,
      supplierId,
      availableKg: kg,
      reservedKg: 0,
      availablePieces: pieces,
    },
  });

  await db.materialReceipt.create({
    data: {
      organizationId: user.organizationId,
      materialId: material.id,
      kgReceived: kg,
      piecesReceived: pieces,
      supplierId,
      loggedBy: user.email || user.name || "System",
    },
  });

  revalidatePath("/rawmaterials");
  revalidatePath("/warehouse");
  revalidatePath("/inventory");
}

// ─── Local Purchase & Imported Goods ────────────────────────────────────────

export type AddProductStockInput = {
  name: string;
  origin: "LOCAL_PURCHASE" | "IMPORTED";
  uom: ProductUom;
  quantity: number;
  unitCost?: number;
  landingCost?: number;
  vendor?: string;
  branchId?: string;
  reference?: string;
};

export async function addProductStock(input: AddProductStockInput) {
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);

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
  } = input;

  if (!name || !origin || !uom || quantity <= 0) {
    throw new Error("Missing required fields: name, origin, uom, quantity > 0");
  }
  const productUom = normalizeProductUom(uom);
  if (!productUom) {
    throw new Error("UOM must be KG");
  }

  // Upsert Product
  const existing = await db.product.findFirst({
    where: { name, origin, branchId: branchId ?? null },
  });

  let product;
  if (existing) {
    product = await db.product.update({
      where: { id: existing.id },
      data: {
        currentStock: existing.currentStock + quantity,
        unitCost: unitCost ?? existing.unitCost,
        landingCost: landingCost ?? existing.landingCost,
        vendor: vendor ?? existing.vendor,
        updatedAt: new Date(),
      },
    });
    await incrementProductShadowStock(db, existing.sku, quantity);
  } else {
    const sku = `${origin.slice(0, 3)}-${name
      .replace(/\s+/g, "-")
      .toUpperCase()
      .slice(0, 20)}-${Date.now().toString().slice(-6)}`;

    product = await db.product.create({
      data: {
        organizationId: user.organizationId,
        name,
        sku,
        origin,
        uom: productUom,
        currentStock: quantity,
        unitCost: unitCost ?? null,
        landingCost: landingCost ?? null,
        vendor: vendor ?? null,
        branchId: branchId ?? null,
      },
    });
  }

  // Audit receipt
  await db.productReceipt.create({
    data: {
      organizationId: user.organizationId,
      productId: product.id,
      qtyReceived: quantity,
      unitCost: unitCost ?? null,
      landingCost: landingCost ?? null,
      reference: reference ?? null,
      vendor: vendor ?? null,
      loggedBy: (user as { email?: string; name?: string }).email ?? null,
      branchId: branchId ?? null,
    },
  });

  revalidatePath("/inventory");
  return { success: true, product };
}

// ─── Getters for inventory page ─────────────────────────────────────────────

export async function getProducts(origin?: "LOCAL_PURCHASE" | "IMPORTED" | "FACTORY_MADE") {
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);

  const products = await db.product.findMany({
    where: origin ? { origin } : undefined,
    include: {
      Branch: { select: { name: true } },
      ProductReceipt: { orderBy: { createdAt: "desc" }, take: 50 },
    },
    orderBy: { createdAt: "desc" },
  });

  return products;
}

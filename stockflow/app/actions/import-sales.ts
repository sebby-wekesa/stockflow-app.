"use server";

import { requireAuth } from "@/lib/auth";
import { getTenantPrisma, withTenantTransaction } from "@/lib/tenant-prisma";
import type { SaleStatus } from "@prisma/client";

interface ParsedSaleRow {
  date: Date;
  num: string;
  customerName: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
}

export async function importSalesData(rawText: string, branchName: string = "Nairobi") {
  const user = await requireAuth();

  if (!["ADMIN", "WAREHOUSE"].includes(user.role)) {
    throw new Error("Unauthorized: Only admins and warehouse staff can import sales");
  }

  const db = getTenantPrisma(user.organizationId);
  const branch = await db.branch.findFirst({ where: { name: branchName, organizationId: user.organizationId } });
  if (!branch) {
    throw new Error(`Branch '${branchName}' not found for this organization`);
  }

  const lines = rawText.trim().split(/\r?\n/);
  if (lines.length < 2) {
    throw new Error("No data to import");
  }

  // Skip header line
  const dataLines = lines.slice(1);

  const sales: ParsedSaleRow[] = [];

  for (const line of dataLines) {
    if (!line.trim()) continue;

    // Simple CSV split (handles quoted fields)
    const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((c) => c.replace(/^"|"$/g, "").trim());

    // Expected positions based on your pasted header:
    // Date,Num,Name,...,Item,Qty,Rate,Amount
    const dateStr = cols[0];
    const num = cols[1] || `SALE-${Date.now()}`;
    const customerName = cols[2] || "Walk-in Customer";
    const item = cols[11] || ""; // Item column
    const qtyStr = cols[12] || "0";
    const rateStr = cols[13] || "0";
    const amountStr = cols[14] || "0";

    if (!item) continue;

    const quantity = Math.abs(parseFloat(qtyStr)) || 0;
    const unitPrice = parseFloat(rateStr) || 0;
    const totalAmount = parseFloat(amountStr) || quantity * unitPrice;
    const date = dateStr ? new Date(dateStr) : new Date();

    sales.push({
      date,
      num,
      customerName,
      productName: item.toUpperCase().trim(),
      quantity,
      unitPrice,
      totalAmount,
    });
  }

  let created = 0;

  await withTenantTransaction(user.organizationId, async (tx) => {
    for (const sale of sales) {
      let product = await tx.product.findFirst({
        where: { name: sale.productName, branchId: branch.id },
      });

      if (!product) {
        product = await tx.product.create({
          data: {
            name: sale.productName,
            sku: `${branchName}-${sale.productName}`,
            category: "break_linings",
            branchId: branch.id,
            currentStock: 0,
          },
        });
      }

      await tx.saleOrder.create({
        data: {
          customerName: sale.customerName,
          totalAmount: sale.totalAmount,
          status: 'CONFIRMED' satisfies SaleStatus,
          createdAt: sale.date,
          SaleItem: {
            create: {
              finishedGoodsId: product.id,
              quantity: sale.quantity,
              unitPrice: sale.unitPrice,
              totalPrice: sale.totalAmount,
            },
          },
        },
      });

      await tx.stockMovement.create({
        data: {
          productId: product.id,
          branchId: branch.id,
          movementType: "SALE",
          quantity: -sale.quantity,
          reference: sale.num,
          notes: "Imported sales data",
          createdAt: sale.date,
        },
      });

      created++;
    }
  });

  return { success: true, imported: created };
}

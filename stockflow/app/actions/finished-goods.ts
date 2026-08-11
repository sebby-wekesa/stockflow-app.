"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireActiveAuth } from "@/lib/auth";
import { getTenantPrisma, withTenantTransaction } from "@/lib/tenant-prisma";

const finishedGoodsProductionSchema = z.object({
  jobCardNo: z.string().trim().min(1, "Job card number is required"),
  submissionId: z.string().uuid().optional(),
  productionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date"),
  springProductId: z.string().trim().optional(),
  newSpringType: z.string().trim().max(200, "Spring type is too long").optional(),
  pcsProduced: z.coerce.number().finite().int().positive("Pcs produced must be a positive whole number"),
  weightPerPiece: z.coerce.number().finite().positive("Weight per piece must be positive"),
  totalWeight: z.coerce.number().finite().positive("Total weight must be positive"),
});

function getMombasaBranchWhere() {
  return {
    OR: [
      { code: "MSA" },
      { name: { contains: "Mombasa", mode: "insensitive" as const } },
      { location: { contains: "Mombasa", mode: "insensitive" as const } },
    ],
  };
}

function getMombasaSpringWhere(branchId: string, branchCode: string) {
  return {
    category: "springs" as const,
    OR: [
      { branchId: { in: [branchId, branchCode, "mombasa"] } },
      { branchStocks: { some: { branchId } } },
    ],
  };
}

export async function recordFinishedGoodsProduction(formData: FormData) {
  const user = await requireActiveAuth();
  if (!["ADMIN", "MANAGER"].includes(user.role)) {
    throw new Error("Only admins and managers can record finished-goods production");
  }

  const springProductId = String(formData.get("springProductId") ?? "").trim();
  const newSpringType = String(formData.get("newSpringType") ?? "").trim();
  const submissionId = String(formData.get("submissionId") ?? "").trim();
  const parsed = finishedGoodsProductionSchema.safeParse({
    jobCardNo: formData.get("jobCardNo"),
    submissionId: submissionId || undefined,
    productionDate: formData.get("productionDate"),
    springProductId: springProductId || undefined,
    newSpringType: newSpringType || undefined,
    pcsProduced: formData.get("pcsProduced"),
    weightPerPiece: formData.get("weightPerPiece"),
    totalWeight: formData.get("totalWeight"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  if (springProductId && newSpringType) {
    throw new Error("Choose an existing spring type or enter a new one, not both");
  }
  if (!springProductId && !newSpringType) {
    throw new Error("Choose an existing spring type or enter a new one");
  }

  const data = parsed.data;
  const productionDate = new Date(`${data.productionDate}T00:00:00.000Z`);
  if (Number.isNaN(productionDate.getTime()) || productionDate.toISOString().slice(0, 10) !== data.productionDate) {
    throw new Error("Enter a valid date");
  }

  const expectedTotal = data.pcsProduced * data.weightPerPiece;
  if (Math.abs(expectedTotal - data.totalWeight) > 0.01) {
    throw new Error("Total weight must equal pcs produced multiplied by weight per piece");
  }

  const db = getTenantPrisma(user.organizationId);
  const mombasaBranch = await db.branch.findFirst({
    where: getMombasaBranchWhere(),
    select: { id: true, code: true, name: true },
  });
  if (!mombasaBranch) throw new Error("Mombasa Branch has not been configured");

  const springWhere = getMombasaSpringWhere(mombasaBranch.id, mombasaBranch.code);
  const product = springProductId
    ? await db.product.findFirst({
        where: { ...springWhere, id: springProductId },
        select: { id: true, name: true },
      })
    : await db.product.findFirst({
        where: { ...springWhere, name: { equals: newSpringType, mode: "insensitive" } },
        select: { id: true, name: true },
      });

  if (springProductId && !product) {
    throw new Error("That spring type does not exist in Mombasa Springs");
  }

  let transactionResult: { duplicate: boolean } | undefined;
  try {
    transactionResult = await withTenantTransaction(user.organizationId, async (tx) => {
      const existingLog = await tx.finishedGoodsProductionLog.findFirst({
        where: data.submissionId
          ? { submissionId: data.submissionId }
          : { jobCardNo: data.jobCardNo },
        select: { id: true },
      });
      if (existingLog) return { duplicate: true };

      let productId = product?.id;
      let productName = product?.name;

      if (!productId || !productName) {
        const created = await tx.product.create({
          data: {
            name: newSpringType,
            sku: `SPR-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`,
            category: "springs",
            origin: "FACTORY_MADE",
            uom: "KG",
            branchId: mombasaBranch.id,
            currentStock: 0,
            piecesSets: 0,
          },
          select: { id: true, name: true },
        });
        productId = created.id;
        productName = created.name;
      }
      if (!productId || !productName) throw new Error("Spring type could not be resolved");

      const log = await tx.finishedGoodsProductionLog.create({
        data: {
          jobCardNo: data.jobCardNo,
          submissionId: data.submissionId ?? null,
          productionDate,
          springProductId: productId,
          branchId: mombasaBranch.id,
          pcsProduced: data.pcsProduced,
          weightPerPiece: data.weightPerPiece,
          totalWeight: data.totalWeight,
        },
      });

      await tx.product.update({
        where: { id: productId },
        data: {
          currentStock: { increment: data.totalWeight },
          piecesSets: { increment: data.pcsProduced },
        },
      });

      await tx.productBranchStock.upsert({
        where: {
          branchId_productId: {
            branchId: mombasaBranch.id,
            productId,
          },
        },
        update: {
          availableQty: { increment: data.totalWeight },
          availablePiecesSets: { increment: data.pcsProduced },
        },
        create: {
          productId,
          branchId: mombasaBranch.id,
          availableQty: data.totalWeight,
          availablePiecesSets: data.pcsProduced,
        },
      });

      await tx.stockMovement.create({
        data: {
          productId,
          branchId: mombasaBranch.id,
          movementType: "production",
          quantity: data.totalWeight,
          piecesSets: data.pcsProduced,
          reference: data.jobCardNo,
          notes: "Finished-goods production recorded",
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "FINISHED_GOODS_PRODUCTION_RECORDED",
          entityType: "FinishedGoodsProductionLog",
          entityId: log.id,
          details: JSON.stringify({
            jobCardNo: data.jobCardNo,
            springType: productName,
            pcsProduced: data.pcsProduced,
            weightPerPiece: data.weightPerPiece,
            totalWeight: data.totalWeight,
            branch: mombasaBranch.name,
          }),
        },
      });

      return { duplicate: false, logId: log.id };
    }, { maxWait: 10000, timeout: 30000 });
  } catch (error) {
    // The unique submission-ID constraint also protects against two identical
    // submissions that reach the database at the same time.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return;
    }
    throw error;
  }

  if (transactionResult?.duplicate) return;

  revalidatePath("/finishedgoods");
  revalidatePath("/products");
  revalidatePath("/stock");
  revalidatePath("/dashboard");
}

export async function deleteFinishedGoodsProduction(logId: string) {
  const user = await requireActiveAuth();
  if (!["ADMIN", "MANAGER"].includes(user.role)) {
    throw new Error("Only admins and managers can delete finished-goods production records");
  }

  const parsedLogId = z.string().trim().min(1).safeParse(logId);
  if (!parsedLogId.success) throw new Error("Production record not found");

  await withTenantTransaction(user.organizationId, async (tx) => {
    const log = await tx.finishedGoodsProductionLog.findFirst({
      where: { id: parsedLogId.data },
      select: {
        id: true,
        jobCardNo: true,
        springProductId: true,
        branchId: true,
        pcsProduced: true,
        totalWeight: true,
      },
    });
    if (!log) throw new Error("Finished-goods production record not found");

    const totalWeight = Number(log.totalWeight);
    const branchStock = await tx.productBranchStock.updateMany({
      where: {
        productId: log.springProductId,
        branchId: log.branchId,
        availableQty: { gte: totalWeight },
        availablePiecesSets: { gte: log.pcsProduced },
      },
      data: {
        availableQty: { decrement: totalWeight },
        availablePiecesSets: { decrement: log.pcsProduced },
      },
    });
    if (branchStock.count === 0) {
      throw new Error("Cannot delete this record because some of its stock has already been used or transferred");
    }

    const productStock = await tx.product.updateMany({
      where: {
        id: log.springProductId,
        currentStock: { gte: totalWeight },
        piecesSets: { gte: log.pcsProduced },
      },
      data: {
        currentStock: { decrement: totalWeight },
        piecesSets: { decrement: log.pcsProduced },
      },
    });
    if (productStock.count === 0) {
      throw new Error("Cannot delete this record because the product stock has already been used");
    }

    await tx.stockMovement.create({
      data: {
        productId: log.springProductId,
        branchId: log.branchId,
        movementType: "production_reversal",
        quantity: -totalWeight,
        piecesSets: -log.pcsProduced,
        reference: log.jobCardNo,
        notes: "Finished-goods production record deleted",
      },
    });

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "FINISHED_GOODS_PRODUCTION_DELETED",
        entityType: "FinishedGoodsProductionLog",
        entityId: log.id,
        details: JSON.stringify({
          jobCardNo: log.jobCardNo,
          pcsProduced: log.pcsProduced,
          totalWeight,
          branchId: log.branchId,
        }),
      },
    });

    await tx.finishedGoodsProductionLog.delete({ where: { id: log.id } });
  }, { maxWait: 10000, timeout: 30000 });

  revalidatePath("/finishedgoods");
  revalidatePath("/products");
  revalidatePath("/stock");
  revalidatePath("/dashboard");
}

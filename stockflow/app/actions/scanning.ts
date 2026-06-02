"use server";

import { getTenantPrisma } from "@/lib/tenant-prisma";
import { requireActiveAuth } from "@/lib/auth";
import { getBarcodeData } from "@/app/actions/barcodes";
import { z } from "zod";

const scanResultSchema = z.object({
  barcode: z.string().min(1),
  type: z.enum(['raw_material', 'finished_goods']),
  kgIn: z.number().min(0),
  kgOut: z.number().min(0),
  scrapReason: z.string().optional(),
  notes: z.string().optional()
});

export async function scanBarcode(barcode: string) {
  const user = await requireActiveAuth();

  if (!['OPERATOR', 'WAREHOUSE', 'PACKAGING', 'ADMIN'].includes(user.role)) {
    throw new Error('Unauthorized: Insufficient permissions for scanning');
  }

  try {
    const barcodeData = await getBarcodeData(barcode);
    return barcodeData;
  } catch (error) {
    throw new Error('Invalid or unrecognized barcode');
  }
}

export async function processScan(data: {
  barcode: string;
  type: 'raw_material' | 'finished_goods';
  kgIn: number;
  kgOut: number;
  scrapReason?: string;
  notes?: string;
}) {
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);

  if (!['OPERATOR', 'WAREHOUSE', 'PACKAGING', 'ADMIN'].includes(user.role)) {
    throw new Error('Unauthorized: Insufficient permissions for processing scans');
  }

  // Validate input
  const validatedData = scanResultSchema.parse(data);

  // Calculate scrap (kg_in - kg_out)
  const kgScrap = Math.max(0, validatedData.kgIn - validatedData.kgOut);

  return await db.$transaction(async (tx) => {
    if (validatedData.type === 'raw_material') {
      // Handle raw material receipt/processing
      const material = await tx.rawMaterial.findUnique({
        where: {
          organizationId_barcode: {
            organizationId: user.organizationId,
            barcode: validatedData.barcode,
          },
        },
      });

      if (!material) {
        throw new Error('Raw material not found');
      }

      // For raw material intake (warehouse role)
      if (user.role === 'WAREHOUSE') {
        // Create material receipt
        await tx.materialReceipt.create({
          data: {
            organizationId: user.organizationId,
            materialId: material.id,
            kgReceived: validatedData.kgIn,
            piecesReceived: 0,
            loggedBy: user.id,
            reference: `SCAN-${Date.now()}`
          }
        });

        // Update available stock
        await tx.rawMaterial.update({
          where: { id: material.id },
          data: {
            availableKg: { increment: validatedData.kgIn },
            updatedAt: new Date()
          }
        });
      } else if (user.role === 'OPERATOR') {
        // For operator processing, this would typically be part of stage logging
        // For now, just log the scan
        console.log('Operator scanned raw material:', validatedData);
      }

    } else if (validatedData.type === 'finished_goods') {
      // Handle finished goods processing (packaging role)
      const finishedGoods = await tx.finishedGoods.findUnique({
        where: {
          organizationId_barcode: {
            organizationId: user.organizationId,
            barcode: validatedData.barcode,
          },
        },
      });

      if (!finishedGoods) {
        throw new Error('Finished goods not found');
      }

      // For packaging, this could be quality check or shipping preparation
      // For now, just log the processing
      console.log('Packaging processed finished goods:', validatedData);
    }

    // Log the scan event for audit trail
    await tx.auditLog.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        action: 'BARCODE_SCAN_PROCESSED',
        entityType: validatedData.type,
        entityId: validatedData.barcode,
        details: JSON.stringify({
          kgIn: validatedData.kgIn,
          kgOut: validatedData.kgOut,
          kgScrap: kgScrap,
          scrapReason: validatedData.scrapReason,
          notes: validatedData.notes
        }),
        ipAddress: 'mobile-scan', // Would get real IP in production
        userAgent: 'mobile-app'
      }
    });

    return {
      success: true,
      processed: validatedData,
      scrapCalculated: kgScrap
    };
  });
}

// Get recent scans for the current user
export async function getRecentScans(limit: number = 10) {
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);

  const recentLogs = await db.auditLog.findMany({
    where: {
      userId: user.id,
      action: 'BARCODE_SCAN_PROCESSED'
    },
    orderBy: { createdAt: 'desc' },
    take: limit
  });

  return recentLogs.map(log => ({
    id: log.id,
    timestamp: log.createdAt,
    entityType: log.entityType,
    entityId: log.entityId,
    details: log.details ? JSON.parse(log.details) : null
  }));
}

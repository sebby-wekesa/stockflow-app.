"use server";

import { getTenantPrisma } from "@/lib/tenant-prisma";
import { requireActiveAuth } from "@/lib/auth";
import { designSchema } from "@/lib/schemas";
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';

export async function createDesign(data: {
  name: string;
  code: string;
  description?: string;
  targetDimensions?: string;
  targetWeight?: number;
  stages: {
    name: string;
    department: string;
    sequence: number;
  }[];
  bomItems?: {
    rawMaterialId: string;
    quantity: number;
    unitOfMeasure: string;
  }[];
}) {
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);

  // Validate user permissions
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
    throw new Error('Unauthorized: Only admins and managers can create design templates');
  }

  // Validate input data
  const validatedData = designSchema.parse(data);

  // Check if design code already exists (tenant-scoped)
  const existingDesign = await db.design.findUnique({
    where: {
      organizationId_code: {
        organizationId: user.organizationId,
        code: validatedData.code,
      },
    },
  });

  if (existingDesign) {
    throw new Error('Design code already exists');
  }

  // Use database transaction for atomicity
  return await db.$transaction(async (tx) => {
    // Create the design
    const design = await tx.design.create({
      data: {
        name: validatedData.name,
        code: validatedData.code,
        description: validatedData.description,
        targetDimensions: validatedData.targetDimensions,
        targetWeight: validatedData.targetWeight,
        organizationId: user.organizationId
      }
    });

    // Create the stages
    for (const stageData of validatedData.stages) {
        await tx.stage.create({
          data: {
            name: stageData.name,
            department: stageData.department,
            sequence: stageData.sequence,
            designId: design.id,
            organizationId: user.organizationId
          }
        });
    }

    // Create BOM items if provided
    if (data.bomItems && data.bomItems.length > 0) {
      for (const bomData of data.bomItems) {
            await tx.billOfMaterials.create({
              data: {
                designId: design.id,
                rawMaterialId: bomData.rawMaterialId,
                quantity: bomData.quantity,
                unitOfMeasure: bomData.unitOfMeasure,
                organizationId: user.organizationId
              }
            });
      }
    }

    // Fetch the complete design with stages and BOM
    const completeDesign = await tx.design.findUnique({
      where: { id: design.id },
      include: {
        stages: {
          orderBy: { sequence: 'asc' }
        },
            billOfMaterials: {
              include: {
                RawMaterial: true
              }
            }
      },
    });

    revalidatePath('/designs');

    return completeDesign;
  });
}

export async function updateDesign(id: string, data: {
  name?: string;
  code?: string;
  description?: string;
  targetDimensions?: string;
  targetWeight?: number;
  stages?: {
    name: string;
    department: string;
    sequence: number;
  }[];
  bomItems?: {
    rawMaterialId: string;
    quantity: number;
    unitOfMeasure: string;
  }[];
}) {
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);

  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
    throw new Error('Unauthorized: Only admins and managers can update design templates');
  }

  return await db.$transaction(async (tx) => {
    const design = await tx.design.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.code && { code: data.code }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.targetDimensions !== undefined && { targetDimensions: data.targetDimensions }),
        ...(data.targetWeight !== undefined && { targetWeight: data.targetWeight })
      }
    });

    if (data.stages) {
      await tx.stage.deleteMany({ where: { designId: id } });
      for (const stageData of data.stages) {
        await tx.stage.create({
          data: {
            name: stageData.name,
            department: stageData.department,
            sequence: stageData.sequence,
            designId: id,
            organizationId: user.organizationId
          }
        });
      }
    }

    if (data.bomItems !== undefined) {
      await tx.billOfMaterials.deleteMany({ where: { designId: id } });
      if (data.bomItems.length > 0) {
        for (const bomData of data.bomItems) {
          await tx.billOfMaterials.create({
            data: {
              designId: id,
              rawMaterialId: bomData.rawMaterialId,
              quantity: bomData.quantity,
              unitOfMeasure: bomData.unitOfMeasure,
              organizationId: user.organizationId
            }
          });
        }
      }
    }

    const updatedDesign = await tx.design.findUnique({
      where: { id },
      include: {
        stages: { orderBy: { sequence: 'asc' } },
        billOfMaterials: {
          include: { RawMaterial: true }
        }
      }
    });

    revalidatePath('/designs');
    return updatedDesign;
  });
}

export async function deleteDesign(id: string) {
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);

  // Validate user permissions
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
    throw new Error('Unauthorized: Only admins and managers can delete design templates');
  }

  // Check if design is used in any production orders
  const orderCount = await db.productionOrder.count({
    where: { designId: id }
  });

  if (orderCount > 0) {
    throw new Error('Cannot delete design that is referenced by production orders');
  }

  await db.design.delete({
    where: { id }
  });

  revalidatePath('/designs');

  return { success: true };
}
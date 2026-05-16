"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
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
  const user = await requireAuth();

  // Validate user permissions
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
    throw new Error('Unauthorized: Only admins and managers can create design templates');
  }

  // Validate input data
  const validatedData = designSchema.parse(data);

  // Check if design code already exists
  const existingDesign = await prisma.design.findUnique({
    where: { code: validatedData.code }
  });

  if (existingDesign) {
    throw new Error('Design code already exists');
  }

  // Use database transaction for atomicity
  return await prisma.$transaction(async (tx) => {
    // Create the design
    const design = await tx.design.create({
      data: {
        name: validatedData.name,
        code: validatedData.code,
        description: validatedData.description,
        targetDimensions: validatedData.targetDimensions,
        targetWeight: validatedData.targetWeight
      }
    });

    // Create the stages
    for (const stageData of validatedData.stages) {
      await tx.stage.create({
        data: {
          name: stageData.name,
          department: stageData.department,
          sequence: stageData.sequence,
          designId: design.id
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
            unitOfMeasure: bomData.unitOfMeasure
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
      }
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
  const user = await requireAuth();

  // Validate user permissions
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
    throw new Error('Unauthorized: Only admins and managers can update design templates');
  }

  return await prisma.$transaction(async (tx) => {
    // Update the design
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

    // Update stages if provided
    if (data.stages) {
      // Delete existing stages
      await tx.stage.deleteMany({
        where: { designId: id }
      });

      // Create new stages
      for (const stageData of data.stages) {
        await tx.stage.create({
          data: {
            name: stageData.name,
            department: stageData.department,
            sequence: stageData.sequence,
            designId: id
          }
        });
      }
    }

    // Update BOM items if provided
    if (data.bomItems !== undefined) {
      // Delete existing BOM items
      await tx.billOfMaterials.deleteMany({
        where: { designId: id }
      });

      // Create new BOM items
      if (data.bomItems.length > 0) {
        for (const bomData of data.bomItems) {
          await tx.billOfMaterials.create({
            data: {
              designId: id,
              rawMaterialId: bomData.rawMaterialId,
              quantity: bomData.quantity,
              unitOfMeasure: bomData.unitOfMeasure
            }
          });
        }
      }
    }

    // Fetch the updated design with stages and BOM
    const updatedDesign = await tx.design.findUnique({
      where: { id },
      include: {
        stages: {
          orderBy: { sequence: 'asc' }
        },
        billOfMaterials: {
          include: {
            RawMaterial: true
          }
        }
      }
    });

    revalidatePath('/designs');

    return updatedDesign;
  });
}

export async function deleteDesign(id: string) {
  const user = await requireAuth();

  // Validate user permissions
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
    throw new Error('Unauthorized: Only admins and managers can delete design templates');
  }

  // Check if design is used in any production orders
  const orderCount = await prisma.productionOrder.count({
    where: { designId: id }
  });

  if (orderCount > 0) {
    throw new Error('Cannot delete design that is referenced by production orders');
  }

  await prisma.design.delete({
    where: { id }
  });

  revalidatePath('/designs');

  return { success: true };
}
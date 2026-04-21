"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { designSchema } from "@/lib/validations";

export async function saveDesign(data: {
  name: string;
  code: string;
  targetDimensions: string;
  targetWeight: number;
  kgPerUnit: number;
  stages: { name: string; department: string; sequence: number }[];
}) {
  await requireRole("ADMIN");

  const validatedData = designSchema.parse(data);

  try {
    const design = await prisma.$transaction(async (tx) => {
      // 1. Create the Design header
      const newDesign = await tx.design.create({
        data: {
          name: validatedData.name,
          code: validatedData.code,
          targetDimensions: validatedData.targetDimensions,
          targetWeight: validatedData.targetWeight,
          kgPerUnit: validatedData.kgPerUnit,
          // 2. Create all stages linked to this design
          stages: {
            create: validatedData.stages.map((stage) => ({
              name: stage.name,
              department: stage.department,
              sequence: stage.sequence,
            })),
          },
        },
      });
      return newDesign;
    });

    revalidatePath("/dashboard/admin/designs");
    return { success: true, design };
  } catch (error: any) {
    console.error("Design Save Error:", error);
    if (error.code === 'P2002') return { error: "Design Code already exists." };
    return { error: "Failed to save design template." };
  }
}
"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";

export async function bulkImportDesigns(data: any[]) {
  await requireRole("ADMIN");

  try {
    const result = await prisma.$transaction(async (tx) => {
      for (const item of data) {
        await tx.design.create({
          data: {
            name: item.name,
            code: item.code,
            targetDimensions: item.dimensions,
            targetWeight: parseFloat(item.weight),
            kgPerUnit: parseFloat(item.kgPerUnit),
            // Defaulting to a single stage if none provided in sheet
            stages: {
              create: {
                name: "Initial Processing",
                department: "Cutting",
                sequence: 1,
              }
            }
          }
        });
      }
    });

    revalidatePath("/dashboard/admin/designs");
    return { success: true, count: data.length };
  } catch (error: any) {
    console.error("Bulk Import Error:", error);
    return { error: "Import failed. Please check for duplicate codes or invalid numbers." };
  }
}
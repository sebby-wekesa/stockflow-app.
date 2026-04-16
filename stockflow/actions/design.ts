"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { designSchema, DesignInput } from "@/lib/validations";

export async function createDesign(formData: FormData) {
  await requireRole("ADMIN");

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const targetDimensions = formData.get("targetDimensions") as string;
  const targetWeight = formData.get("targetWeight");

  const stagesData: { name: string; sequence: number }[] = [];
  let i = 0;
  while (formData.has(`stages[${i}].name`)) {
    const stageName = formData.get(`stages[${i}].name`) as string;
    if (stageName) {
      stagesData.push({ name: stageName, sequence: i + 1 });
    }
    i++;
  }

  const input: DesignInput = {
    name,
    description: description || undefined,
    targetDimensions: targetDimensions || undefined,
    targetWeight: targetWeight ? parseFloat(targetWeight as string) : undefined,
    stages: stagesData,
  };

  designSchema.parse(input);

  const design = await prisma.design.create({
    data: {
      name: input.name,
      description: input.description,
      targetDimensions: input.targetDimensions,
      targetWeight: input.targetWeight,
      stages: {
        create: input.stages,
      },
    },
  });

  redirect(`/designs/${design.id}`);
}

export async function updateDesign(id: string, formData: FormData) {
  await requireRole("ADMIN");

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const targetDimensions = formData.get("targetDimensions") as string;
  const targetWeight = formData.get("targetWeight");

  const stagesData: { name: string; sequence: number }[] = [];
  let i = 0;
  while (formData.has(`stages[${i}].name`)) {
    const stageName = formData.get(`stages[${i}].name`) as string;
    if (stageName) {
      stagesData.push({ name: stageName, sequence: i + 1 });
    }
    i++;
  }

  const input: DesignInput = {
    name,
    description: description || undefined,
    targetDimensions: targetDimensions || undefined,
    targetWeight: targetWeight ? parseFloat(targetWeight as string) : undefined,
    stages: stagesData,
  };

  designSchema.parse(input);

  await prisma.$transaction([
    prisma.stage.deleteMany({ where: { designId: id } }),
    prisma.design.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        targetDimensions: input.targetDimensions,
        targetWeight: input.targetWeight,
        stages: { create: input.stages },
      },
    }),
  ]);

  redirect(`/designs/${id}`);
}
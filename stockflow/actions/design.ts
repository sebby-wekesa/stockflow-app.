"use server";

import { redirect } from "next/navigation";
import { requireActiveAuth } from "@/lib/auth";
import { designSchema, DesignInput } from "@/lib/validations";
import { getTenantPrisma } from "@/lib/tenant-prisma";

export async function createDesign(formData: FormData) {
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const targetDimensions = formData.get("targetDimensions") as string;
  const targetWeight = formData.get("targetWeight");

  // Auto-generate code from name (first letters of words, uppercase)
  const code = name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .join('')
    .substring(0, 10); // Limit to 10 characters

  const stagesData: { name: string; sequence: number; department: string }[] = [];
  let i = 0;
  while (formData.has(`stages[${i}].name`)) {
    const stageName = formData.get(`stages[${i}].name`) as string;
    if (stageName) {
      stagesData.push({
        name: stageName,
        sequence: i + 1,
        department: "Production",
      });
    }
    i++;
  }

  const input: DesignInput = {
    name,
    code,
    description: description || undefined,
    targetDimensions: targetDimensions || undefined,
    targetWeight: targetWeight ? parseFloat(targetWeight as string) : undefined,
    stages: stagesData,
  };

  designSchema.parse(input);

  const design = await db.design.create({
    data: {
      name: input.name,
      code: input.code,
      description: input.description,
      targetDimensions: input.targetDimensions,
      targetWeight: input.targetWeight,
      organizationId: user.organizationId,
      stages: {
        create: input.stages.map((s) => ({
          ...s,
          organizationId: user.organizationId,
        })),
      },
    },
  });

  redirect(`/designs/${design.id}`);
}

export async function updateDesign(id: string, formData: FormData) {
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const targetDimensions = formData.get("targetDimensions") as string;
  const targetWeight = formData.get("targetWeight");

  // Auto-generate code from name (first letters of words, uppercase)
  const code = name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .join('')
    .substring(0, 10); // Limit to 10 characters

  const stagesData: { name: string; sequence: number; department: string }[] = [];
  let i = 0;
  while (formData.has(`stages[${i}].name`)) {
    const stageName = formData.get(`stages[${i}].name`) as string;
    if (stageName) {
      stagesData.push({
        name: stageName,
        sequence: i + 1,
        department: "Production",
      });
    }
    i++;
  }

  const input: DesignInput = {
    name,
    code,
    description: description || undefined,
    targetDimensions: targetDimensions || undefined,
    targetWeight: targetWeight ? parseFloat(targetWeight as string) : undefined,
    stages: stagesData,
  };

  designSchema.parse(input);

  await db.$transaction([
    db.stage.deleteMany({ where: { designId: id } }),
    db.design.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        targetDimensions: input.targetDimensions,
        targetWeight: input.targetWeight,
        stages: {
          create: input.stages.map((s) => ({
            ...s,
            organizationId: user.organizationId,
          })),
        },
      },
    }),
  ]);

  redirect(`/designs/${id}`);
}
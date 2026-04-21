import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const designSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().min(1, "Code is required"),
  targetDimensions: z.string().min(1, "Target dimensions are required"),
  targetWeight: z.number().positive("Target weight must be positive"),
  kgPerUnit: z.number().nonnegative("KG per unit must be non-negative"),
  stages: z.array(
    z.object({
      name: z.string().min(1, "Stage name is required"),
      department: z.string().min(1, "Department is required"),
      sequence: z.number().int().positive("Sequence must be a positive integer"),
    })
  ).min(1, "At least one stage is required"),
});

export type DesignInput = z.infer<typeof designSchema>;
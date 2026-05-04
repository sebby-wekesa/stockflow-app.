import { z } from "zod/v4";

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const stageCompletionSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  stageId: z.string().optional(),
  stageName: z.string().min(1, "Stage name is required"),
  sequence: z.number().int().positive("Sequence must be a positive integer"),
  kgIn: z.number().min(0, "kgIn cannot be negative"),
  kgOut: z.number().min(0, "kgOut cannot be negative"),
  kgScrap: z.number().min(0, "kgScrap cannot be negative"),
  operatorId: z.string().min(1, "Operator ID is required"),
  department: z.string().optional(),
  notes: z.string().optional(),
}).refine(
  (data) => {
    // Special rule for Electroplating: Output can be HIGHER than Input due to coatings
    if (data.department === 'Electroplating') {
      return data.kgOut >= data.kgIn && data.kgScrap >= 0;
    }
    
    // Standard rule: In = Out + Scrap
    const total = Number(data.kgOut) + Number(data.kgScrap);
    const balance = Math.abs(total - data.kgIn);
    return balance < 0.01; // Allow for slight rounding
  },
  {
    message: "Kg balance error: For non-plating stages, kgIn must equal kgOut + kgScrap",
    path: ["kgOut"],
  }
);

export type StageCompletionInput = z.infer<typeof stageCompletionSchema>;

export const productionOrderSchema = z.object({
  designId: z.string().min(1, "Design is required"),
  quantity: z.number().int().positive("Quantity must be positive"),
  targetKg: z.number().positive("Target kg must be positive"),
});

export type ProductionOrderInput = z.infer<typeof productionOrderSchema>;

export const designSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  targetDimensions: z.string().max(100).optional(),
  targetWeight: z.number().positive().optional(),
  stages: z.array(z.object({
    name: z.string().min(1),
    sequence: z.number().int().positive(),
  })).min(1, "At least one stage is required"),
});

export type DesignInput = z.infer<typeof designSchema>;

// API validation schemas
export const createProductionOrderSchema = z.object({
  orderNumber: z.string().min(1, "Order number is required"),
  designId: z.string().min(1, "Design ID is required"),
  initialWeight: z.number().positive("Initial weight must be positive"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"], {
    errorMap: () => ({ message: "Priority must be LOW, MEDIUM, or HIGH" })
  }),
});

export const createProductionOrderWithReservationSchema = z.object({
  designId: z.string().min(1, "Design ID is required"),
  materialId: z.string().min(1, "Material ID is required"),
  quantity: z.number().positive("Quantity must be positive"),
  customerRef: z.string().optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    "PENDING",
    "IN_PRODUCTION",
    "COMPLETED",
    "CANCELLED",
    "ON_HOLD"
  ]),
  notes: z.string().optional(),
});

export const rawMaterialIntakeSchema = z.object({
  materialName: z.string().min(1, "Material name is required"),
  diameter: z.number().positive("Diameter must be positive"),
  length: z.number().positive("Length must be positive"),
  weightKg: z.number().positive("Weight must be positive"),
  supplierId: z.string().optional(),
  batchNumber: z.string().optional(),
  receivedDate: z.string().datetime().optional(),
});

export const logEntrySchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  stageId: z.string().optional(),
  operatorId: z.string().min(1, "Operator ID is required"),
  department: z.string().min(1, "Department is required"),
  kgIn: z.number().min(0, "kgIn cannot be negative"),
  kgOut: z.number().min(0, "kgOut cannot be negative"),
  kgScrap: z.number().min(0, "kgScrap cannot be negative"),
  scrapReason: z.string().optional(),
  notes: z.string().optional(),
});
import { z } from 'zod'

// Kg-balance validation: ensures kg_in = kg_out + kg_scrap
const kgBalanceRule = z.object({
  kgIn: z.number().min(0),
  kgOut: z.number().min(0),
  kgScrap: z.number().min(0)
}).refine(
  (data) => {
    const tolerance = 0.0001 // Allow for tiny floating point differences
    return Math.abs(data.kgIn - (data.kgOut + data.kgScrap)) < tolerance
  },
  {
    message: "KG balance rule violated: kg_in must equal kg_out + kg_scrap",
    path: ["kgIn"]
  }
)

export const stageLogSchema = z.object({
  orderId: z.string().min(1),
  stageId: z.string().optional(),
  stageName: z.string().min(1),
  sequence: z.number().int().min(1),
  kgIn: z.number().min(0).max(999999.9999),
  kgOut: z.number().min(0).max(999999.9999),
  kgScrap: z.number().min(0).max(999999.9999),
  scrapReason: z.string().optional(),
  department: z.string().optional(),
  operatorId: z.string().min(1),
  notes: z.string().optional()
}).and(kgBalanceRule)

export const productionOrderSchema = z.object({
  designId: z.string().min(1),
  quantity: z.number().int().min(1).max(999999),
  targetKg: z.number().min(0).max(999999.9999),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM')
})

export const bomItemSchema = z.object({
  rawMaterialId: z.string().min(1),
  quantity: z.number().positive().max(999999.9999),
  unitOfMeasure: z.string().min(1).max(10).default("kg")
})

export const designSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(50),
  description: z.string().optional(),
  targetDimensions: z.string().optional(),
  targetWeight: z.number().min(0).max(999999.9999).optional(),
  stages: z.array(z.object({
    name: z.string().min(1),
    department: z.string().min(1),
    sequence: z.number().int().min(1)
  })).min(1),
  bomItems: z.array(bomItemSchema).optional().default([])
}).refine(
  (data) => {
    // Ensure BOM items don't result in negative stock when validated
    // This is a basic check - full validation happens during consumption
    return data.bomItems.every(item => item.quantity > 0);
  },
  {
    message: "BOM quantities must be positive",
    path: ["bomItems"]
  }
)

export const supplierSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(20),
  contactName: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  taxId: z.string().optional()
})

export const customerSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(20),
  contactName: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  taxId: z.string().optional()
})

export const saleOrderSchema = z.object({
  customerId: z.string().optional(),
  customerName: z.string().min(1).max(100),
  items: z.array(z.object({
    finishedGoodsId: z.string().min(1),
    quantity: z.number().int().min(1),
    unitPrice: z.number().min(0).max(999999.99)
  })).min(1)
})
import { z } from 'zod';

export const StageLogSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  operatorId: z.string().min(1, 'Operator ID is required'),
  kgIn: z.number().positive(),
  kgOut: z.number().nonnegative(),
  kgScrap: z.number().nonnegative(),
  scrapReason: z.string().optional(),
  notes: z.string().optional(),
}).refine((data) => {
  // Enforces the Key Rule: kg received = kg passed forward + kg scrapped [cite: 55]
  const tolerance = 0.001; // Handle floating point math
  return Math.abs(data.kgIn - (data.kgOut + data.kgScrap)) < tolerance;
}, {
  message: "The kg balance is incorrect: In must equal Out + Scrap.",
});
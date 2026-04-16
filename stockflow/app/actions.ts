'use server'
import { prisma } from '@/lib/prisma'

/**
 * Fetches all designs (mapped from 'items' in the instructions)
 * to be used as stock items.
 */
export async function getStock() {
  // Using 'design' model as 'item' is not defined in the schema
  return await prisma.design.findMany()
}

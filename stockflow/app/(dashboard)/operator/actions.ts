'use server'

import { prisma } from '@/lib/prisma' // Ensure this points to your prisma instance

export async function getOperatorData() {
  try {
    const data = await prisma.design.findMany() // Or whatever your query is
    return { success: true, data }
  } catch (error) {
    return { success: false, error: "Failed to fetch data" }
  }
}

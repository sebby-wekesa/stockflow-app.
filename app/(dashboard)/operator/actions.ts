'use server'
import { prisma } from '@/lib/prisma'

export async function fetchStock() {
  return await prisma.item.findMany() // Replace 'item' with your actual table name
}
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface Design {
  id: string;
  name: string;
  kgPerUnit: number;
}

export async function GET() {
  try {
    const rawDesigns = await prisma.design.findMany({
      select: {
        id: true,
        name: true,
        targetWeight: true,
      },
    });

    const designs: Design[] = rawDesigns.map((d) => ({
      id: d.id,
      name: d.name,
      kgPerUnit: d.targetWeight ? Number(d.targetWeight) : 0,
    }));

    return NextResponse.json(designs)
  } catch (error) {
    console.error('Error fetching designs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch designs' },
      { status: 500 }
    )
  }
}

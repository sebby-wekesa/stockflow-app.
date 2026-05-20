export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma'
import { CreateOrderForm } from '@/components/OrderForm'
import { AlertCircle } from 'lucide-react'
import { Design } from '@/types'

async function getDesigns(): Promise<Design[]> {
  try {
    const rawDesigns = await prisma.design.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    // Shape the designs array to satisfy the 'Design' interface
    const designs: Design[] = rawDesigns.map((d: any) => ({
      ...d,
      code: d.code || "TEMP-CODE", // Fallback for missing code
      targetWeight: d.targetWeight ? Number(d.targetWeight) : 0, // Ensure it's a number
      kgPerUnit: d.targetWeight ? Number(d.targetWeight) : 0,
      createdAt: d.createdAt || new Date(),
      updatedAt: d.updatedAt || new Date(),
    }));

    return designs
  } catch (error) {
    console.error('Failed to fetch designs:', error)
    throw new Error('Failed to load designs from database')
  }
}

export default async function ProductionNewPage() {
  let designs: Design[] = []
  let error: string | null = null

  try {
    designs = await getDesigns()
  } catch (err) {
    error =
      err instanceof Error
        ? err.message
        : 'An unexpected error occurred while loading designs'
    console.error('Production page error:', error)
  }

  return (
    <div>
      <div className="section-header mb-16">
        <div>
          <div className="section-title">New Production Order</div>
          <div className="section-sub">
            Initialize a new manufacturing order with complete weight traceability
          </div>
        </div>
      </div>

      {error ? (
        <div className="card">
          <div className="flex items-start gap-4 text-red-400">
            <AlertCircle className="h-6 w-6 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-lg font-semibold">Failed to Load Production Form</h2>
              <p className="mt-2 text-sm text-muted">{error}</p>
              <p className="mt-3 text-xs text-muted">
                Please contact your system administrator if this problem persists.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <CreateOrderForm designs={designs} />
        </div>
      )}
    </div>
  )
}

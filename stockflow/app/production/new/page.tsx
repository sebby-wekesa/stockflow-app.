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
    <div className="min-h-screen bg-slate-950">
      {/* Header Section */}
      <div className="border-b border-slate-800 bg-slate-950/50 backdrop-blur">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-white">
              Launch Production
            </h1>
            <p className="mt-4 text-lg text-slate-400">
              Initialize a new manufacturing order with complete weight traceability.
              Every kilogram is tracked from intake through completion.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        {error ? (
          /* Error State */
          <div className="rounded-lg border border-red-500/30 bg-red-900/10 p-6 backdrop-blur">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-6 w-6 flex-shrink-0 text-red-400 mt-0.5" />
              <div>
                <h2 className="text-lg font-semibold text-red-100">
                  Failed to Load Production Form
                </h2>
                <p className="mt-2 text-sm text-red-300">{error}</p>
                <p className="mt-3 text-xs text-red-400">
                  Please contact your system administrator if this problem persists.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Form Component */
          <CreateOrderForm designs={designs} />
        )}
      </div>
    </div>
  )
}

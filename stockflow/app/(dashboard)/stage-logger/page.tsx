import { Metadata } from 'next'
import { StageLoggingForm } from '@/components/StageLoggingForm'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = {
  title: 'Stage Logger | StockFlow',
  description: 'Log material weights and track production stages',
}

// Mock active orders - in production, fetch from database
async function getActiveOrders() {
  try {
    const orders = await prisma.productionOrder.findMany({
      where: {
        status: {
          in: ['IN_PRODUCTION', 'APPROVED'],
        },
      },
      include: {
        Design: {
          select: {
            name: true,
          },
        },
      },
      take: 10,
    })

    return orders.map((order) => ({
      id: order.id,
      code: `ORD-${order.id.slice(0, 6).toUpperCase()}`,
      weight: order.targetKg.toNumber(),
      designName: order.Design.name,
    }))
  } catch (error) {
    console.error('Error fetching orders:', error)
    return []
  }
}

export default async function StageLoggerPage() {
  const activeOrders = await getActiveOrders()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Page Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-2">Production Stage Logger</h1>
          <p className="text-slate-400">
            Track material weights and maintain production traceability for your factory floor
          </p>
        </div>

        {/* Main Content */}
        {activeOrders.length > 0 ? (
          <StageLoggingForm
            activeOrders={activeOrders}
            currentDepartment="CUTTING"
            onSuccess={() => {
              // Optional: trigger refresh or additional actions
              console.log('Stage logged successfully')
            }}
          />
        ) : (
          <div className="bg-slate-900 rounded-lg border border-slate-700 p-12 text-center">
            <p className="text-slate-300 mb-4">No active orders available</p>
            <p className="text-slate-400 text-sm">
              Please create or approve production orders before logging stages
            </p>
          </div>
        )}

        {/* Info Section */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-6">
            <h3 className="text-amber-400 font-semibold mb-2">Real-time Validation</h3>
            <p className="text-slate-400 text-sm">
              Input weight must equal output weight + scrap weight for accurate traceability
            </p>
          </div>
          <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-6">
            <h3 className="text-amber-400 font-semibold mb-2">Touch-Friendly Design</h3>
            <p className="text-slate-400 text-sm">
              Large input fields and buttons optimized for use on factory floor touch devices
            </p>
          </div>
          <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-6">
            <h3 className="text-amber-400 font-semibold mb-2">Visual Feedback</h3>
            <p className="text-slate-400 text-sm">
              Immediate confetti celebration and toast notifications on successful submissions
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { prisma } from '@/lib/prisma'
import { CreateProductionOrderForm } from '@/components/CreateProductionOrderForm'
import { ToastProvider } from '@/components/Toast'
import { Package, TrendingUp } from 'lucide-react'

interface OrdersPageProps {
  orders?: any[]
  designs?: any[]
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [designs, setDesigns] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ordersRes, designsRes] = await Promise.all([
          fetch('/api/production-orders'),
          fetch('/api/designs'),
        ])

        if (ordersRes.ok) {
          const ordersData = await ordersRes.json()
          setOrders(Array.isArray(ordersData) ? ordersData : [])
        }

        if (designsRes.ok) {
          const designsData = await designsRes.json()
          setDesigns(Array.isArray(designsData) ? designsData : [])
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  const statusColors: Record<string, string> = {
    PENDING: 'bg-amber-900/20 border-amber-500/30 text-amber-100',
    APPROVED: 'bg-blue-900/20 border-blue-500/30 text-blue-100',
    IN_PRODUCTION: 'bg-purple-900/20 border-purple-500/30 text-purple-100',
    COMPLETED: 'bg-emerald-900/20 border-emerald-500/30 text-emerald-100',
    CANCELLED: 'bg-red-900/20 border-red-500/30 text-red-100',
  }

  const priorityColors: Record<string, string> = {
    LOW: 'text-emerald-400',
    MEDIUM: 'text-amber-400',
    HIGH: 'text-red-400',
  }

  return (
    <ToastProvider>
      <div className="space-y-6">
        <div className="section-header mb-16">
          <div>
            <div className="section-title">Production Orders</div>
            <div className="section-sub">Manage and create new manufacturing orders</div>
          </div>
        </div>

        {/* Create Order Form */}
        <div className="mb-12">
          <CreateProductionOrderForm
            designs={designs}
            onSuccess={() => {
              // Refresh orders list
              fetch('/api/production-orders')
                .then((res) => res.json())
                .then((data) => setOrders(Array.isArray(data) ? data : []))
            }}
          />
        </div>

        {/* Orders List */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-zinc-100">
              Recent Orders
            </h3>
            <span className="ml-auto text-sm text-zinc-400">
              {orders.length} orders
            </span>
          </div>

          {isLoading ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-8 text-center">
              <p className="text-zinc-400">Loading orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-8 text-center">
              <Package className="h-12 w-12 text-zinc-700 mx-auto mb-3 opacity-50" />
              <p className="text-zinc-400">No production orders yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/50">
                    <th className="px-6 py-3 text-left font-semibold text-zinc-300">
                      Order
                    </th>
                    <th className="px-6 py-3 text-left font-semibold text-zinc-300">
                      Design
                    </th>
                    <th className="px-6 py-3 text-left font-semibold text-zinc-300">
                      Weight (kg)
                    </th>
                    <th className="px-6 py-3 text-left font-semibold text-zinc-300">
                      Priority
                    </th>
                    <th className="px-6 py-3 text-left font-semibold text-zinc-300">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left font-semibold text-zinc-300">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <code className="text-xs font-mono text-blue-400 bg-blue-900/20 px-2 py-1 rounded">
                          {order.id.slice(0, 8)}...
                        </code>
                      </td>
                      <td className="px-6 py-4 text-zinc-300">
                        {order.design?.name || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 text-emerald-400 font-medium">
                        {order.targetKg} kg
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-xs font-semibold ${
                            priorityColors[order.priority] || 'text-zinc-400'
                          }`}
                        >
                          {order.priority || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-xs font-semibold px-2.5 py-1.5 rounded-md border ${
                            statusColors[order.status] ||
                            'bg-zinc-900/20 border-zinc-700/30 text-zinc-300'
                          }`}
                        >
                          {order.status || 'PENDING'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-zinc-500 text-xs">
                        {order.createdAt
                          ? new Date(order.createdAt).toLocaleDateString(
                              'en-US',
                              { month: 'short', day: 'numeric', year: 'numeric' }
                            )
                          : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </ToastProvider>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { ProductionOrderTabs } from '@/components/ProductionOrderTabs'
import { ToastProvider } from '@/components/Toast'
import { Package, Plus } from 'lucide-react'

export const dynamic = 'force-dynamic';

export default function ProductionNewPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  async function refreshOrders() {
    const ordersRes = await fetch('/api/production-orders')
    if (ordersRes.ok) {
      const ordersData = await ordersRes.json()
      setOrders(Array.isArray(ordersData) ? ordersData : Array.isArray(ordersData.data) ? ordersData.data : [])
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        await refreshOrders()
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  const priorityColors: Record<string, string> = {
    LOW: 'text-emerald-400',
    MEDIUM: 'text-amber-400',
    HIGH: 'text-red-400',
  }

  return (
    <div className="dashboard-content production-new-page">
      <ToastProvider>
        <div className="production-new-hero">
          <div className="production-new-hero-copy">
            <div className="production-new-kicker">Production control</div>
            <h1>Production Orders</h1>
            <div className="section-sub">Create manufacturing jobs, reserve material, and review recent work.</div>
          </div>
          <div className="production-new-hero-stat">
            <Package size={18} />
            <div>
              <div className="production-new-stat-value">{orders.length}</div>
              <div className="production-new-stat-label">Recent jobs</div>
            </div>
          </div>
        </div>

        <div className="production-new-create">
          <ProductionOrderTabs onSuccess={refreshOrders} />
        </div>

        <div className="card production-new-recent">
          <div className="section-header">
            <div>
              <div className="section-title">Recent Orders</div>
              <div className="section-sub">Latest production orders in the system</div>
            </div>
            <span className="production-count-pill">
              {orders.length} orders
            </span>
          </div>

          {isLoading ? (
            <div className="production-empty-state">
              <div className="production-empty-icon">
                <div className="production-spinner" />
              </div>
              <p>Loading orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="production-empty-state">
              <div className="production-empty-icon">
                <Plus size={22} />
              </div>
              <p>No production orders yet</p>
              <span>Create your first order to get started</span>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="production-orders-table">
                <thead>
                  <tr>
                    <th>Job Number</th>
                    <th>Design</th>
                    <th>Weight (kg)</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <code className="production-job-code">
                          {order.orderNumber || `${order.id.slice(0, 8)}...`}
                        </code>
                      </td>
                      <td className="production-order-name">
                        {order.designName || order.design?.name || 'Unknown'}
                      </td>
                      <td className="production-order-weight">
                        {order.targetKg} kg
                      </td>
                      <td>
                        <span className="production-priority" style={{
                          color: priorityColors[order.priority] === 'text-emerald-400' ? 'var(--green)' :
                                 priorityColors[order.priority] === 'text-amber-400' ? 'var(--accent)' :
                                 priorityColors[order.priority] === 'text-red-400' ? 'var(--red)' : 'var(--muted)'
                        }}>
                          {order.priority || 'N/A'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${
                          order.status === 'COMPLETED' ? 'badge-green' :
                          order.status === 'IN_PRODUCTION' ? 'badge-teal' :
                          order.status === 'APPROVED' ? 'badge-blue' :
                          'badge-amber'
                        }`}>
                          {order.status || 'PENDING'}
                        </span>
                      </td>
                      <td className="production-order-date">
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
      </ToastProvider>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { ProductionOrderTabs } from '@/components/ProductionOrderTabs'
import { ToastProvider } from '@/components/Toast'
import { Package } from 'lucide-react'

export default function OrdersPage() {
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
    <div className="dashboard-content">
      <ToastProvider>
        <div className="section-header">
          <div>
            <h1>Production Orders</h1>
            <div className="section-sub">Manage and create new manufacturing orders</div>
          </div>
        </div>

        {/* Create Order Form */}
        <div className="mb-6">
          <ProductionOrderTabs onSuccess={refreshOrders} />
        </div>

        {/* Orders List */}
        <div className="card">
          <div className="section-header">
            <div>
              <div className="section-title">Recent Orders</div>
              <div className="section-sub">Latest production orders in the system</div>
            </div>
            <span style={{
              fontSize: '12px',
              color: 'var(--muted)',
              background: 'var(--surface2)',
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border2)'
            }}>
              {orders.length} orders
            </span>
          </div>

          {isLoading ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: 'var(--muted)'
            }}>
              <div style={{
                display: 'inline-block',
                marginBottom: '12px'
              }}>
                <div style={{
                  padding: '16px',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border2)',
                  borderRadius: 'var(--radius)',
                  display: 'inline-block'
                }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    border: '2px solid var(--border2)',
                    borderTop: '2px solid var(--accent)',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                </div>
              </div>
              <p style={{
                fontSize: '14px',
                color: 'var(--muted)'
              }}>
                Loading orders...
              </p>
            </div>
          ) : orders.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: 'var(--muted)'
            }}>
              <div style={{
                display: 'inline-block',
                marginBottom: '12px'
              }}>
                <div style={{
                  padding: '16px',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border2)',
                  borderRadius: 'var(--radius)',
                  display: 'inline-block'
                }}>
                  <Package size={24} style={{ color: 'var(--muted)' }} />
                </div>
              </div>
              <p style={{
                fontSize: '14px',
                color: 'var(--muted)',
                marginBottom: '4px'
              }}>
                No production orders yet
              </p>
              <p style={{
                fontSize: '12px',
                color: 'var(--muted)'
              }}>
                Create your first order to get started
              </p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Order ID</th>
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
                        <code style={{
                          fontSize: '11px',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--blue)',
                          background: 'rgba(74,158,255,0.1)',
                          padding: '2px 6px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid rgba(74,158,255,0.2)'
                        }}>
                          {order.id.slice(0, 8)}...
                        </code>
                      </td>
                      <td style={{ fontWeight: 500, color: 'var(--text)' }}>
                        {order.designName || order.design?.name || 'Unknown'}
                      </td>
                      <td style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 500,
                        color: 'var(--green)'
                      }}>
                        {order.targetKg} kg
                      </td>
                      <td>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 600,
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
                      <td style={{ fontSize: '12px', color: 'var(--muted)' }}>
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

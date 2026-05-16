'use client'

import { useState, useEffect } from 'react'
import { Package, Clock } from 'lucide-react'

interface Order {
  id: string
  orderNumber: string
  designName: string
  targetKg: number
  quantity: number
  priority: string
  status: string
  specs?: string
}

export default function MyOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        // Fetch recent orders
        const ordersResponse = await fetch('/api/production-orders?limit=50')
        if (ordersResponse.ok) {
          const ordersData = await ordersResponse.json()
          if (ordersData.success && ordersData.data) {
            setOrders(ordersData.data)
          }
        }
      } catch (error) {
        console.error('Error fetching orders:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchOrders()
  }, [])



  const priorityColors: Record<string, string> = {
    LOW: 'text-emerald-400',
    MEDIUM: 'text-amber-400',
    HIGH: 'text-red-400',
  }

  // Show recent orders - in a real app, this would filter by user's involvement
  const myOrders = orders.slice(0, 20) // Limit to recent 20 orders

  const stats = {
    total: myOrders.length,
    pending: myOrders.filter(o => o.status === 'PENDING').length,
    inProgress: myOrders.filter(o => o.status === 'IN_PRODUCTION').length,
    completed: myOrders.filter(o => o.status === 'COMPLETED').length,
  }

  return (
    <div className="dashboard-content">
      <div className="section-header">
        <div>
          <h1>My Orders</h1>
          <div className="section-sub">Production orders relevant to you</div>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'var(--surface2)',
          border: '1px solid var(--border2)',
          borderRadius: 'var(--radius-sm)',
          padding: '6px 12px'
        }}>
          <Package size={16} style={{ color: 'var(--muted)' }} />
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--muted)',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            {stats.total} Orders
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card amber">
          <div className="stat-label">Pending Orders</div>
          <div className="stat-value">{stats.pending}</div>
          <div className="stat-sub">Awaiting approval</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">In Progress</div>
          <div className="stat-value">{stats.inProgress}</div>
          <div className="stat-sub">Currently processing</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Completed</div>
          <div className="stat-value">{stats.completed}</div>
          <div className="stat-sub">Finished orders</div>
        </div>
      </div>

      {/* Orders List */}
      <div className="card">
        <div className="section-header">
          <div>
            <div className="section-title">Order History</div>
            <div className="section-sub">Recent production orders you&apos;ve worked with</div>
          </div>
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
              Loading your orders...
            </p>
          </div>
        ) : myOrders.length === 0 ? (
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
              No orders found
            </p>
            <p style={{
              fontSize: '12px',
              color: 'var(--muted)'
            }}>
              Orders will appear here once you start working with production
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
                  <th>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {myOrders.map((order) => (
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
                        {order.orderNumber}
                      </code>
                    </td>
                    <td style={{ fontWeight: 500, color: 'var(--text)' }}>
                      {order.designName}
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
                        {order.status === 'IN_PRODUCTION' ? 'In Progress' :
                         order.status === 'APPROVED' ? 'Approved' :
                         order.status || 'Pending'}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} />
                        Recent
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
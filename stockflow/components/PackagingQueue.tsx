'use client'

import React, { useState, useEffect } from 'react'
import { fulfillOrder, getPackagingStats } from '@/app/actions/packaging'

import { Loader2, Package, Truck, CheckCircle, AlertTriangle } from 'lucide-react'

interface PackagingItem {
  id: string
  designName: string
  designCode: string
  quantity: number
  unitPrice: number
  totalPrice: number
  availableStock: number
}

interface PackagingOrder {
  id: string
  orderNumber: string
  customerName: string
  totalItems: number
  totalQuantity: number
  totalKg: number
  createdAt: Date
  items: PackagingItem[]
}

interface PackagingQueueProps {
  orders: PackagingOrder[]
}

export function PackagingQueue({ orders: initialOrders }: PackagingQueueProps) {
  const [orders, setOrders] = useState(initialOrders)
  const [fulfilling, setFulfilling] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<any>(null)

  const handleFulfillOrder = async (orderId: string) => {
    setFulfilling(orderId)
    setError(null)

    try {
      await fulfillOrder(orderId)
      // Remove the fulfilled order from the list
      setOrders(prev => prev.filter(order => order.id !== orderId))
      // Refresh stats
      loadStats()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setFulfilling(null)
    }
  }

  const loadStats = async () => {
    try {
      const statsData = await getPackagingStats()
      setStats(statsData)
    } catch (err) {
      console.error('Failed to load packaging stats:', err)
    }
  }

  // Load stats on mount
  React.useEffect(() => {
    loadStats()
  }, [])

  return (
    <div>
      {error && (
        <div style={{
          background: 'rgba(224,85,85,0.1)',
          border: '1px solid rgba(224,85,85,0.2)',
          borderRadius: 'var(--radius)',
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertTriangle size={16} style={{ color: 'var(--red)' }} />
          <span style={{ color: 'var(--text)', fontSize: '13px' }}>{error}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card blue">
          <div className="stat-label">Pending orders</div>
          <div className="stat-value">{stats?.pendingOrders || orders.length}</div>
          <div className="stat-sub">Ready for fulfillment</div>
        </div>
        <div className="stat-card teal">
          <div className="stat-label">Fulfilled today</div>
          <div className="stat-value">{stats?.shippedToday || 0}</div>
          <div className="stat-sub">Orders shipped</div>
        </div>
      </div>

      {/* Orders Queue */}
      <div className="card">
        <div className="section-header mb-16"><div className="section-title">Pending orders</div><div className="section-sub">Sales orders awaiting fulfilment</div></div>

        <div>
          {orders.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: 'var(--muted)'
            }}>
              <div style={{
                display: 'inline-block',
                marginBottom: '16px'
              }}>
                <div style={{
                  padding: '20px',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border2)',
                  borderRadius: 'var(--radius)',
                  display: 'inline-block'
                }}>
                  <Package size={36} style={{ color: 'var(--muted)' }} />
                </div>
              </div>
              <p style={{
                fontSize: '16px',
                color: 'var(--muted)',
                marginBottom: '4px'
              }}>
                No orders ready for packaging
              </p>
              <p style={{
                fontSize: '12px',
                color: 'var(--muted)'
              }}>
                Orders will appear here when all items are available
              </p>
            </div>
          ) : (
            <div>
              {orders.map((order) => (
                <div key={order.id} className="pack-card">
                  <div className="pack-priority" style={{background:'var(--border2)'}}></div>
                  <div className="pack-info">
                    <div className="pack-order">{order.orderNumber} · {new Date(order.createdAt).toLocaleDateString()}</div>
                    <div className="pack-product">{order.items[0]?.designName || 'Multiple items'}</div>
                    <div className="pack-detail">{order.totalQuantity} units · {order.totalKg.toFixed(0)} kg · {order.customerName}</div>
                  </div>
                  <div className="pack-actions">
                    <button
                      onClick={() => handleFulfillOrder(order.id)}
                      disabled={fulfilling === order.id}
                      className="btn btn-teal btn-sm"
                      style={{
                        minWidth: '100px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      {fulfilling === order.id ? (
                        <>
                          <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                          Fulfilling...
                        </>
                      ) : (
                        'Mark fulfilled'
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
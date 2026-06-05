'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { fulfillOrder } from '@/app/actions/packaging'

import { Loader2, Package, AlertTriangle } from 'lucide-react'

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
  totalAmount: number
  createdAt: Date
  updatedAt: Date
  items: PackagingItem[]
}

interface PackagingQueueProps {
  orders: PackagingOrder[]
  initialStats: PackagingStats
}

interface PackagingStats {
  pendingOrders: number
  shippedToday: number
  weeklyRevenue: number
  readyForDispatch?: number
  blockedOrders?: number
}

export function PackagingQueue({ orders: initialOrders, initialStats }: PackagingQueueProps) {
  const router = useRouter()
  const [orders, setOrders] = useState(initialOrders)
  const [fulfilling, setFulfilling] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const readyCount = initialStats.pendingOrders

  const handleFulfillOrder = async (orderId: string) => {
    setFulfilling(orderId)
    setError(null)

    try {
      await fulfillOrder(orderId)
      // Remove the fulfilled order from the list
      setOrders(prev => prev.filter(order => order.id !== orderId))
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fulfill order')
    } finally {
      setFulfilling(null)
    }
  }

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

      <div className="card">
        <div className="section-header mb-16">
          <div>
            <div className="section-title">Packaging Queue</div>
            <div className="section-sub">Confirmed sales orders with reserved finished goods</div>
          </div>
          <span className="badge badge-blue">{readyCount.toLocaleString()} ready</span>
        </div>

        <div>
          {orders.length === 0 ? (
            <div className="packaging-empty packaging-empty-large">
              <Package size={36} />
              <strong>No orders ready for packaging</strong>
              <span>Orders appear here when all items have reserved finished goods.</span>
            </div>
          ) : (
            <div>
              {orders.map((order) => (
                <div key={order.id} className="pack-card">
                  <div className="pack-priority"></div>
                  <div className="pack-info">
                    <div className="pack-order">{order.orderNumber} · {new Date(order.createdAt).toLocaleDateString()}</div>
                    <div className="pack-product">{order.customerName}</div>
                    <div className="pack-detail">
                      {order.totalItems.toLocaleString()} item lines · {order.totalQuantity.toLocaleString()} units · {order.totalKg.toFixed(0)} kg
                    </div>
                    <div className="packaging-items">
                      {order.items.slice(0, 3).map((item) => (
                        <span key={item.id}>{item.designName} x {item.quantity.toLocaleString()}</span>
                      ))}
                      {order.items.length > 3 && <span>+{order.items.length - 3} more</span>}
                    </div>
                  </div>
                  <div className="packaging-value">KES {order.totalAmount.toLocaleString()}</div>
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
                        'Mark packaged'
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

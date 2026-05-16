'use client'

import { useState, useEffect } from 'react'
import { CreateProductionOrderForm } from '@/components/CreateProductionOrderForm'
import { ToastProvider } from '@/components/Toast'
import { Package } from 'lucide-react'
import { Design } from '@/types'

export default function PlaceOrderPage() {
  const [designs, setDesigns] = useState<Design[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchDesigns = async () => {
      try {
        const response = await fetch('/api/designs')
        if (response.ok) {
          const designsData = await response.json()
          setDesigns(Array.isArray(designsData) ? designsData : [])
        }
      } catch (error) {
        console.error('Error fetching designs:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchDesigns()
  }, [])

  return (
    <div className="dashboard-content">
      <ToastProvider>
        <div className="section-header">
          <div>
            <h1>Place Production Order</h1>
            <div className="section-sub">Create a new manufacturing order for production</div>
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
              New Order
            </span>
          </div>
        </div>

        <div className="card">
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
                Loading designs...
              </p>
            </div>
          ) : designs.length === 0 ? (
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
                No designs available
              </p>
              <p style={{
                fontSize: '12px',
                color: 'var(--muted)'
              }}>
                Please create a design first before placing orders
              </p>
            </div>
          ) : (
            <CreateProductionOrderForm
              designs={designs}
              onSuccess={() => {
                // Could redirect to orders page or show success message
                console.log('Order created successfully')
              }}
            />
          )}
        </div>
      </ToastProvider>
    </div>
  )
}
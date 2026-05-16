'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface StockMovement {
  id: string
  movementType: string
  quantity: number
  reference: string
  notes: string
  createdAt: string
}

interface Product {
  id: string
  name: string
  sku: string
  currentStock: number
  stockMovements: StockMovement[]
}

interface StockLedgerProps {
  productId?: string
}

export function StockLedger({ productId }: StockLedgerProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        // Fetch products with recent stock movements
        const response = await fetch('/api/products/stock-ledger')
        const data = await response.json()
        setProducts(data)

        // If productId is provided, select that product
        if (productId) {
          const product = data.find((p: Product) => p.id === productId)
          if (product) setSelectedProduct(product)
        }
      } catch (error) {
        console.error('Failed to fetch stock ledger:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [productId])

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'stock_in': return '📥'
      case 'stock_out': return '📤'
      case 'sale': return '💰'
      case 'adjustment': return '⚖️'
      case 'return': return '↩️'
      default: return '📦'
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading stock ledger...</div>
  }

  return (
    <div className="space-y-6">
      {/* Product Selector */}
      {!productId && (
        <div className="card">
          <div className="section-header mb-16">
            <div className="section-title">Select Product</div>
            <div className="section-sub">Choose a product to view its stock movement history</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product) => (
              <div
                key={product.id}
                onClick={() => setSelectedProduct(product)}
                className={`card cursor-pointer transition-all ${
                  selectedProduct?.id === product.id
                    ? 'ring-2 ring-accent-amber border-accent-amber'
                    : 'hover:border-accent-amber/50'
                }`}
              >
                <div className="p-4">
                  <div className="font-mono text-accent-amber text-sm mb-1">{product.sku}</div>
                  <div className="font-medium text-sm mb-2">{product.name}</div>
                  <div className="text-xs text-muted">
                    Current stock: <span className="font-mono">{product.currentStock}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stock Movement History */}
      {selectedProduct && (
        <div className="card">
          <div className="section-header mb-16">
            <div className="section-title">Stock Ledger</div>
            <div className="section-sub">
              Movement history for {selectedProduct.name} ({selectedProduct.sku})
            </div>
          </div>

          <div className="space-y-3">
            {selectedProduct.stockMovements.length === 0 ? (
              <div className="text-center py-8 text-muted">
                No stock movements found for this product
              </div>
            ) : (
              selectedProduct.stockMovements.map((movement) => (
                <div key={movement.id} className="flex items-center justify-between p-4 bg-surface2 rounded-md">
                  <div className="flex items-center gap-3">
                    <div className="text-lg">{getMovementIcon(movement.movementType)}</div>
                    <div>
                      <div className="font-medium text-sm capitalize">
                        {movement.movementType.replace('_', ' ')}
                      </div>
                      <div className="text-xs text-muted">
                        {new Date(movement.createdAt).toLocaleDateString()} · {movement.reference}
                      </div>
                      {movement.notes && (
                        <div className="text-xs text-muted mt-1">{movement.notes}</div>
                      )}
                    </div>
                  </div>
                  <div className={`font-mono text-sm px-2 py-1 rounded ${
                    movement.quantity > 0
                      ? 'bg-green-500/10 text-green-600'
                      : 'bg-red-500/10 text-red-600'
                  }`}>
                    {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                  </div>
                </div>
              ))
            )}
          </div>

          {!productId && (
            <div className="mt-4 pt-4 border-t border-border">
              <button
                onClick={() => setSelectedProduct(null)}
                className="btn btn-ghost text-sm"
              >
                ← Back to product selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
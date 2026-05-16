'use client'

import { useState } from 'react'
import { createSalesOrder } from '@/app/actions/sales-orders'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, ShoppingCart, CheckCircle, AlertTriangle } from 'lucide-react'

interface CatalogueItem {
  id: string
  name: string
  code: string
  availableQty: number
  kgProduced: number
  price?: number
  createdAt: Date
}

interface SalesOrderFormProps {
  products: CatalogueItem[]
  onOrderPlaced?: () => void
}

export function SalesOrderForm({ products, onOrderPlaced }: SalesOrderFormProps) {
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({})
  const [customerName, setCustomerName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      const newItems = { ...selectedItems }
      delete newItems[productId]
      setSelectedItems(newItems)
    } else {
      const product = products.find(p => p.id === productId)
      if (product && quantity <= product.availableQty) {
        setSelectedItems(prev => ({ ...prev, [productId]: quantity }))
      }
    }
  }

  const getSelectedProducts = () => {
    return products.filter(product => selectedItems[product.id])
  }

  const getTotal = () => {
    return getSelectedProducts().reduce((sum, product) => {
      return sum + ((product.price || 0) * selectedItems[product.id])
    }, 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (getSelectedProducts().length === 0 || !customerName.trim()) return

    setSubmitting(true)
    setError(null)

    try {
      const orderData = {
        customerName: customerName.trim(),
        items: getSelectedProducts().map(product => ({
          finishedGoodsId: product.id,
          quantity: selectedItems[product.id],
          unitPrice: product.price || 0
        }))
      }

      await createSalesOrder(orderData)

      setSuccess(true)
      setSelectedItems({})
      setCustomerName('')

      if (onOrderPlaced) {
        onOrderPlaced()
      }

      // Reset success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          Place Sales Order
        </CardTitle>
        <CardDescription>Create a new sales order from available finished goods</CardDescription>
      </CardHeader>
      <CardContent>
        {success && (
          <Alert className="mb-4">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>Order placed successfully! It will be reviewed and confirmed by management.</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Information */}
          <div>
            <Label htmlFor="customer">Customer Name *</Label>
            <Input
              id="customer"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Enter customer name"
              required
            />
          </div>

          {/* Product Selection */}
          <div>
            <Label>Available Products</Label>
            <div className="space-y-3 mt-2 max-h-96 overflow-y-auto">
              {products.map((product) => {
                const selectedQty = selectedItems[product.id] || 0
                return (
                  <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{product.name}</div>
                      <div className="text-sm text-gray-500">{product.code}</div>
                      <div className="text-sm text-gray-600">
                        {product.availableQty} units available • {product.kgProduced.toFixed(2)} kg
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">${(product.price || 0).toFixed(2)}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => updateQuantity(product.id, selectedQty - 1)}
                          disabled={selectedQty === 0}
                        >
                          -
                        </Button>
                        <span className="w-8 text-center text-sm">{selectedQty}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => updateQuantity(product.id, selectedQty + 1)}
                          disabled={selectedQty >= product.availableQty}
                        >
                          +
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
              {products.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No products available for ordering
                </div>
              )}
            </div>
          </div>

          {/* Order Summary */}
          {getSelectedProducts().length > 0 && (
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Order Summary</h3>
              <div className="space-y-2">
                {getSelectedProducts().map((product) => (
                  <div key={product.id} className="flex justify-between text-sm">
                    <span>{product.name} × {selectedItems[product.id]}</span>
                    <span>${((product.price || 0) * selectedItems[product.id]).toFixed(2)}</span>
                  </div>
                ))}
                <div className="border-t pt-2 flex justify-between font-semibold">
                  <span>Total:</span>
                  <span>${getTotal().toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={getSelectedProducts().length === 0 || !customerName.trim() || submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Placing Order...
              </>
            ) : (
              'Place Sales Order'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
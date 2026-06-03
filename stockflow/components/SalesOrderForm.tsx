// @ts-nocheck
'use client'

import { useState } from 'react'
import { createSalesOrder } from '@/app/actions/sales-orders'
import { formatKES } from '@/lib/sales-utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, ShoppingCart, CheckCircle, AlertTriangle } from 'lucide-react'

interface SellableItem {
  id: string                    // FinishedGoods id (shadow or real)
  name: string
  code: string
  availableQty: number
  kgProduced: number
  price?: number
  createdAt: Date | string
  source?: 'manufactured' | 'product' | 'design'
  designId?: string
  origin?: string               // FACTORY_MADE | LOCAL_PURCHASE | IMPORTED | etc.
  uom?: string
}

interface SalesOrderFormProps {
  products: SellableItem[]
  onOrderPlaced?: () => void
  preselectedItems?: any[]   // items chosen directly from catalogue
}

export function SalesOrderForm({ products, onOrderPlaced, preselectedItems }: SalesOrderFormProps) {
  // Normalize whatever shape we receive (old catalogue shape with .design or new flat shape)
  const allItems: SellableItem[] = products.map((p: Record<string, unknown>) => ({
    id: p.id,
    name: p.name || p.design?.name || 'Unnamed',
    code: p.code || p.design?.code || p.sku || p.id?.slice(0, 8),
    availableQty: p.availableQty ?? p.quantity ?? 0,
    kgProduced: Number(p.kgProduced || 0),
    price: p.price ?? p.unitCost ?? undefined,
    createdAt: p.createdAt,
    source: p.source,
    designId: p.designId,
    origin: p.origin || p.design?.origin,
    uom: p.uom,
  }));

  // Initialize with preselected items if provided (from catalogue "choose" flow)
  const getInitialLines = (): OrderLine[] => {
    if (!preselectedItems || preselectedItems.length === 0) return [];
    
    return preselectedItems.map((item: any) => {
      const normalized = allItems.find(i => i.id === item.id) || item;
      const unitPrice = normalized.price ?? 0;
      const maxQty = normalized.availableQty || 1;
      
      return {
        itemId: normalized.id,
        name: normalized.name || normalized.design?.name || 'Item',
        code: normalized.code || normalized.design?.code || '',
        source: normalized.source,
        designId: normalized.designId,
        origin: normalized.origin,
        maxQty,
        quantity: 1,
        unitPrice,
      };
    });
  };

  // New line-item based selection for sales team (supports mixing Products + Designs easily)
  type OrderLine = {
    itemId: string
    name: string
    code: string
    source?: 'manufactured' | 'product' | 'design'
    designId?: string
    origin?: string
    maxQty: number
    quantity: number
    unitPrice: number
  }

  const [searchTerm, setSearchTerm] = useState('')
  const [orderLines, setOrderLines] = useState<OrderLine[]>(getInitialLines)
  const [customerName, setCustomerName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filtered items for the search picker (sales team can search across Products and Designs)
  const filteredItems = allItems
    .filter(item =>
      !searchTerm ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.code.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .slice(0, 20) // limit for performance

  const addLine = (item: SellableItem) => {
    // Prevent duplicates
    if (orderLines.some(l => l.itemId === item.id)) return

    const unitPrice = item.price ?? 0
    const maxQty = item.source === 'design' ? 999999 : item.availableQty

    setOrderLines(prev => [
      ...prev,
      {
        itemId: item.id,
        name: item.name,
        code: item.code,
        source: item.source,
        designId: item.designId,
        origin: item.origin,
        maxQty,
        quantity: 1,
        unitPrice,
      }
    ])
    setSearchTerm('') // clear search after adding
  }

  const updateLineQty = (itemId: string, newQty: number) => {
    setOrderLines(prev =>
      prev.map(line =>
        line.itemId === itemId
          ? { ...line, quantity: Math.max(1, Math.min(newQty, line.maxQty || 999999)) }
          : line
      )
    )
  }

  const updateLinePrice = (itemId: string, newPrice: number) => {
    setOrderLines(prev =>
      prev.map(line =>
        line.itemId === itemId ? { ...line, unitPrice: Math.max(0, newPrice) } : line
      )
    )
  }

  const removeLine = (itemId: string) => {
    setOrderLines(prev => prev.filter(l => l.itemId !== itemId))
  }

  const getTotal = () => {
    return orderLines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (orderLines.length === 0 || !customerName.trim()) return

    setSubmitting(true)
    setError(null)

    try {
      const orderData = {
        customerName: customerName.trim(),
        items: orderLines.map(line => ({
          // manufactured → real FinishedGoods id
          // product → Product id (server will create shadow FinishedGoods)
          finishedGoodsId: line.source === 'manufactured' ? line.itemId : undefined,
          productId: line.source === 'product' ? line.itemId : undefined,
          designId: line.source === 'design' ? (line.designId || line.itemId) : undefined,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          source: line.source,
        }))
      }

      await createSalesOrder(orderData)

      setSuccess(true)
      setOrderLines([])
      setCustomerName('')
      setSearchTerm('')

      if (onOrderPlaced) {
        onOrderPlaced()
      }

      setTimeout(() => setSuccess(false), 3000)
    } catch (err: unknown) {
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
        <CardDescription>Create a sales order by choosing from Products and manufactured Designs</CardDescription>
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

          {/* Product / Design Selection - Searchable for Sales Team */}
          <div>
            <Label className="mb-1 block">Add items (search Products or Designs)</Label>
            <Input
              placeholder="Type to search products, SKUs, or design codes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mb-2"
            />

            {/* Search Results */}
            {searchTerm && filteredItems.length > 0 && (
              <div className="border rounded-lg max-h-48 overflow-auto mb-3 bg-white shadow-sm">
                {filteredItems.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 hover:bg-gray-50 border-b last:border-b-0 cursor-pointer"
                    onClick={() => addLine(item)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium flex items-center gap-2 text-sm">
                        {item.name}
                        {item.source === 'manufactured' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-100 text-teal-700">Design</span>
                        )}
                        {item.source === 'product' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                            {item.origin || 'Product'}
                          </span>
                        )}
                        {item.source === 'design' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">Made to order</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 font-mono">{item.code}</div>
                      <div className="text-xs text-gray-600">
                        {item.source === 'design'
                          ? 'Creates production order'
                          : `${item.availableQty} ${item.uom || 'KG'} available`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{formatKES(item.price || 0)}</div>
                      <Button type="button" size="sm" variant="secondary" className="mt-1 h-7 text-xs">
                        Add
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {searchTerm && filteredItems.length === 0 && (
              <div className="text-sm text-gray-500 mb-3">No matching items found.</div>
            )}

            {/* Selected Order Lines */}
            {orderLines.length > 0 && (
              <div className="border rounded-lg p-3">
                <div className="font-semibold mb-2 text-sm">Order Lines ({orderLines.length})</div>
                <div className="space-y-2">
                  {orderLines.map(line => (
                    <div key={line.itemId} className="flex flex-wrap items-center gap-2 bg-gray-50 p-2 rounded">
                      <div className="flex-1 min-w-[140px]">
                        <div className="font-medium text-sm flex items-center gap-1.5">
                          {line.name}
                          {line.source === 'manufactured' && <span className="text-[10px] bg-teal-100 text-teal-700 px-1 rounded">Design</span>}
                          {line.source === 'product' && <span className="text-[10px] bg-amber-100 text-amber-700 px-1 rounded">{line.origin || 'Product'}</span>}
                          {line.source === 'design' && <span className="text-[10px] bg-purple-100 text-purple-700 px-1 rounded">Made to order</span>}
                        </div>
                        <div className="text-xs text-gray-500 font-mono">{line.code}</div>
                      </div>

                      <div>
                        <Label className="text-[10px] block">Qty</Label>
                        <Input
                          type="number"
                          min={1}
                          max={line.maxQty}
                          value={line.quantity}
                          onChange={(e) => updateLineQty(line.itemId, parseInt(e.target.value) || 1)}
                          className="w-20 h-8 text-sm"
                        />
                      </div>

                      <div>
                        <Label className="text-[10px] block">Unit Price</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={line.unitPrice}
                          onChange={(e) => updateLinePrice(line.itemId, parseFloat(e.target.value) || 0)}
                          className="w-24 h-8 text-sm"
                        />
                      </div>

                      <div className="text-right min-w-[70px]">
                        <Label className="text-[10px] block">Line Total</Label>
                        <div className="font-mono text-sm font-semibold">
                          ${(line.quantity * line.unitPrice).toFixed(2)}
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLine(line.itemId)}
                        className="text-red-600 hover:text-red-700 mt-4"
                      >
                        ✕
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="border-t mt-3 pt-3 flex justify-between font-semibold">
                  <span>Order Total</span>
                  <span>${getTotal().toFixed(2)}</span>
                </div>
              </div>
            )}

            {orderLines.length === 0 && !searchTerm && (
              <div className="text-sm text-gray-500 border rounded p-4 text-center">
                Start typing above to search across all Products and Designs, then click <strong>Add</strong>.
              </div>
            )}
          </div>

          {/* The order lines above already show live totals */}

          <Button
            type="submit"
            className="w-full"
            disabled={orderLines.length === 0 || !customerName.trim() || submitting}
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

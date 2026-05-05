'use client'

import { useState, useTransition } from 'react'
import type { BranchEnum } from '@prisma/client'
import { createSalesOrder, searchProductsForSale } from '../actions'
import { searchCustomers } from '../../customers/actions'
import { BRANCH_LABELS } from '@/lib/branches'

type Hit = { id: string; product_code: string; canonical_name: string; selling_price: number }
type CustomerHit = { id: string; name: string; contactInfo: string | null }

export function SalesForm({ allowedBranches, defaultBranch }: { allowedBranches: BranchEnum[]; defaultBranch: BranchEnum }) {
  const [branch, setBranch] = useState<BranchEnum>(defaultBranch)
  const [customerName, setCustomerName] = useState('Walk-in customer')
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [rows, setRows] = useState([{ productId: '', qty: '1', price: '0' }])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [hits, setHits] = useState<Hit[]>([])
  const [customerHits, setCustomerHits] = useState<CustomerHit[]>([])

  const submit = (action: 'draft' | 'invoice') => {
    const fd = new FormData()
    fd.set('branch', branch)
    if (customerId) fd.set('customer_id', customerId)
    fd.set('customer_name', customerName)
    fd.set('invoice_date', new Date().toISOString().split('T')[0])
    fd.set('action', action)
    rows.filter(r => r.productId).forEach((r, i) => {
      fd.set(`line_${i}_product_id`, r.productId)
      fd.set(`line_${i}_qty`, r.qty)
      fd.set(`line_${i}_unit_price`, r.price)
    })
    startTransition(async () => {
      try { await createSalesOrder(fd) } catch (e) { setError((e as Error).message) }
    })
  }

  return (
    <div className="space-y-4">
      {error && <div className="text-sm text-red">{error}</div>}
      <div className="card p-4 grid grid-cols-2 gap-3">
        <select value={branch} onChange={(e) => setBranch(e.target.value as BranchEnum)} className="input">
          {allowedBranches.map((b) => <option key={b} value={b}>{BRANCH_LABELS[b]}</option>)}
        </select>
        <input
          className="input"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          onBlur={async () => setCustomerHits(await searchCustomers(customerName) as CustomerHit[])}
          placeholder="Customer name"
        />
        {customerHits.length > 0 && (
          <div className="col-span-2 text-xs text-muted">
            {customerHits.map(c => (
              <button key={c.id} className="mr-2 underline" onClick={() => { setCustomerId(c.id); setCustomerName(c.name) }}>{c.name}</button>
            ))}
          </div>
        )}
      </div>

      <div className="card p-4 space-y-3">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-12 gap-2">
            <input
              className="input col-span-6"
              placeholder="Search product"
              onChange={async (e) => setHits(await searchProductsForSale(e.target.value, branch) as Hit[])}
            />
            <input className="input col-span-2" value={r.qty} onChange={(e) => setRows(prev => prev.map((x,j)=>j===i?{...x,qty:e.target.value}:x))} />
            <input className="input col-span-3" value={r.price} onChange={(e) => setRows(prev => prev.map((x,j)=>j===i?{...x,price:e.target.value}:x))} />
            <button className="btn btn-ghost col-span-1" onClick={() => setRows(prev => prev.filter((_,j)=>j!==i))}>x</button>
            {hits.length > 0 && (
              <div className="col-span-12 text-xs">
                {hits.map(h => (
                  <button key={h.id} className="mr-2 underline" onClick={() => setRows(prev => prev.map((x,j)=>j===i?{...x,productId:h.id,price:String(h.selling_price)}:x))}>
                    {h.product_code} - {h.canonical_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        <button className="btn btn-ghost" onClick={() => setRows(prev => [...prev, { productId: '', qty: '1', price: '0' }])}>+ Add line</button>
      </div>

      <div className="flex justify-end gap-2">
        <button className="btn btn-ghost" disabled={isPending} onClick={() => submit('draft')}>Save draft</button>
        <button className="btn btn-primary" disabled={isPending} onClick={() => submit('invoice')}>Confirm & invoice</button>
      </div>
    </div>
  )
}

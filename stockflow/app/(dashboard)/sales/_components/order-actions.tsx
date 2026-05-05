'use client'

import { useState, useTransition } from 'react'
import { cancelOrder, confirmDraft } from '../actions'
import type { SaleStatus } from '@prisma/client'

export function OrderActions({ orderId, status, orderNumber }: { orderId: string; status: SaleStatus; orderNumber: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex items-center gap-2">
      {status === 'DRAFT' && (
        <button
          className="btn btn-primary"
          disabled={isPending}
          onClick={() => startTransition(async () => {
            try { await confirmDraft(orderId) } catch (e) { setError((e as Error).message) }
          })}
        >
          Confirm & invoice
        </button>
      )}
      {(status === 'DRAFT' || status === 'INVOICED') && (
        <button
          className="btn btn-ghost text-red"
          disabled={isPending}
          onClick={() => {
            const reason = window.prompt(`Cancel ${orderNumber}. Reason:`)
            if (!reason) return
            startTransition(async () => {
              try { await cancelOrder(orderId, reason) } catch (e) { setError((e as Error).message) }
            })
          }}
        >
          Cancel
        </button>
      )}
      {error && <span className="text-xs text-red">{error}</span>}
    </div>
  )
}

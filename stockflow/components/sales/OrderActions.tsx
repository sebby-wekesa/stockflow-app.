// @ts-nocheck
'use client'

import { useState, useTransition } from 'react'
import { confirmDraft, cancelOrder } from '@/actions/sales'
import type { SaleStatus as SalesOrderStatus } from '@prisma/client'

export function OrderActions({
  orderId,
  status,
  orderNumber,
}: {
  orderId: string
  status: SalesOrderStatus
  orderNumber: string
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showCancelDialog, setShowCancelDialog] = useState(false)

  function handleConfirm() {
    if (!confirm('Confirm and invoice this order? Stock will be decremented immediately.')) return
    setError(null)
    startTransition(async () => {
      try {
        await confirmDraft(orderId)
      } catch (err) {
        setError((err as Error).message)
      }
    })
  }

  return (
    <>
      <div className="flex gap-2">
        {status === 'PENDING' && (
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className="btn btn-primary"
          >
            Confirm & invoice
          </button>
        )}

        <button
          type="button"
          onClick={() => window.print()}
          className="btn btn-ghost"
        >
          Print
        </button>

        {(status === 'PENDING' || status === 'CONFIRMED') && (
          <button
            type="button"
            onClick={() => setShowCancelDialog(true)}
            disabled={isPending}
            className="btn btn-ghost text-red"
          >
            Cancel
          </button>
        )}
      </div>

      {error && (
        <div className="fixed top-4 right-4 max-w-sm p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm shadow-lg z-50">
          {error}
        </div>
      )}

      {showCancelDialog && (
        <CancelDialog
          orderId={orderId}
          orderNumber={orderNumber}
          status={status}
          onClose={() => setShowCancelDialog(false)}
          onError={setError}
        />
      )}
    </>
  )
}

function CancelDialog({
  orderId,
  orderNumber,
  status,
  onClose,
  onError,
}: {
  orderId: string
  orderNumber: string
  status: SalesOrderStatus
  onClose: () => void
  onError: (msg: string) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [reason, setReason] = useState('')

  function submit() {
    if (reason.trim().length < 3) {
      onError('Reason must be at least 3 characters')
      return
    }
    startTransition(async () => {
      try {
        await cancelOrder(orderId, reason)
        onClose()
      } catch (err) {
        onError((err as Error).message)
      }
    })
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-surface border border-border rounded-lg p-6 max-w-md w-full">
        <div className="font-head text-lg font-bold mb-2">Cancel order {orderNumber}?</div>
        <p className="text-sm text-muted mb-4">
          {status === 'CONFIRMED'
            ? 'Stock will be returned automatically. The cancellation will be logged in the audit trail.'
            : 'This draft will be marked as cancelled.'}
        </p>

        <div className="mb-4">
          <label className="block text-xs uppercase tracking-wider text-muted mb-2">
            Reason <span className="text-red">*</span>
          </label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="input"
            placeholder="Cancellation reason"
            autoFocus
          />
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-ghost">
            Keep order
          </button>
          <button
            onClick={submit}
            disabled={isPending}
            className="btn"
            style={{
              backgroundColor: 'rgba(224, 85, 85, 0.15)',
              color: '#e05555',
            }}
          >
            {isPending ? 'Cancelling...' : 'Cancel order'}
          </button>
        </div>
      </div>
    </div>
  )
}

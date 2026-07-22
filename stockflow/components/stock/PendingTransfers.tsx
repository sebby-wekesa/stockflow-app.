'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { confirmStockTransfer } from '@/actions/stock'

export type PendingTransferItem = {
  id: string
  reference: string
  productCode: string
  productName: string
  quantity: number
  quantityUnit: string
  sourceBranchName: string
  destinationBranchName: string
  createdAt: string
  notes: string | null
}

export function PendingTransfers({ transfers }: { transfers: PendingTransferItem[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [receivingId, setReceivingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function receiveTransfer(transferId: string) {
    setError(null)
    setReceivingId(transferId)
    startTransition(async () => {
      try {
        await confirmStockTransfer(transferId)
        router.refresh()
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setReceivingId(null)
      }
    })
  }

  return (
    <section className="card stock-transfer-pending-card">
      <div className="stock-transfer-pending-header">
        <div>
          <div className="stock-transfer-kicker">Receiving queue</div>
          <div className="section-title">Stock awaiting confirmation</div>
          <div className="section-sub">
            Confirm each dispatch after it arrives at the destination branch.
          </div>
        </div>
        <span className="badge badge-amber">{transfers.length} pending</span>
      </div>

      {error && (
        <div className="stock-transfer-alert stock-transfer-alert-error" role="alert">
          {error}
        </div>
      )}

      <div className="stock-transfer-pending-list">
        {transfers.map((transfer) => (
          <div key={transfer.id} className="stock-transfer-pending-row">
            <div className="stock-transfer-pending-copy">
              <div className="stock-transfer-product-code">{transfer.productCode}</div>
              <div className="stock-transfer-product-name">{transfer.productName}</div>
              <div className="stock-transfer-pending-meta">
                {transfer.quantity} {transfer.quantityUnit === 'KG' ? 'KG' : 'PCS/Sets'} · {transfer.sourceBranchName} → {transfer.destinationBranchName}
              </div>
              <div className="stock-transfer-pending-reference">
                {transfer.reference} · {new Date(transfer.createdAt).toLocaleString()}
              </div>
              {transfer.notes && <div className="stock-transfer-pending-notes">{transfer.notes}</div>}
            </div>
            <button
              type="button"
              className="btn btn-primary stock-transfer-receive-button"
              onClick={() => receiveTransfer(transfer.id)}
              disabled={isPending}
            >
              {receivingId === transfer.id ? 'Confirming…' : 'Confirm received'}
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

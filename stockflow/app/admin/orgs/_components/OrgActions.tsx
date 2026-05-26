// @ts-nocheck
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  approveOrganization,
  suspendOrganization,
  reactivateOrganization,
  rejectOrganization,
} from '@/actions/admin-orgs'

type Status = 'PENDING_APPROVAL' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED'

export function OrgActions({
  orgId,
  status,
  orgName,
}: {
  orgId: string
  status: Status
  orgName: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showReason, setShowReason] = useState<'suspend' | 'reject' | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleApprove() {
    if (!confirm(`Approve "${orgName}"? They'll be able to log in immediately.`)) return
    setError(null)
    startTransition(async () => {
      try {
        await approveOrganization(orgId)
        router.refresh()
      } catch (err) {
        setError((err as Error).message)
      }
    })
  }

  function handleSubmitReason() {
    if (reason.trim().length < 3) {
      setError('Please provide a reason (at least 3 characters)')
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        if (showReason === 'suspend') {
          await suspendOrganization(orgId, reason)
        } else if (showReason === 'reject') {
          await rejectOrganization(orgId, reason)
        }
        setShowReason(null)
        setReason('')
        router.refresh()
      } catch (err) {
        setError((err as Error).message)
      }
    })
  }

  function handleReactivate() {
    if (!confirm(`Reactivate "${orgName}"? They'll regain access to the app.`)) return
    setError(null)
    startTransition(async () => {
      try {
        await reactivateOrganization(orgId)
        router.refresh()
      } catch (err) {
        setError((err as Error).message)
      }
    })
  }

  if (showReason) {
    return (
      <div className="flex flex-col gap-2 min-w-[260px]">
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={
            showReason === 'suspend'
              ? 'Why are you suspending this org?'
              : 'Why are you rejecting this signup?'
          }
          maxLength={500}
          rows={3}
          className="input text-sm"
          disabled={isPending}
        />
        {error && <div className="text-xs text-red-400">{error}</div>}
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowReason(null)
              setReason('')
              setError(null)
            }}
            disabled={isPending}
            className="btn btn-ghost text-xs flex-1"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmitReason}
            disabled={isPending || reason.trim().length < 3}
            className={`btn text-xs flex-1 ${
              showReason === 'suspend' ? 'btn-danger' : 'btn-primary'
            }`}
          >
            {isPending ? '...' : 'Confirm'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <div className="text-xs text-red-400">{error}</div>}

      {status === 'PENDING_APPROVAL' && (
        <>
          <button
            onClick={handleApprove}
            disabled={isPending}
            className="btn btn-primary text-sm"
          >
            Approve
          </button>
          <button
            onClick={() => setShowReason('reject')}
            disabled={isPending}
            className="btn btn-ghost text-sm"
          >
            Reject
          </button>
        </>
      )}

      {status === 'ACTIVE' && (
        <button
          onClick={() => setShowReason('suspend')}
          disabled={isPending}
          className="btn btn-ghost text-sm"
        >
          Suspend
        </button>
      )}

      {status === 'SUSPENDED' && (
        <button
          onClick={handleReactivate}
          disabled={isPending}
          className="btn btn-primary text-sm"
        >
          Reactivate
        </button>
      )}

      {status === 'CLOSED' && (
        <span className="text-xs text-muted italic">Closed — no actions</span>
      )}
    </div>
  )
}

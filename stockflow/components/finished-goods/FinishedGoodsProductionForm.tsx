'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useFormStatus } from 'react-dom'
import { recordFinishedGoodsProduction } from '@/app/actions/finished-goods'
import SpringTypePicker, { type SpringTypeOption } from '@/components/finished-goods/SpringTypePicker'

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()

  return (
    <button type="submit" className="btn btn-primary btn-sm" disabled={disabled || pending}>
      {pending ? 'Saving...' : 'Save'}
    </button>
  )
}

export default function FinishedGoodsProductionForm({
  springTypes,
  disabled = false,
}: {
  springTypes: SpringTypeOption[]
  disabled?: boolean
}) {
  const router = useRouter()
  const submissionIdRef = useRef<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    setError(null)
    const submissionId = submissionIdRef.current ?? crypto.randomUUID()
    submissionIdRef.current = submissionId
    formData.set('submissionId', submissionId)

    try {
      await recordFinishedGoodsProduction(formData)
      submissionIdRef.current = null
      router.refresh()
    } catch (err) {
      setError((err as Error).message || 'Could not save production record')
    }
  }

  return (
    <>
      <form action={handleSubmit} aria-busy={disabled}>
        <table>
          <thead>
            <tr>
              <th>Job Card No</th>
              <th>Date</th>
              <th>Spring Type</th>
              <th>Pcs Produced</th>
              <th>Weight per Pcs</th>
              <th>Total Weight</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><input className="form-input" name="jobCardNo" placeholder="Job card No" required /></td>
              <td><input className="form-input" name="productionDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></td>
              <td style={{ minWidth: '240px' }}>
                <SpringTypePicker options={springTypes} name="springProductId" id="finished-goods-spring-picker" />
                <input className="form-input" name="newSpringType" placeholder="Or add new spring type" style={{ marginTop: '6px' }} />
              </td>
              <td><input className="form-input" name="pcsProduced" type="number" min="1" step="1" placeholder="0" required /></td>
              <td><input className="form-input" name="weightPerPiece" type="number" min="0.0001" step="0.0001" placeholder="0.0000" required /></td>
              <td><input className="form-input" name="totalWeight" type="number" min="0.0001" step="0.0001" placeholder="0.0000" required /></td>
              <td><SaveButton disabled={disabled} /></td>
            </tr>
          </tbody>
        </table>
      </form>
      {error && <div className="section-sub" role="alert" style={{ color: 'var(--red)', marginTop: '10px' }}>{error}</div>}
    </>
  )
}

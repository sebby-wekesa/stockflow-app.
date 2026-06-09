'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createDirectProductionOrder } from '@/actions/production-order'
import { listRawMaterialsForPicker } from '@/actions/raw-materials'
import { Plus, Trash2, Package } from 'lucide-react'

type Material = { id: string; sku: string; label: string; availableKg: number }

type Line = {
  rawMaterialId: string
  materialLabel: string
  cutLengthCm: string
  pieces: string
  totalLengthCm: string
  totalEdited: boolean // once the user types total manually, stop auto-filling
}

const emptyLine = (): Line => ({
  rawMaterialId: '',
  materialLabel: '',
  cutLengthCm: '',
  pieces: '',
  totalLengthCm: '',
  totalEdited: false,
})

export function DirectOrderForm({ onSuccess }: { onSuccess?: () => void }) {
  const router = useRouter()
  const [materials, setMaterials] = useState<Material[]>([])
  const [productName, setProductName] = useState('')
  const [expectedPieces, setExpectedPieces] = useState('')
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM')
  const [routeType, setRouteType] = useState<'' | 'FML' | 'HML'>('')
  const [eyeRollingSteps, setEyeRollingSteps] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Line[]>([emptyLine()])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listRawMaterialsForPicker()
      .then((m) => setMaterials(m as Material[]))
      .catch(() => setMaterials([]))
  }, [])

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => {
      const next = [...prev]
      const line = { ...next[i], ...patch }
      // Auto-fill total length = cut x pieces, unless the user overrode it.
      if (!line.totalEdited) {
        const cut = parseFloat(line.cutLengthCm)
        const pcs = parseInt(line.pieces)
        if (Number.isFinite(cut) && Number.isFinite(pcs) && cut > 0 && pcs > 0) {
          line.totalLengthCm = String(cut * pcs)
        }
      }
      next[i] = line
      return next
    })
  }

  function pickMaterial(i: number, rawMaterialId: string) {
    const m = materials.find((x) => x.id === rawMaterialId)
    updateLine(i, { rawMaterialId, materialLabel: m?.label ?? '' })
  }

  async function handleSubmit() {
    setError(null)

    if (productName.trim().length < 2) {
      setError('Enter a product name')
      return
    }
    const exp = parseInt(expectedPieces)
    if (!Number.isFinite(exp) || exp <= 0) {
      setError('Enter the expected number of finished pieces')
      return
    }
    const payloadLines = lines
      .filter((l) => l.rawMaterialId)
      .map((l) => ({
        rawMaterialId: l.rawMaterialId,
        cutLength: parseFloat(l.cutLengthCm),
        pieces: parseInt(l.pieces),
        totalLength: parseFloat(l.totalLengthCm),
      }))
    if (payloadLines.length === 0) {
      setError('Add at least one material line (each must have a material selected)')
      return
    }

    setSubmitting(true)
    const res = await createDirectProductionOrder({
      productName: productName.trim(),
      expectedPieces: exp,
      priority,
      notes: notes.trim() || null,
      materials: payloadLines,
      routeType: routeType || null,
      selectedOptionalNames: routeType === 'FML' ? eyeRollingSteps : [],
    })
    setSubmitting(false)

    if (!res.success) {
      setError(res.error || 'Could not create the order')
      return
    }

    if (onSuccess) {
      setProductName('')
      setExpectedPieces('')
      setPriority('MEDIUM')
      setRouteType('')
      setEyeRollingSteps([])
      setNotes('')
      setLines([emptyLine()])
      onSuccess()
    } else {
      router.push('/orders')
      router.refresh()
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    background: 'var(--surface2)',
    border: '1px solid var(--border2)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text)',
    fontSize: '14px',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 700,
    color: 'var(--muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '4px',
    display: 'block',
  }

  return (
    <div style={{ maxWidth: 820 }}>
      {error && (
        <div
          style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: '#fca5a5',
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 16,
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      {/* Product + expected pieces */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 14 }}>
          <div>
            <label style={labelStyle}>Product name</label>
            <input
              style={inputStyle}
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="e.g. Hilux rear spring leaf"
            />
          </div>
          <div>
            <label style={labelStyle}>Expected finished pieces</label>
            <input
              style={inputStyle}
              type="number"
              min={1}
              value={expectedPieces}
              onChange={(e) => setExpectedPieces(e.target.value)}
              placeholder="e.g. 15"
            />
          </div>
          <div>
            <label style={labelStyle}>Priority</label>
            <select style={inputStyle} value={priority} onChange={(e) => setPriority(e.target.value as any)}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>
        </div>

        {/* Production route */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14, marginTop: 14 }}>
          <div>
            <label style={labelStyle}>Production route</label>
            <select
              style={inputStyle}
              value={routeType}
              onChange={(e) => {
                const v = e.target.value as '' | 'FML' | 'HML'
                setRouteType(v)
                if (v !== 'FML') setEyeRollingSteps([])
              }}
            >
              <option value="">None (no operation tracking)</option>
              <option value="FML">FML (front — includes eye rolling)</option>
              <option value="HML">HML (rear — skips eye rolling)</option>
            </select>
          </div>

          {routeType === 'FML' && (
            <div>
              <label style={labelStyle}>Eye rolling section (tick the steps this order uses)</label>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', paddingTop: 6 }}>
                {['Eye Rolling', 'Scaffolding', 'Tapering'].map((step) => (
                  <label key={step} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={eyeRollingSteps.includes(step)}
                      onChange={(e) =>
                        setEyeRollingSteps((prev) =>
                          e.target.checked ? [...prev, step] : prev.filter((s) => s !== step)
                        )
                      }
                    />
                    {step}
                  </label>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                Unticked steps are recorded as skipped. You can still change these per order while tracking.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Material lines */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Package size={16} style={{ color: 'var(--muted)' }} />
            <span style={{ fontWeight: 700, fontSize: 14 }}>Materials to cut</span>
          </div>
          <button
            type="button"
            onClick={() => setLines((p) => [...p, emptyLine()])}
            className="btn btn-ghost btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={14} /> Add material
          </button>
        </div>

        {/* header row */}
        <div style={{ display: 'grid', gridTemplateColumns: '2.4fr 1fr 0.8fr 1fr 36px', gap: 10, marginBottom: 6 }}>
          <span style={labelStyle}>Material</span>
          <span style={labelStyle}>Cut length (cm)</span>
          <span style={labelStyle}>Pieces</span>
          <span style={labelStyle}>Total length (cm)</span>
          <span />
        </div>

        {lines.map((line, i) => (
          <div
            key={i}
            style={{ display: 'grid', gridTemplateColumns: '2.4fr 1fr 0.8fr 1fr 36px', gap: 10, marginBottom: 8, alignItems: 'center' }}
          >
            <select style={inputStyle} value={line.rawMaterialId} onChange={(e) => pickMaterial(i, e.target.value)}>
              <option value="">Select material…</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} ({m.availableKg.toLocaleString()} kg)
                </option>
              ))}
            </select>
            <input
              style={inputStyle}
              type="number"
              min={0}
              step="0.01"
              value={line.cutLengthCm}
              onChange={(e) => updateLine(i, { cutLengthCm: e.target.value })}
              placeholder="70"
            />
            <input
              style={inputStyle}
              type="number"
              min={0}
              value={line.pieces}
              onChange={(e) => updateLine(i, { pieces: e.target.value })}
              placeholder="3"
            />
            <input
              style={inputStyle}
              type="number"
              min={0}
              step="0.01"
              value={line.totalLengthCm}
              onChange={(e) => updateLine(i, { totalLengthCm: e.target.value, totalEdited: true })}
              placeholder="210"
            />
            <button
              type="button"
              onClick={() => setLines((p) => (p.length === 1 ? [emptyLine()] : p.filter((_, idx) => idx !== i)))}
              className="btn btn-ghost btn-sm"
              style={{ color: '#ef4444', padding: 6 }}
              title="Remove line"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
          Total length auto-fills as cut length × pieces. You can override it for offcuts or odd lengths.
        </div>
      </div>

      {/* Notes */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <label style={labelStyle}>Notes (optional)</label>
        <textarea
          style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything the production team should know"
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button type="button" onClick={() => router.back()} className="btn btn-ghost" disabled={submitting}>
          Cancel
        </button>
        <button type="button" onClick={handleSubmit} className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create production order'}
        </button>
      </div>
    </div>
  )
}

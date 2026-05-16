'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState, useEffect } from 'react'
import { Loader2, Package, Zap, AlertCircle } from 'lucide-react'
import { useToast } from './Toast'
import { Design } from '@/types'

const createProductionOrderSchema = z.object({
  designId: z.string().min(1, 'Design is required'),
  initialWeight: z.coerce
    .number()
    .positive('Initial weight must be a positive number')
    .max(10000, 'Initial weight cannot exceed 10,000 kg'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH'], {
    errorMap: () => ({ message: 'Please select a priority level' }),
  }),
})

type ProductionOrderFormData = z.infer<typeof createProductionOrderSchema>

interface CreateProductionOrderFormProps {
  designs: Design[]
  onSuccess?: () => void
}

export function CreateProductionOrderForm({
  designs,
  onSuccess,
}: CreateProductionOrderFormProps) {
  const { showToast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [orderNumber, setOrderNumber] = useState('')
  const [selectedDesign, setSelectedDesign] = useState<Design | null>(null)

  const {
    register,
    handleSubmit,
    formState: { isValid },
    watch,
    reset,
  } = useForm<ProductionOrderFormData>({
    resolver: zodResolver(createProductionOrderSchema),
    mode: 'onChange',
  })

  const designId = watch('designId')
  const priority = watch('priority')

  useEffect(() => {
    const timestamp = new Date()
    const year = timestamp.getFullYear()
    const randomNum = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
    setOrderNumber(`ORD-${year}-${randomNum}`)
  }, [])

  useEffect(() => {
    const design = designs.find((d) => d.id === designId)
    setSelectedDesign(design || null)
  }, [designId, designs])

  const onSubmit = async (data: ProductionOrderFormData) => {
    setIsLoading(true)

    try {
      const payload = {
        orderNumber,
        ...data,
        designName: selectedDesign?.name,
      }

      console.log('Submitting production order:', payload)

      const response = await fetch('/api/production-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error('Failed to create production order')
      }

      showToast(
        `Production order ${orderNumber} created successfully!`,
        'success'
      )

      reset()
      setOrderNumber(
        `ORD-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`
      )
      setSelectedDesign(null)

      onSuccess?.()
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to create production order'
      showToast(message, 'error')
      console.error('Error creating production order:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const priorityConfig = {
    LOW: { label: 'Low', color: 'text-emerald-400', bg: 'bg-emerald-900/20' },
    MEDIUM: {
      label: 'Medium',
      color: 'text-amber-400',
      bg: 'bg-amber-900/20',
    },
    HIGH: { label: 'High', color: 'text-red-400', bg: 'bg-red-900/20' },
  } as const

  return (
    <div className="card">
      <div className="section-header">
        <div>
          <div className="section-title">Create Production Order</div>
          <div className="section-sub">Initialize a new manufacturing order in the system</div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{
            fontSize: '12px',
            color: 'var(--muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            fontWeight: 600
          }}>
            Order Number
          </label>
          <input
            type="text"
            value={orderNumber}
            disabled
            style={{
              width: '100%',
              background: 'var(--surface2)',
              border: '1px solid var(--border2)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 12px',
              color: 'var(--muted)',
              fontSize: '14px',
              cursor: 'not-allowed',
              opacity: 0.6
            }}
          />
          <p style={{
            fontSize: '11px',
            color: 'var(--muted)',
            marginTop: '4px'
          }}>
            Auto-generated - Read-only
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{
            fontSize: '12px',
            color: 'var(--muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            fontWeight: 600
          }}>
            Design Selection *
          </label>
          <select
            {...register('designId')}
            style={{
              width: '100%',
              background: 'var(--surface2)',
              border: '1px solid var(--border2)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 12px',
              color: 'var(--text)',
              fontSize: '14px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="">Select a design...</option>
            {designs.map((design) => (
              <option key={design.id} value={design.id}>
                {design.name} ({design.kgPerUnit} kg)
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{
            fontSize: '12px',
            color: 'var(--muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            fontWeight: 600
          }}>
            Initial Weight (kg) *
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="Enter weight in kilograms"
            {...register('initialWeight', { valueAsNumber: true })}
            style={{
              width: '100%',
              background: 'var(--surface2)',
              border: '1px solid var(--border2)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 12px',
              color: 'var(--text)',
              fontSize: '14px',
              outline: 'none'
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{
            fontSize: '12px',
            color: 'var(--muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            fontWeight: 600,
            marginBottom: '8px'
          }}>
            Priority Level *
          </label>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px'
          }}>
            {(Object.keys(priorityConfig) as (keyof typeof priorityConfig)[]).map((level) => {
              const config = priorityConfig[level]
              const isSelected = priority === level
              return (
                <label
                  key={level}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border2)'}`,
                    background: isSelected ? 'rgba(240,192,64,0.1)' : 'var(--surface2)',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  <input
                    type="radio"
                    value={level}
                    {...register('priority')}
                    style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                  />
                  <span
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--muted)'}`,
                      background: isSelected ? 'var(--accent)' : 'transparent',
                      transition: 'all 0.15s'
                    }}
                  />
                  <span style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: config.color === 'text-emerald-400' ? 'var(--green)' : config.color === 'text-amber-400' ? 'var(--accent)' : 'var(--red)'
                  }}>
                    {config.label}
                  </span>
                </label>
              )
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading || !isValid}
          className="btn-primary"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px',
            opacity: (isLoading || !isValid) ? 0.6 : 1,
            cursor: (isLoading || !isValid) ? 'not-allowed' : 'pointer'
          }}
        >
          {isLoading ? (
            <>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              Creating Order...
            </>
          ) : (
            <>
              <Package size={16} />
              Create Production Order
            </>
          )}
        </button>
      </form>
    </div>
  )
}
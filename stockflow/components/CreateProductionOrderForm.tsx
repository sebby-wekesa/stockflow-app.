'use client'

import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { Loader2, Package } from 'lucide-react'
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

function generateOrderNumber() {
  const timestamp = new Date()
  const year = timestamp.getFullYear()
  const randomNum = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
  return `ORD-${year}-${randomNum}`
}

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
  const [orderNumber, setOrderNumber] = useState(generateOrderNumber)

  const {
    register,
    handleSubmit,
    formState: { isValid },
    reset,
    control,
  } = useForm<ProductionOrderFormData>({
    resolver: zodResolver(createProductionOrderSchema),
    mode: 'onChange',
  })

  const designId = useWatch({ control, name: 'designId' })
  const priority = useWatch({ control, name: 'priority' })
  const selectedDesign = designs.find((d) => d.id === designId) || null

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

      const result = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(result?.error || 'Failed to create production order')
      }

      const createdOrderNumber = result?.order?.orderNumber || orderNumber
      showToast(
        `Production order ${createdOrderNumber} created successfully!`,
        'success'
      )

      reset()
      setOrderNumber(generateOrderNumber())

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
    <div className="production-template-form">
      <div className="section-header">
        <div>
          <div className="section-title">Create Production Order</div>
          <div className="section-sub">Initialize a new manufacturing order in the system</div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="production-order-form">
        <div className="form-group">
          <label className="form-label">
            Job Number
          </label>
          <input
            type="text"
            value={orderNumber}
            onChange={(event) => setOrderNumber(event.target.value)}
            placeholder="Enter job number"
            className="form-input production-input"
          />
          <p className="production-field-help">
            Auto-filled, but editable before creating the order
          </p>
        </div>

        <div className="production-form-grid two">
          <div className="form-group">
            <label className="form-label">
            Design Selection *
            </label>
            <select
              {...register('designId')}
              className="form-input production-input"
            >
              <option value="">Select a design...</option>
              {designs.map((design) => (
                <option key={design.id} value={design.id}>
                  {design.name} ({design.kgPerUnit} kg)
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">
              Initial Weight (kg) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Enter weight in kilograms"
              {...register('initialWeight', { valueAsNumber: true })}
              className="form-input production-input"
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">
            Priority Level *
          </label>
          <div className="production-priority-control">
            {(Object.keys(priorityConfig) as (keyof typeof priorityConfig)[]).map((level) => {
              const config = priorityConfig[level]
              const isSelected = priority === level
              return (
                <label
                  key={level}
                  className={`production-priority-option ${isSelected ? 'active' : ''}`}
                >
                  <input
                    type="radio"
                    value={level}
                    {...register('priority')}
                    className="production-priority-radio"
                  />
                  <span className="production-priority-dot" />
                  <span className={`production-priority-label production-priority-${level.toLowerCase()}`}>
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
          className="btn btn-primary production-submit"
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

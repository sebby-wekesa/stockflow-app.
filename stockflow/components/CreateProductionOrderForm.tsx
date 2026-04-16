'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState, useEffect } from 'react'
import { Loader2, Package, Zap, AlertCircle } from 'lucide-react'
import { useToast } from './Toast'

// Enhanced schema with priority field
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

interface Design {
  id: string
  name: string
  targetWeight?: number
  description?: string
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
  const [orderNumber, setOrderNumber] = useState('')
  const [selectedDesign, setSelectedDesign] = useState<Design | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
    reset,
  } = useForm<ProductionOrderFormData>({
    resolver: zodResolver(createProductionOrderSchema),
    mode: 'onChange',
  })

  const designId = watch('designId')
  const initialWeight = watch('initialWeight')
  const priority = watch('priority')

  // Generate order number
  useEffect(() => {
    const timestamp = new Date()
    const year = timestamp.getFullYear()
    const randomNum = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
    setOrderNumber(`ORD-${year}-${randomNum}`)
  }, [])

  // Update selected design when designId changes
  useEffect(() => {
    const design = designs.find((d) => d.id === designId)
    setSelectedDesign(design || null)
  }, [designId, designs])

  const onSubmit = async (data: ProductionOrderFormData) => {
    setIsLoading(true)

    try {
      // Mock API call
      const payload = {
        orderNumber,
        ...data,
        designName: selectedDesign?.name,
      }

      console.log('Submitting production order:', payload)

      // Simulate API call
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

      const result = await response.json()

      showToast(
        `Production order ${orderNumber} created successfully!`,
        'success'
      )

      // Reset form
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
  }

  return (
    <div className="w-full max-w-2xl">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-xl backdrop-blur">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Package className="h-6 w-6 text-blue-400" />
          <div>
            <h2 className="text-xl font-semibold text-zinc-100">
              Create Production Order
            </h2>
            <p className="text-sm text-zinc-400">
              Initialize a new manufacturing order in the system
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Order Number (Read-only) */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Order Number
            </label>
            <input
              type="text"
              value={orderNumber}
              disabled
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-2.5 text-zinc-400 cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Auto-generated • Read-only
            </p>
          </div>

          {/* Design Selection */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Design Selection *
            </label>
            <select
              {...register('designId')}
              className={`w-full rounded-lg border bg-zinc-800/50 px-4 py-2.5 text-zinc-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.designId
                  ? 'border-red-500/50'
                  : 'border-zinc-700 focus:border-blue-500'
              }`}
            >
              <option value="">Select a design...</option>
              {designs.map((design) => (
                <option key={design.id} value={design.id}>
                  {design.name}
                  {design.targetWeight && ` (${design.targetWeight} kg)`}
                </option>
              ))}
            </select>
            {errors.designId && (
              <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {errors.designId.message}
              </p>
            )}
            {selectedDesign?.description && (
              <p className="mt-2 text-xs text-zinc-400 italic">
                {selectedDesign.description}
              </p>
            )}
          </div>

          {/* Initial Weight */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Initial Weight (kg) *
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Enter weight in kilograms"
                {...register('initialWeight', { valueAsNumber: true })}
                className={`w-full rounded-lg border bg-zinc-800/50 px-4 py-2.5 text-zinc-200 placeholder:text-zinc-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.initialWeight
                    ? 'border-red-500/50'
                    : 'border-zinc-700 focus:border-blue-500'
                }`}
              />
            </div>
            {errors.initialWeight && (
              <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {errors.initialWeight.message}
              </p>
            )}
          </div>

          {/* Priority Selection */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-3">
              Priority Level *
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(Object.keys(priorityConfig) as const).map((level) => {
                const config = priorityConfig[level]
                const isSelected = priority === level
                return (
                  <label
                    key={level}
                    className={`relative flex cursor-pointer items-center gap-2 rounded-lg border-2 p-3 transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-900/20'
                        : 'border-zinc-700 bg-zinc-800/30 hover:border-zinc-600'
                    }`}
                  >
                    <input
                      type="radio"
                      value={level}
                      {...register('priority')}
                      className="sr-only"
                    />
                    <span
                      className={`inline-block h-3 w-3 rounded-full border-2 transition-colors ${
                        isSelected
                          ? 'border-blue-400 bg-blue-400'
                          : `border-zinc-600 ${config.color}`
                      }`}
                    />
                    <span className={`text-sm font-medium ${config.color}`}>
                      {config.label}
                    </span>
                  </label>
                )
              })}
            </div>
            {errors.priority && (
              <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {errors.priority.message}
              </p>
            )}
          </div>

          {/* Summary Section */}
          {(designId || initialWeight) && (
            <div className="rounded-lg border border-blue-500/30 bg-blue-900/10 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-400" />
                <h3 className="font-semibold text-blue-200">Order Summary</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Order Number:</span>
                  <span className="font-medium text-zinc-100">{orderNumber}</span>
                </div>
                {selectedDesign && (
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Design:</span>
                    <span className="font-medium text-zinc-100">
                      {selectedDesign.name}
                    </span>
                  </div>
                )}
                {initialWeight && (
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Initial Weight:</span>
                    <span className="font-medium text-emerald-400">
                      {initialWeight} kg
                    </span>
                  </div>
                )}
                {priority && (
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Priority:</span>
                    <span
                      className={`font-medium ${priorityConfig[priority].color}`}
                    >
                      {priorityConfig[priority].label}
                    </span>
                  </div>
                )}
                <div className="border-t border-blue-500/20 pt-2 mt-2 flex justify-between">
                  <span className="text-zinc-300 font-semibold">
                    Total Weight Introduced:
                  </span>
                  <span className="font-semibold text-blue-400">
                    {initialWeight || 0} kg
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !isValid}
            className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 font-semibold text-white transition-all hover:from-blue-500 hover:to-blue-400 disabled:from-zinc-700 disabled:to-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Creating Order...
              </>
            ) : (
              <>
                <Package className="h-5 w-5" />
                Create Production Order
              </>
            )}
          </button>

          {/* Form Info */}
          <p className="text-xs text-zinc-500 text-center">
            * Required fields • All data is validated before submission
          </p>
        </form>
      </div>
    </div>
  )
}

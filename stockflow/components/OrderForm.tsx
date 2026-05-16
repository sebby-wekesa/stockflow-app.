'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState, useEffect } from 'react'
import { Loader2, Package, AlertCircle } from 'lucide-react'
import { useToast } from './Toast'
import { Design } from '@/types'

const createOrderSchema = z.object({
  designId: z.string().min(1, 'Design is required'),
  quantity: z.coerce
    .number()
    .int()
    .positive('Quantity must be a positive integer')
    .max(100000, 'Quantity cannot exceed 100,000 units'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH'], {
    errorMap: () => ({ message: 'Please select a priority level' }),
  }),
})

type OrderFormData = z.infer<typeof createOrderSchema>

interface CreateOrderFormProps {
  designs: Design[]
}

export function CreateOrderForm({ designs }: CreateOrderFormProps) {
  const { showToast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [selectedDesign, setSelectedDesign] = useState<Design | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
    reset,
  } = useForm<OrderFormData>({
    resolver: zodResolver(createOrderSchema),
    mode: 'onChange',
  })

  const designId = watch('designId')
  const quantity = watch('quantity')
  const priority = watch('priority')

  // Update selected design when designId changes
  useEffect(() => {
    const design = designs.find((d) => d.id === designId)
    setSelectedDesign(design || null)
  }, [designId, designs])

  const onSubmit = async (data: OrderFormData) => {
    setIsLoading(true)

    try {
      const targetKg = data.quantity * (selectedDesign?.kgPerUnit || 0)
      const response = await fetch('/api/production-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          designId: data.designId,
          quantity: data.quantity,
          targetKg,
          priority: data.priority,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create production order')
      }

      const result = await response.json()

      showToast(
        `Production order created successfully! Status: ${result.order.status}`,
        'success'
      )

      reset()
      setSelectedDesign(null)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create production order'
      showToast(message, 'error')
      console.error('Error creating production order:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const priorityConfig = {
    LOW: { label: 'Low', color: 'text-emerald-400', bg: 'bg-emerald-900/20' },
    MEDIUM: { label: 'Medium', color: 'text-amber-400', bg: 'bg-amber-900/20' },
    HIGH: { label: 'High', color: 'text-red-400', bg: 'bg-red-900/20' },
  } as const

  return (
    <div className="w-full">
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 shadow-xl backdrop-blur">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <Package className="h-6 w-6 text-blue-400" />
          <div>
            <h2 className="text-2xl font-semibold text-slate-100">
              Production Order Details
            </h2>
            <p className="text-sm text-slate-400">
              Configure your order parameters for manufacturing
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Design Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Select Design *
            </label>
            <select
              {...register('designId')}
              className={`w-full rounded-lg border bg-slate-800/50 px-4 py-3 text-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.designId
                  ? 'border-red-500/50'
                  : 'border-slate-700 focus:border-blue-500'
              }`}
            >
              <option value="">Choose a design...</option>
              {designs.map((design) => (
                <option key={design.id} value={design.id}>
                  {design.name}
                  {design.kgPerUnit && ` (${design.kgPerUnit} kg/unit)`}
                </option>
              ))}
            </select>
            {errors.designId && (
              <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {errors.designId.message}
              </p>
            )}
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Quantity (units) *
            </label>
            <input
              type="number"
              step="1"
              min="1"
              placeholder="Enter number of units"
              {...register('quantity', { valueAsNumber: true })}
              className={`w-full rounded-lg border bg-slate-800/50 px-4 py-3 text-slate-200 placeholder:text-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.quantity
                  ? 'border-red-500/50'
                  : 'border-slate-700 focus:border-blue-500'
              }`}
            />
            {errors.quantity && (
              <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {errors.quantity.message}
              </p>
            )}
          </div>

          {/* Priority Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Priority Level *
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(Object.keys(priorityConfig) as (keyof typeof priorityConfig)[]).map((level) => {
                const config = priorityConfig[level]
                const isSelected = priority === level
                return (
                  <label
                    key={level}
                    className={`relative flex cursor-pointer items-center gap-2 rounded-lg border-2 p-3 transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-900/20'
                        : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
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
                          : `border-slate-600 ${config.color}`
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
              <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {errors.priority.message}
              </p>
            )}
          </div>

          {/* Summary Section */}
          {(designId || quantity) && (
            <div className="rounded-lg border border-blue-500/30 bg-blue-900/10 p-4 mt-6">
              <h3 className="font-semibold text-blue-200 mb-3">Order Summary</h3>
              <div className="space-y-2 text-sm">
                {selectedDesign && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Design:</span>
                    <span className="font-medium text-slate-100">
                      {selectedDesign.name}
                    </span>
                  </div>
                )}
                {quantity && selectedDesign && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Quantity:</span>
                    <span className="font-medium text-emerald-400">
                      {quantity} units
                    </span>
                  </div>
                )}
                {quantity && selectedDesign && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Calculated Weight:</span>
                    <span className="font-medium text-emerald-400">
                      {(quantity * selectedDesign.kgPerUnit).toFixed(2)} kg
                    </span>
                  </div>
                )}
                {priority && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Priority:</span>
                    <span className={`font-medium ${priorityConfig[priority].color}`}>
                      {priorityConfig[priority].label}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !isValid}
            className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 font-semibold text-white transition-all hover:from-blue-500 hover:to-blue-400 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Creating Order...
              </>
            ) : (
              <>
                <Package className="h-5 w-5" />
                Launch Production
              </>
            )}
          </button>

          <p className="text-xs text-slate-500 text-center">
            * Required fields • Data is validated and encrypted during transmission
          </p>
        </form>
      </div>
    </div>
  )
}

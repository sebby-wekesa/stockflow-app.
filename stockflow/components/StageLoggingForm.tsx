'use client'

import React, { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { Package, Scale, Zap, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { useToast, Toast } from './Toast'
import { completeStage } from '@/actions/stage'

// Validation schema using Zod
const stageLogSchema = z.object({
  orderId: z.string().min(1, 'Please select an order'),
  inputWeight: z.number().positive(),
  outputWeight: z.number().nonnegative(),
  scrapWeight: z.number().nonnegative(),
}).refine((data) => {
  // Enforces the Key Rule: kg received = kg passed forward + kg scrapped [cite: 55]
  const tolerance = 0.001; // Handle floating point math
  return Math.abs(data.inputWeight - (data.outputWeight + data.scrapWeight)) < tolerance;
}, {
  message: "The kg balance is incorrect: In must equal Out + Scrap.",
})

type StageLogForm = z.infer<typeof stageLogSchema>

interface Order {
  id: string
  code: string
  weight: number
  designName: string
}

interface StageLoggingProps {
  activeOrders: Order[]
  currentDepartment: string
  onSuccess?: () => void
}

const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: 'easeOut',
    },
  },
}

const fieldVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: {
    opacity: 1,
    x: 0,
  },
}

export const StageLoggingForm: React.FC<StageLoggingProps> = ({
  activeOrders,
  currentDepartment,
  onSuccess,
}) => {
  const { showToast } = useToast()
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [balanceOffset, setBalanceOffset] = useState<number | null>(null)

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<StageLogForm>({
    resolver: zodResolver(stageLogSchema),
    defaultValues: {
      orderId: '',
      inputWeight: 0,
      outputWeight: 0,
      scrapWeight: 0,
    },
  })

  const outputWeight = watch('outputWeight')
  const scrapWeight = watch('scrapWeight')
  const orderId = watch('orderId')

  // Update selected order when orderId changes
  useEffect(() => {
    const order = activeOrders.find((o) => o.id === orderId)
    setSelectedOrder(order || null)
    setValue('inputWeight', order?.weight || 0)
  }, [orderId, activeOrders, setValue])

  // Real-time balance validation
  useEffect(() => {
    if (selectedOrder) {
      const sum = outputWeight + scrapWeight
      const offset = selectedOrder.weight - sum
      setBalanceOffset(offset)
    }
  }, [outputWeight, scrapWeight, selectedOrder])

  const isBalanceValid = balanceOffset !== null && Math.abs(balanceOffset) < 0.01
  const isSubmitDisabled = !isBalanceValid || isLoading

  const onSubmit = async (data: StageLogForm) => {
    if (!selectedOrder) {
      showToast('Please select an order', 'error')
      return
    }

    if (!isBalanceValid) {
      showToast('Weight does not balance. Please adjust output and scrap weights.', 'error')
      return
    }

    setIsLoading(true)

    try {
      const result = await completeStage({
        orderId: data.orderId,
        kgIn: data.inputWeight,
        kgOut: data.outputWeight,
        kgScrap: data.scrapWeight,
      })

      if (result.error) {
        showToast(result.error, 'error')
        return
      }

      // Trigger confetti effect
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      })

      showToast(`Stage logged successfully for ${selectedOrder.code}`, 'success')

      // Reset form
      reset()
      setSelectedOrder(null)
      setBalanceOffset(null)

      // Call callback
      onSuccess?.()
    } catch (error) {
      console.error('Submission error:', error)
      showToast('Failed to log stage. Please try again.', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <ToastProvider>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-2xl mx-auto"
      >
        <div className="bg-slate-900 rounded-lg shadow-xl p-8 border border-slate-700">
          {/* Header */}
          <motion.div className="mb-8" variants={fieldVariants}>
            <div className="flex items-center gap-3 mb-2">
              <Zap className="w-6 h-6 text-amber-400" />
              <h2 className="text-2xl font-bold text-white">Stage Logger</h2>
            </div>
            <p className="text-slate-300 text-sm">
              {currentDepartment} Stage • Log material weights and track traceability
            </p>
          </motion.div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Order Selection */}
            <motion.div variants={fieldVariants}>
              <label className="block text-sm font-semibold text-slate-200 mb-2">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Select Order
                </div>
              </label>
              <Controller
                name="orderId"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    className={`w-full px-4 py-3 bg-slate-800 text-white border-2 rounded-lg transition-all focus:outline-none ${
                      errors.orderId
                        ? 'border-red-500 focus:border-red-400'
                        : 'border-slate-600 focus:border-amber-400'
                    }`}
                  >
                    <option value="">-- Select an order --</option>
                    {activeOrders.map((order) => (
                      <option key={order.id} value={order.id}>
                        {order.code} • {order.designName} • {order.weight}kg
                      </option>
                    ))}
                  </select>
                )}
              />
              {errors.orderId && (
                <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.orderId.message}
                </p>
              )}
            </motion.div>

            {/* Input Weight Display */}
            <AnimatePresence>
              {selectedOrder && (
                <motion.div
                  variants={fieldVariants}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  className="bg-slate-800 rounded-lg p-4 border border-slate-700"
                >
                  <label className="block text-sm font-semibold text-slate-200 mb-2">
                    <div className="flex items-center gap-2">
                      <Scale className="w-4 h-4" />
                      Input Weight (from previous stage)
                    </div>
                  </label>
                  <div className="text-3xl font-bold text-amber-400">
                    {selectedOrder.weight.toFixed(2)} kg
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Output Weight */}
            <motion.div variants={fieldVariants}>
              <label className="block text-sm font-semibold text-slate-200 mb-2">
                Output Weight (kg)
              </label>
              <Controller
                name="outputWeight"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    disabled={!selectedOrder}
                    className="w-full px-4 py-3 bg-slate-800 text-white text-xl font-semibold border-2 border-slate-600 rounded-lg transition-all focus:outline-none focus:border-green-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                )}
              />
            </motion.div>

            {/* Scrap Weight */}
            <motion.div variants={fieldVariants}>
              <label className="block text-sm font-semibold text-slate-200 mb-2">
                Scrap Weight (kg)
              </label>
              <Controller
                name="scrapWeight"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    disabled={!selectedOrder}
                    className="w-full px-4 py-3 bg-slate-800 text-white text-xl font-semibold border-2 border-slate-600 rounded-lg transition-all focus:outline-none focus:border-green-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                )}
              />
            </motion.div>

            {/* Balance Offset Display */}
            <AnimatePresence>
              {selectedOrder && balanceOffset !== null && (
                <motion.div
                  variants={fieldVariants}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  className={`rounded-lg p-4 border-2 transition-all ${
                    isBalanceValid
                      ? 'bg-green-900/30 border-green-500'
                      : 'bg-red-900/30 border-red-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isBalanceValid ? (
                        <CheckCircle className="w-5 h-5 text-green-400" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-400" />
                      )}
                      <span className="font-semibold text-sm">
                        {isBalanceValid ? 'Balance Valid' : 'Balance Mismatch'}
                      </span>
                    </div>
                    <div className={`text-lg font-bold ${isBalanceValid ? 'text-green-400' : 'text-red-400'}`}>
                      {balanceOffset > 0 ? '+' : ''}{balanceOffset.toFixed(3)} kg
                    </div>
                  </div>
                  <p className="text-xs mt-2 text-slate-300">
                    Expected: {selectedOrder.weight.toFixed(2)}kg | Processing: {(outputWeight + scrapWeight).toFixed(2)}kg
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit Button */}
            <motion.button
              variants={fieldVariants}
              type="submit"
              disabled={isSubmitDisabled}
              whileHover={!isSubmitDisabled ? { scale: 1.02 } : {}}
              whileTap={!isSubmitDisabled ? { scale: 0.98 } : {}}
              className={`w-full py-4 px-6 rounded-lg font-semibold text-lg transition-all flex items-center justify-center gap-2 ${
                isSubmitDisabled
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-amber-500 text-white hover:bg-amber-600 active:bg-amber-700'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Logging...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Complete Stage
                </>
              )}
            </motion.button>

            {/* Help Text */}
            {!selectedOrder && (
              <p className="text-center text-slate-400 text-sm">
                Select an order to begin logging
              </p>
            )}
          </form>
        </div>
      </motion.div>
    </ToastProvider>
  )
}

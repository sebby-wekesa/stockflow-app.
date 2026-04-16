'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertTriangle, Package, Scale, CheckCircle, Loader2 } from 'lucide-react'
import { useToast } from './Toast'

interface ProductionOrder {
  id: string
  orderNumber: string
  design: {
    name: string
    code: string
  }
  targetKg: number
  currentDept?: string
  currentStage?: {
    name: string
    sequence: number
  }
}

interface StageLoggingModalProps {
  isOpen: boolean
  onClose: () => void
  order: ProductionOrder
  onSuccess: () => void
}

type ScrapReason = string

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 }
}

export default function StageLoggingModal({
  isOpen,
  onClose,
  order,
  onSuccess
}: StageLoggingModalProps) {
  const department = order.currentDept || 'Unknown'
  const scrapReasons: string[] = department === 'Cutting' || department === 'Drilling' ? ['Swarf', 'Off-cuts'] : department === 'Forging' ? ['Scale', 'Flash'] : department === 'Electroplating' ? ['Coating Defects'] : ['General Scrap']
  const stageName = order.currentStage?.name || "Current Stage"
  const initialWeight = order.targetKg
  const operatorId = "current-operator" // TODO: Get from auth
  const currentSequence = order.currentStage?.sequence || 1
  const { showToast } = useToast()
  const [kgOut, setKgOut] = useState('')
  const [kgScrap, setKgScrap] = useState('')
  const [scrapReason, setScrapReason] = useState<ScrapReason | ''>('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const kgOutNum = parseFloat(kgOut) || 0
  const kgScrapNum = parseFloat(kgScrap) || 0
  const calculatedTotal = kgOutNum + kgScrapNum
  const isBalanced = department === 'Electroplating' ? (kgOutNum >= initialWeight && kgScrapNum >= 0) : Math.abs(calculatedTotal - initialWeight) <= 0.01
  const isValid = kgOut.trim() && kgScrap.trim() && scrapReason && isBalanced

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid || isSubmitting) return

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/production/log-stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          stageId: order.currentStage?.id || currentSequence, // assuming stageId
          kgIn: initialWeight,
          kgOut: kgOutNum,
          kgScrap: kgScrapNum,
          scrapReason,
          notes: notes.trim(),
          operatorId,
          currentSequence
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to complete stage')
      }

      showToast('Stage completed successfully!', 'success')
      onSuccess()
      onClose()
    } catch (error: any) {
      showToast(`Error: ${error.message}`, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={{ duration: 0.2 }}
          className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <Package className="w-6 h-6 text-blue-400" />
              <div>
                <h2 className="text-2xl font-bold text-white">Stage Logging</h2>
                <p className="text-slate-400 text-sm">Record production data for this stage</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Contextual Header */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-600">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Order Number</p>
                  <p className="text-lg font-bold text-white">{order.orderNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Current Stage</p>
                  <p className="text-lg font-bold text-blue-300">{stageName}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Initial Weight</p>
                  <p className="text-lg font-bold text-amber-300">{initialWeight.toFixed(2)} kg</p>
                </div>
              </div>
            </div>

            {/* Weight Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-2">
                  Output Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={kgOut}
                  onChange={(e) => setKgOut(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 bg-slate-800 text-white border border-slate-600 rounded-lg text-lg font-mono focus:outline-none focus:border-blue-400"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-2">
                  Scrap Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={kgScrap}
                  onChange={(e) => setKgScrap(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 bg-slate-800 text-white border border-slate-600 rounded-lg text-lg font-mono focus:outline-none focus:border-red-400"
                  required
                />
              </div>
            </div>

            {/* Scrap Reason */}
            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-2">
                Scrap Reason
              </label>
              <select
                value={scrapReason}
                onChange={(e) => setScrapReason(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800 text-white border border-slate-600 rounded-lg text-lg focus:outline-none focus:border-red-400"
                required
              >
                <option value="">Select reason...</option>
                {scrapReasons.map((reason) => (
                  <option key={reason} value={reason}>{reason}</option>
                ))}
              </select>
            </div>

            {/* Mass Balance Validator */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-600">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-400">Validation Check</span>
                <Scale className="w-5 h-5 text-slate-400" />
              </div>
              {department === 'Electroplating' ? (
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-xs text-slate-400">Output Weight</p>
                    <p className="text-xl font-bold text-white">{kgOutNum.toFixed(2)} kg</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Minimum Required</p>
                    <p className="text-xl font-bold text-amber-300">{initialWeight.toFixed(2)} kg</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-xs text-slate-400">Calculated Total</p>
                    <p className="text-xl font-bold text-white">{calculatedTotal.toFixed(2)} kg</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Required Total</p>
                    <p className="text-xl font-bold text-amber-300">{initialWeight.toFixed(2)} kg</p>
                  </div>
                </div>
              )}
              {!isBalanced && (
                <div className="mt-3 flex items-center gap-2 text-red-400">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="text-sm font-semibold">
                    {department === 'Electroplating' ? `Output must be >= ${initialWeight.toFixed(2)} kg and Scrap >= 0` : `Weight Mismatch: Total must equal ${initialWeight.toFixed(2)} kg`}
                  </span>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional comments..."
                rows={3}
                className="w-full px-4 py-3 bg-slate-800 text-white border border-slate-600 rounded-lg text-sm focus:outline-none focus:border-slate-400 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-4 pt-4 border-t border-slate-700">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 bg-slate-700 text-white rounded-lg font-semibold hover:bg-slate-600 transition-colors"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isValid || isSubmitting}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Completing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Complete Stage
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
)
}
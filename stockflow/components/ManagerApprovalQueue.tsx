'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Package,
  TrendingUp,
  Loader2,
  ChevronRight,
  Filter,
} from 'lucide-react'
import { useToast } from './Toast'

interface ProductionOrder {
  id: string
  code: string
  designName: string
  targetKg: number
  quantity: number
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  expectedUnits: number
  status: string
}

interface RejectionData {
  orderId: string
  reason: string
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

const skeletonVariants = {
  pulse: {
    opacity: [0.5, 1, 0.5],
    transition: { duration: 2, repeat: Infinity },
  },
}

const LoadingSkeletons: React.FC = () => (
  <div className="space-y-4">
    {[...Array(3)].map((_, i) => (
      <motion.div
        key={i}
        variants={skeletonVariants}
        animate="pulse"
        className="bg-slate-800 rounded-lg h-32 border border-slate-700"
      />
    ))}
  </div>
)

const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
  const colors = {
    LOW: 'bg-blue-900/30 text-blue-300 border-blue-700',
    MEDIUM: 'bg-yellow-900/30 text-yellow-300 border-yellow-700',
    HIGH: 'bg-orange-900/30 text-orange-300 border-orange-700',
    URGENT: 'bg-red-900/30 text-red-300 border-red-700',
  }
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${colors[priority as keyof typeof colors]}`}>
      {priority}
    </span>
  )
}

const RejectionModal: React.FC<{
  orderId: string
  onConfirm: (data: RejectionData) => void
  onCancel: () => void
  isLoading: boolean
}> = ({ orderId, onConfirm, onCancel, isLoading }) => {
  const [reason, setReason] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (reason.trim().length < 5) {
      return
    }
    onConfirm({ orderId, reason })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        className="bg-slate-900 rounded-lg border border-slate-700 p-6 max-w-md w-full shadow-xl"
      >
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <h3 className="text-lg font-bold text-white">Reject Order</h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-200 mb-2">
              Reason for Rejection
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this order is being rejected..."
              maxLength={200}
              required
              minLength={5}
              className="w-full px-4 py-2 bg-slate-800 text-white border border-slate-600 rounded-lg text-sm focus:outline-none focus:border-red-400"
              rows={3}
            />
            <p className="text-xs text-slate-400 mt-1">
              {reason.length}/200 characters
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg font-semibold hover:bg-slate-600 disabled:opacity-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={reason.trim().length < 5 || isLoading}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Rejecting...
                </>
              ) : (
                'Confirm Rejection'
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

const OrderCard: React.FC<{
  order: ProductionOrder
  onApprove: (id: string) => void
  onReject: (id: string) => void
  loadingId: string | null
  userRole: string | null
}> = ({ order, onApprove, onReject, loadingId, userRole }) => {
  const isLoading = loadingId === order.id
  const canManage = userRole === 'MANAGER' || userRole === 'ADMIN'

  return (
    <motion.div
      variants={itemVariants}
      className="bg-slate-800 border border-amber-700/50 rounded-lg p-6 hover:border-amber-500/70 transition-all"
    >
      <div className="grid grid-cols-12 gap-4 items-start">
        {/* Left: Order Info */}
        <div className="col-span-7 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-400" />
                Order {order.code}
              </h3>
              <p className="text-slate-300 text-sm mt-1">{order.designName}</p>
            </div>
            <PriorityBadge priority={order.priority} />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-400">Weight (kg)</p>
              <p className="text-lg font-semibold text-amber-300">{order.targetKg.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-slate-400">Quantity</p>
              <p className="text-lg font-semibold text-amber-300">{order.quantity}</p>
            </div>
          </div>
        </div>

        {/* Middle: Expected Units */}
        <div className="col-span-2 bg-slate-900 rounded-lg p-4 border border-slate-700 text-center">
          <div className="flex items-center justify-center gap-1 mb-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-xs text-slate-400">Expected Units</span>
          </div>
          <p className="text-2xl font-bold text-green-400">{order.expectedUnits}</p>
          <p className="text-xs text-slate-500 mt-1">Target quantity</p>
        </div>

        {/* Right: Actions */}
        <div className="col-span-3 space-y-2">
          <button
            onClick={() => onApprove(order.id)}
            disabled={!canManage || isLoading}
            className={`w-full py-2 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
              canManage && !isLoading
                ? 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800'
                : 'bg-slate-700 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Approving...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">Approve</span>
              </>
            )}
          </button>

          <button
            onClick={() => onReject(order.id)}
            disabled={!canManage || isLoading}
            className={`w-full py-2 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
              canManage && !isLoading
                ? 'bg-red-600/20 text-red-300 border border-red-600/50 hover:bg-red-600/30'
                : 'bg-slate-700 text-slate-400 cursor-not-allowed'
            }`}
          >
            <XCircle className="w-4 h-4" />
            <span className="text-sm">Reject</span>
          </button>

          {/* Routing Indicator */}
          <div className="flex items-center gap-2 text-xs text-slate-400 px-2 py-1 bg-slate-900 rounded">
            <ChevronRight className="w-3 h-3 text-amber-500" />
            <span>→ Cutting Dept</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

interface ManagerApprovalQueueProps {
  userRole?: string | null
}

export const ManagerApprovalQueue: React.FC<ManagerApprovalQueueProps> = ({ userRole = 'MANAGER' }) => {
  const { showToast } = useToast()
  const [orders, setOrders] = useState<ProductionOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [showRejectionModal, setShowRejectionModal] = useState(false)
  const [rejectionOrderId, setRejectionOrderId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'ALL' | 'URGENT' | 'HIGH'>('ALL')

  // Fetch pending orders
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setIsLoading(true)
        const res = await fetch('/api/production-orders?status=PENDING')
        if (!res.ok) throw new Error('Failed to fetch orders')

        const data = await res.json()
        setOrders(data.data || [])
      } catch (error) {
        console.error('Fetch error:', error)
        showToast('Failed to load orders', 'error')
      } finally {
        setIsLoading(false)
      }
    }

    fetchOrders()
  }, [showToast])

  const handleApprove = async (orderId: string) => {
    setLoadingId(orderId)
    try {
      const res = await fetch(`/api/production-orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'RELEASED' }),
      })

      if (!res.ok) throw new Error('Failed to approve order')

      setOrders(orders.filter((o) => o.id !== orderId))
      showToast('Order approved and released to production!', 'success')
    } catch (error) {
      console.error('Approval error:', error)
      showToast('Failed to approve order', 'error')
    } finally {
      setLoadingId(null)
    }
  }

  const handleRejectClick = (orderId: string) => {
    setRejectionOrderId(orderId)
    setShowRejectionModal(true)
  }

  const handleConfirmRejection = async (data: RejectionData) => {
    setLoadingId(data.orderId)
    try {
      const res = await fetch(`/api/production-orders/${data.orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'REJECTED',
          rejectionReason: data.reason,
        }),
      })

      if (!res.ok) throw new Error('Failed to reject order')

      setOrders(orders.filter((o) => o.id !== data.orderId))
      setShowRejectionModal(false)
      showToast('Order rejected with reason noted', 'success')
    } catch (error) {
      console.error('Rejection error:', error)
      showToast('Failed to reject order', 'error')
    } finally {
      setLoadingId(null)
    }
  }

  const filteredOrders = orders.filter((order) => {
    if (filter === 'URGENT') return order.priority === 'URGENT'
    if (filter === 'HIGH') return ['HIGH', 'URGENT'].includes(order.priority)
    return true
  })

  const stats = {
    total: orders.length,
    urgent: orders.filter((o) => o.priority === 'URGENT').length,
    highPriority: orders.filter((o) => ['HIGH', 'URGENT'].includes(o.priority)).length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-900 border border-amber-700/50 rounded-lg p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <AlertCircle className="w-8 h-8 text-amber-400" />
              Approval Queue
            </h1>
            <p className="text-slate-300 mt-2">Review and approve pending production orders</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-amber-900/20 border border-amber-700 rounded-lg p-4 text-center">
              <p className="text-sm text-amber-300">Pending</p>
              <p className="text-2xl font-bold text-amber-200">{stats.total}</p>
            </div>
            <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 text-center">
              <p className="text-sm text-red-300">Urgent</p>
              <p className="text-2xl font-bold text-red-200">{stats.urgent}</p>
            </div>
            <div className="bg-orange-900/20 border border-orange-700 rounded-lg p-4 text-center">
              <p className="text-sm text-orange-300">High+</p>
              <p className="text-2xl font-bold text-orange-200">{stats.highPriority}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['ALL', 'HIGH', 'URGENT'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all ${
              filter === tab
                ? 'bg-amber-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Filter className="w-4 h-4" />
            {tab === 'ALL' ? 'All Orders' : `${tab} Priority`}
          </button>
        ))}
      </div>

      {/* Orders List */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-4"
      >
        {isLoading ? (
          <LoadingSkeletons />
        ) : filteredOrders.length === 0 ? (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-12 text-center">
            <Package className="w-12 h-12 text-slate-600 mx-auto mb-4 opacity-50" />
            <p className="text-slate-300 text-lg font-semibold">No pending orders</p>
            <p className="text-slate-400 text-sm mt-1">All production orders have been processed</p>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onApprove={handleApprove}
              onReject={handleRejectClick}
              loadingId={loadingId}
              userRole={userRole}
            />
          ))
        )}
      </motion.div>

      {/* Security Note */}
      {!userRole || (userRole !== 'MANAGER' && userRole !== 'ADMIN') && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-blue-300 font-semibold">Insufficient Permissions</p>
            <p className="text-blue-400 text-sm mt-1">
              You need Manager or Admin role to approve orders
            </p>
          </div>
        </motion.div>
      )}

      {/* Rejection Modal */}
      <AnimatePresence>
        {showRejectionModal && (
          <RejectionModal
            orderId={rejectionOrderId || ''}
            onConfirm={handleConfirmRejection}
            onCancel={() => setShowRejectionModal(false)}
            isLoading={loadingId !== null}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

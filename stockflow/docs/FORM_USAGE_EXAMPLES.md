/**
 * CreateProductionOrderForm - Usage Examples
 * 
 * This file demonstrates various ways to implement the CreateProductionOrderForm
 * component in your StockFlow application.
 */

// ============================================================================
// EXAMPLE 1: Basic Implementation in Orders Page
// ============================================================================

import { CreateProductionOrderForm } from '@/components/CreateProductionOrderForm'
import { ToastProvider } from '@/components/Toast'
import { useState, useEffect } from 'react'

export function OrdersPageExample() {
  const [designs, setDesigns] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Fetch designs from API
    fetch('/api/designs')
      .then((res) => res.json())
      .then((data) => {
        setDesigns(data)
        setIsLoading(false)
      })
      .catch((error) => {
        console.error('Error fetching designs:', error)
        setIsLoading(false)
      })
  }, [])

  const handleOrderSuccess = () => {
    // Refresh orders list when new order is created
    console.log('Order created! Refreshing list...')
    // Trigger orders list refresh here if needed
  }

  if (isLoading) return <div>Loading...</div>

  return (
    <ToastProvider>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Production Orders</h1>
        <CreateProductionOrderForm
          designs={designs}
          onSuccess={handleOrderSuccess}
        />
      </div>
    </ToastProvider>
  )
}

// ============================================================================
// EXAMPLE 2: Modal Implementation
// ============================================================================

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useState } from 'react'

export function OrderModalExample() {
  const [isOpen, setIsOpen] = useState(false)
  const [designs, setDesigns] = useState([])

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
  }

  const handleOrderSuccess = () => {
    // Close modal on success
    setIsOpen(false)
    // Show confirmation or refresh data
    console.log('Order created successfully!')
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        New Order
      </button>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Production Order</DialogTitle>
          </DialogHeader>
          <CreateProductionOrderForm
            designs={designs}
            onSuccess={handleOrderSuccess}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

// ============================================================================
// EXAMPLE 3: With Toast Provider Setup in Layout
// ============================================================================

// app/layout.tsx
import { ToastProvider } from '@/components/Toast'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  )
}

// app/(dashboard)/orders/page.tsx
// Now you don't need to wrap each page with ToastProvider
export default function OrdersPage() {
  return <CreateProductionOrderForm designs={designs} />
}

// ============================================================================
// EXAMPLE 4: With Data Refresh Integration
// ============================================================================

import { useCallback } from 'react'

export function OrdersPageWithRefresh() {
  const [designs, setDesigns] = useState([])
  const [orders, setOrders] = useState([])

  const refreshOrdersList = useCallback(async () => {
    try {
      const response = await fetch('/api/production-orders')
      const data = await response.json()
      setOrders(data)
    } catch (error) {
      console.error('Error refreshing orders:', error)
    }
  }, [])

  const handleOrderSuccess = () => {
    // Automatically refresh the orders list
    refreshOrdersList()
  }

  return (
    <div className="space-y-8">
      <CreateProductionOrderForm
        designs={designs}
        onSuccess={handleOrderSuccess}
      />

      {/* Orders list updates automatically when new order is created */}
      {/* <OrdersList orders={orders} /> */}
    </div>
  )
}

// ============================================================================
// EXAMPLE 5: Using the Toast Hook Directly
// ============================================================================

import { useToast } from '@/components/Toast'

export function CustomOrderCreation() {
  const { showToast } = useToast()

  const handleManualSubmit = async (data: any) => {
    try {
      const response = await fetch('/api/production-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) throw new Error('Failed to create order')

      showToast('Order created successfully!', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'An error occurred', 'error')
    }
  }

  return <div>Custom implementation with manual toast handling</div>
}

// ============================================================================
// EXAMPLE 6: Server-Side Data Fetching
// ============================================================================

async function getDesignsServerSide() {
  const designs = await prisma.design.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      targetWeight: true,
    },
    orderBy: { name: 'asc' },
  })
  return designs
}

// 'use client' component that receives designs as props
export function OrdersPageServerFetch({
  designs,
}: {
  designs: Awaited<ReturnType<typeof getDesignsServerSide>>
}) {
  return (
    <ToastProvider>
      <CreateProductionOrderForm designs={designs} />
    </ToastProvider>
  )
}

// ============================================================================
// EXAMPLE 7: Advanced - With Loading States and Error Boundaries
// ============================================================================

import { ErrorBoundary } from 'react-error-boundary'

function ErrorFallback({ error, resetErrorBoundary }: any) {
  return (
    <div className="rounded-lg border border-red-500/30 bg-red-900/10 p-4 text-red-100">
      <h2 className="font-bold mb-2">Something went wrong:</h2>
      <p className="text-sm">{error.message}</p>
      <button
        onClick={resetErrorBoundary}
        className="mt-4 px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
      >
        Try again
      </button>
    </div>
  )
}

export function OrdersPageWithErrorBoundary() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <CreateProductionOrderForm designs={designs} />
    </ErrorBoundary>
  )
}

// ============================================================================
// EXAMPLE 8: API Handler Pattern (Server Action)
// ============================================================================

// app/actions/orders.ts
'use server'

import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

export async function createProductionOrderAction(formData: FormData) {
  const designId = formData.get('designId') as string
  const initialWeight = parseFloat(formData.get('initialWeight') as string)
  const priority = formData.get('priority') as string

  // Validate data
  if (!designId || !initialWeight || !priority) {
    throw new Error('Missing required fields')
  }

  // Create in database
  const order = await prisma.productionOrder.create({
    data: {
      designId,
      targetKg: initialWeight,
      priority,
      quantity: 1,
      status: 'PENDING',
    },
  })

  // Redirect or return response
  redirect(`/orders/${order.id}`)
}

// ============================================================================
// EXAMPLE 9: Custom Validation Extension
// ============================================================================

import { z } from 'zod'

// Extend the schema with additional validation
const extendedProductionOrderSchema = z.object({
  designId: z.string().min(1, 'Design is required'),
  initialWeight: z.coerce
    .number()
    .positive('Initial weight must be a positive number')
    .max(10000, 'Initial weight cannot exceed 10,000 kg'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  notes: z.string().max(500).optional(), // Additional field
  estimatedDays: z.coerce.number().int().positive().optional(), // Additional field
})

// ============================================================================
// EXAMPLE 10: Responsive Grid Layout
// ============================================================================

export function OrdersPageResponsive() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div>
        <h2 className="text-xl font-bold mb-4">Create New Order</h2>
        <CreateProductionOrderForm designs={designs} />
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4">Recent Orders</h2>
        {/* <OrdersList orders={orders} /> */}
      </div>
    </div>
  )
}

// ============================================================================
// EXAMPLE 11: Themes and Customization
// ============================================================================

// Don't need to modify the form component - Tailwind handles theming
// Just ensure your app supports dark mode in tailwind.config.ts:
/*
  darkMode: 'class', // or 'media'
  theme: {
    extend: {
      colors: {
        // Custom color definitions if needed
      }
    }
  }
*/

// ============================================================================
// BONUS: Testing Example
// ============================================================================

import { render, screen, userEvent } from '@testing-library/react'

async function testCreateProductionOrderForm() {
  // Render component with mock designs
  const mockDesigns = [
    { id: '1', name: 'Design A', description: 'Test design' },
  ]

  render(
    <ToastProvider>
      <CreateProductionOrderForm designs={mockDesigns} />
    </ToastProvider>
  )

  // Test rendering
  expect(screen.getByText('Create Production Order')).toBeInTheDocument()

  // Test form submission
  const designSelect = screen.getByRole('combobox')
  await userEvent.selectOption(designSelect, '1')

  const weightInput = screen.getByPlaceholderText(/weight/i)
  await userEvent.type(weightInput, '50')

  const submitButton = screen.getByRole('button', { name: /create/i })
  await userEvent.click(submitButton)

  // Verify submission
  expect(screen.getByText(/created successfully/i)).toBeInTheDocument()
}

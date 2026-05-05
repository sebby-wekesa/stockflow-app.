import Link from 'next/link'
import { createCustomer } from '../actions'
import { CustomerForm } from '../_components/customer-form'

export default function NewCustomerPage() {
  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href="/customers" className="text-sm text-muted hover:text-text">← Back to customers</Link>
        <h1 className="font-head text-2xl font-bold mt-2">Add customer</h1>
      </div>
      <CustomerForm mode="create" action={createCustomer} />
    </div>
  )
}

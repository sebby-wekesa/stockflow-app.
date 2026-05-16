import Link from 'next/link'
import { createCustomer } from '../actions'

export const dynamic = "force-dynamic";

export default function NewCustomerPage() {
  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href="/customers" className="text-sm text-muted hover:text-text">
          ← Back to customers
        </Link>
        <h1 className="font-head text-2xl font-bold mt-2">Add new customer</h1>
        <p className="text-muted text-sm mt-1">
          Create a new customer record for sales orders
        </p>
      </div>

      <div className="card p-6">
        <form action={createCustomer} className="space-y-6">
          <div>
            <label className="label">
              <span className="label-text">Customer name <span className="text-red">*</span></span>
            </label>
            <input
              type="text"
              name="name"
              className="input input-bordered w-full"
              placeholder="e.g. ABC Hardware Ltd"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">
                <span className="label-text">Phone number</span>
              </label>
              <input
                type="tel"
                name="phone"
                className="input input-bordered w-full"
                placeholder="e.g. +254 712 345 678"
              />
            </div>

            <div>
              <label className="label">
                <span className="label-text">Email address</span>
              </label>
              <input
                type="email"
                name="email"
                className="input input-bordered w-full"
                placeholder="e.g. contact@company.com"
              />
            </div>
          </div>

          <div>
            <label className="label">
              <span className="label-text">Address</span>
            </label>
            <textarea
              name="address"
              className="textarea textarea-bordered w-full"
              placeholder="Physical address for delivery and invoicing"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Link href="/customers" className="btn btn-ghost">
              Cancel
            </Link>
            <button type="submit" className="btn btn-primary">
              Create customer
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
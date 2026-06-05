import Link from 'next/link'
import { createCustomer } from '../actions'

export const dynamic = "force-dynamic";

export default function NewCustomerPage() {
  return (
    <div className="max-w-2xl">
      <div className="section-header mb-16">
        <div>
        <Link href="/customers" className="text-xs text-muted hover:text-text">← Back to customers</Link>
        <div className="section-title mt-2">Add new customer</div>
        <div className="section-sub">
          Create a new customer record for sales orders
        </div>
        </div>
      </div>

      <div className="card p-6">
        <form action={createCustomer} className="space-y-6">
          <div>
            <label className="form-label">Customer name <span className="text-red">*</span></label>
            <input
              type="text"
              name="name"
              className="form-input w-full"
              placeholder="Customer name"
              required
            />
          </div>

          <div>
            <label className="form-label">Contact person</label>
            <input type="text" name="contactName" className="form-input w-full" placeholder="Contact person" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Phone number</label>
              <input
                type="tel"
                name="phone"
                className="form-input w-full"
                placeholder="Phone number"
              />
            </div>

            <div>
              <label className="form-label">Email address</label>
              <input
                type="email"
                name="email"
                className="form-input w-full"
                placeholder="Email address"
              />
            </div>
          </div>

          <div>
            <label className="form-label">Tax ID</label>
            <input name="taxId" className="form-input w-full" placeholder="Optional tax identifier" />
          </div>

          <div>
            <label className="form-label">Address</label>
            <textarea
              name="address"
              className="form-input w-full"
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

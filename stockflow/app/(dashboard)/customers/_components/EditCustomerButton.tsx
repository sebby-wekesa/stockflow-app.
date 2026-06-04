"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCustomer } from "../actions";

type CustomerContact = {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxId: string | null;
};

export function EditCustomerButton({
  customer,
  compact = false,
}: {
  customer: CustomerContact;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);

    startTransition(async () => {
      const result = await updateCustomer(customer.id, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        className={`btn btn-ghost${compact ? " btn-sm" : ""}`}
        onClick={() => setOpen(true)}
      >
        Edit customer
      </button>

      {open && (
        <div className="modal-overlay open" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setOpen(false)}>✕</button>
            <div className="modal-title">Edit customer</div>
            <div className="modal-sub">Update customer and contact information.</div>

            {error && (
              <div className="mb-4 p-3 rounded-md bg-red/10 border border-red/30 text-red text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="form-group">
                <label className="form-label">Customer name</label>
                <input name="name" defaultValue={customer.name} className="form-input" required disabled={isPending} />
              </div>

              <div className="form-group">
                <label className="form-label">Contact person</label>
                <input name="contactName" defaultValue={customer.contactName ?? ""} className="form-input" disabled={isPending} />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input name="phone" type="tel" defaultValue={customer.phone ?? ""} className="form-input" disabled={isPending} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input name="email" type="email" defaultValue={customer.email ?? ""} className="form-input" disabled={isPending} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Tax ID</label>
                <input name="taxId" defaultValue={customer.taxId ?? ""} className="form-input" disabled={isPending} />
              </div>

              <div className="form-group">
                <label className="form-label">Address</label>
                <textarea name="address" defaultValue={customer.address ?? ""} className="form-input" rows={3} disabled={isPending} />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={isPending}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isPending}>
                  {isPending ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

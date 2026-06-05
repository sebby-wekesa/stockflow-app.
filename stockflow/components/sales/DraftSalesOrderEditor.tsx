"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteDraftSalesOrder, updateDraftSalesOrder } from "@/actions/sales";
import { formatKES } from "@/lib/sales-utils";

type DraftLine = {
  id: string;
  sku: string;
  description: string;
  quantity: number;
  unitPrice: number;
  piecesSets: number;
};

type EditableLine = {
  id: string;
  sku: string;
  description: string;
  quantity: string;
  unitPrice: string;
  piecesSets: string;
};

export function DraftSalesOrderEditor({
  orderId,
  customerName: initialCustomerName,
  lines: initialLines,
}: {
  orderId: string;
  customerName: string;
  lines: DraftLine[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState(initialCustomerName);
  const [lines, setLines] = useState<EditableLine[]>(
    initialLines.map((line) => ({
      ...line,
      quantity: String(line.quantity),
      unitPrice: String(line.unitPrice),
      piecesSets: String(line.piecesSets),
    }))
  );

  const total = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const unitPrice = Number(line.unitPrice) || 0;
        const piecesSets = Number(line.piecesSets) || 0;
        return sum + unitPrice * piecesSets;
      }, 0),
    [lines]
  );

  function updateLine(index: number, patch: Partial<EditableLine>) {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line))
    );
  }

  function submit(confirmAfterSave: boolean) {
    setError(null);
    const fd = new FormData();
    fd.set("order_id", orderId);
    fd.set("customer_name", customerName);
    fd.set("confirm_after_save", String(confirmAfterSave));
    lines.forEach((line, index) => {
      fd.set(`line_${index}_id`, line.id);
      fd.set(`line_${index}_quantity`, line.quantity);
      fd.set(`line_${index}_unit_price`, line.unitPrice);
      fd.set(`line_${index}_pieces_sets`, line.piecesSets);
    });

    startTransition(async () => {
      const result = await updateDraftSalesOrder(fd);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function deleteDraft() {
    if (!confirm(`Delete draft invoice ${orderId}? This cannot be undone.`)) return;
    setError(null);

    startTransition(async () => {
      const result = await deleteDraftSalesOrder(orderId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.push("/sales");
      router.refresh();
    });
  }

  return (
    <div className="card p-6 mb-6 border-amber/30">
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Edit draft</div>
          <div className="section-sub">Adjust the draft, then send it forward when it is ready</div>
        </div>
        <span className="badge badge-amber">Draft</span>
      </div>

      {error && <div className="design-error mb-16">{error}</div>}

      <div className="form-group mb-16">
        <label className="form-label">Customer</label>
        <input
          className="form-input"
          value={customerName}
          onChange={(event) => setCustomerName(event.target.value)}
        />
      </div>

      <div className="table-wrap mb-16">
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Description</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Sets/pcs</th>
              <th className="text-right">Unit price</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const lineTotal = (Number(line.unitPrice) || 0) * (Number(line.piecesSets) || 0);
              return (
                <tr key={line.id}>
                  <td className="font-mono text-accent">{line.sku}</td>
                  <td>{line.description}</td>
                  <td>
                    <input
                      className="form-input font-mono text-right"
                      type="number"
                      min="1"
                      step="1"
                      value={line.quantity}
                      onChange={(event) => updateLine(index, { quantity: event.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="form-input font-mono text-right"
                      type="number"
                      min="0"
                      step="1"
                      value={line.piecesSets}
                      onChange={(event) => updateLine(index, { piecesSets: event.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="form-input font-mono text-right"
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unitPrice}
                      onChange={(event) => updateLine(index, { unitPrice: event.target.value })}
                    />
                  </td>
                  <td className="text-right font-mono">{formatKES(lineTotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="form-label">Draft total</div>
          <div className="sales-order-total">{formatKES(total)}</div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-ghost text-red"
            disabled={isPending}
            onClick={deleteDraft}
          >
            {isPending ? "Working..." : "Delete draft"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={isPending}
            onClick={() => submit(false)}
          >
            {isPending ? "Saving..." : "Save draft"}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={isPending}
            onClick={() => submit(true)}
          >
            {isPending ? "Sending..." : "Save & send to proceed"}
          </button>
        </div>
      </div>
    </div>
  );
}

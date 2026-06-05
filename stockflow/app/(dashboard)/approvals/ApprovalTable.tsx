"use client";

import { updateOrderStatus } from "@/app/actions/orders";
import { Check, X, Package } from "lucide-react";
import { useState } from "react";

export default function ApprovalTable({ orders }: { orders: any[] }) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleAction = async (id: string, status: "APPROVED" | "REJECTED") => {
    const reason = status === 'REJECTED'
      ? window.prompt('Enter the rejection reason:')
      : undefined;
    if (status === 'REJECTED' && (!reason || reason.trim().length < 3)) {
      alert('A rejection reason of at least 3 characters is required.');
      return;
    }
    const confirmMsg = `Are you sure you want to ${status.toLowerCase()} this order?`;
    if (!window.confirm(confirmMsg)) return;

    setLoadingId(id);
    try {
      const result = await updateOrderStatus(id, status, reason ?? undefined);
      if (!result.success) {
        alert(result.error);
      }
    } catch {
      alert("An unexpected error occurred.");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="card">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Order #</th>
              <th>Design / Product</th>
              <th>Branch</th>
              <th>Quantity</th>
              <th>Target (kg)</th>
              <th>Date</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Package size={14} style={{ color: 'var(--muted)' }} />
                  <span style={{
                    fontWeight: 500,
                    color: 'var(--text)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px'
                  }}>
                    {order.orderNumber}
                  </span>
                </div>
              </td>
              <td style={{ fontWeight: 500, color: 'var(--text)' }}>
                {order.design?.name}
              </td>
              <td>
                <span className="badge badge-blue">
                  Mombasa
                </span>
              </td>
              <td style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 500,
                color: 'var(--text)'
              }}>
                {order.quantity}
              </td>
              <td style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 500,
                color: 'var(--green)'
              }}>
                {Number(order.targetKg).toFixed(2)} kg
              </td>
              <td style={{
                fontSize: '12px',
                color: 'var(--muted)'
              }}>
                {new Date(order.createdAt).toLocaleDateString()}
              </td>
              <td style={{ textAlign: 'right' }}>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => handleAction(order.id, "APPROVED")}
                    disabled={loadingId === order.id}
                    className="btn btn-teal"
                    style={{
                      padding: '6px 10px',
                      fontSize: '12px',
                      opacity: loadingId === order.id ? 0.6 : 1,
                      cursor: loadingId === order.id ? 'not-allowed' : 'pointer'
                    }}
                    title="Approve"
                  >
                    {loadingId === order.id ? (
                      <div style={{
                        width: '14px',
                        height: '14px',
                        border: '1px solid var(--text)',
                        borderTop: '1px solid transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }}></div>
                    ) : (
                      <Check size={14} />
                    )}
                  </button>
                  <button
                    onClick={() => handleAction(order.id, "REJECTED")}
                    disabled={loadingId === order.id}
                    className="btn btn-red"
                    style={{
                      padding: '6px 10px',
                      fontSize: '12px',
                      opacity: loadingId === order.id ? 0.6 : 1,
                      cursor: loadingId === order.id ? 'not-allowed' : 'pointer'
                    }}
                    title="Reject"
                  >
                    <X size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </div>
  );
}

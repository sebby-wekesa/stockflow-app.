"use client";

import { useState, useEffect } from "react";
import { X, ShoppingCart, Ship, Package, DollarSign, Hash, Truck, FileText, CheckCircle, AlertCircle } from "lucide-react";

type Origin = "LOCAL_PURCHASE" | "IMPORTED";
type UOM = "PCS" | "KGS";

interface ProductIntakeModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const MULTIPLIER = 1.25;

export function ProductIntakeModal({ open, onClose, onSuccess }: ProductIntakeModalProps) {
  const [origin, setOrigin] = useState<Origin>("LOCAL_PURCHASE");
  const [name, setName] = useState("");
  const [uom, setUom] = useState<UOM>("PCS");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [landingCost, setLandingCost] = useState("");
  const [vendor, setVendor] = useState("");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Auto-compute landing cost for imported
  // Reset when origin changes
  useEffect(() => {
    if (origin === "LOCAL_PURCHASE") setLandingCost("");
  }, [origin]);

  function resetForm() {
    setName(""); setUom("PCS"); setQuantity("");
    setUnitCost(""); setLandingCost(""); setVendor(""); setReference("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !quantity || parseFloat(quantity) <= 0) {
      setToast({ type: "error", msg: "Item name and a positive quantity are required." });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/inventory/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          origin,
          uom,
          quantity: parseFloat(quantity),
          unitCost: unitCost ? parseFloat(unitCost) : undefined,
          landingCost: origin === "IMPORTED" && landingCost ? parseFloat(landingCost) : undefined,
          vendor: vendor.trim() || undefined,
          reference: reference.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add stock");

      setToast({ type: "success", msg: `Stock received: ${name}` });
      resetForm();
      onSuccess();
      setTimeout(() => { setToast(null); onClose(); }, 1800);
    } catch (err: unknown) {
      setToast({ type: "error", msg: err instanceof Error ? err.message : "An error occurred" });
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  const isImported = origin === "IMPORTED";

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
        zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border2)",
        borderRadius: 16, padding: 32, width: 520, maxHeight: "90vh",
        overflowY: "auto", position: "relative",
        boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        animation: "fadeIn 0.18s ease",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <div style={{ fontFamily: "var(--font-head)", fontSize: 18, fontWeight: 700 }}>
              Receive Stock
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
              Add local purchases or imported goods to inventory
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* Origin toggle */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 24,
          background: "var(--surface2)", borderRadius: 10, padding: 4,
        }}>
          {([
            { val: "LOCAL_PURCHASE" as Origin, label: "Local Purchase", icon: <ShoppingCart size={14} /> },
            { val: "IMPORTED" as Origin,        label: "Imported Goods", icon: <Ship size={14} /> },
          ]).map(({ val, label, icon }) => (
            <button
              key={val}
              type="button"
              onClick={() => setOrigin(val)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "10px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600,
                transition: "all 0.15s",
                background: origin === val
                  ? (val === "IMPORTED" ? "var(--blue)" : "var(--teal)")
                  : "transparent",
                color: origin === val ? (val === "IMPORTED" ? "#fff" : "#000") : "var(--muted)",
              }}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Item name */}
          <div className="form-group">
            <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Package size={12} /> Item Name
            </label>
            <input
              className="form-input"
              placeholder={isImported ? "e.g. M12 Hex Bolts (ISO)" : "e.g. Long Nuts 500mm"}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{ fontSize: 14 }}
            />
          </div>

          {/* Quantity + UOM */}
          <div className="form-row" style={{ gridTemplateColumns: "2fr 1fr" }}>
            <div className="form-group">
              <label className="form-label">
                <Hash size={12} style={{ display: "inline", marginRight: 4 }} />
                Quantity Received
              </label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                style={{ fontFamily: "var(--font-mono)", fontSize: 16 }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">UOM</label>
              <select
                className="form-input"
                value={uom}
                onChange={(e) => setUom(e.target.value as UOM)}
              >
                <option value="PCS">PCS</option>
                <option value="KGS">KGS</option>
              </select>
            </div>
          </div>

          {/* Unit Cost + Landing Cost (imported only) */}
          <div className={`form-row ${isImported ? "" : ""}`} style={{ gridTemplateColumns: isImported ? "1fr 1fr" : "1fr" }}>
            <div className="form-group">
              <label className="form-label">
                <DollarSign size={12} style={{ display: "inline", marginRight: 4 }} />
                Unit Cost (KSh)
              </label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                style={{ fontFamily: "var(--font-mono)" }}
              />
            </div>
            {isImported && (
              <div className="form-group">
                <label className="form-label" style={{ color: "var(--blue)" }}>
                  Landing Cost (×1.25)
                </label>
                <input
                  className="form-input"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Auto-computed"
                  value={landingCost}
                  onChange={(e) => setLandingCost(e.target.value)}
                  style={{
                    fontFamily: "var(--font-mono)",
                    borderColor: "rgba(74,158,255,0.4)",
                    color: "var(--blue)",
                  }}
                />
              </div>
            )}
          </div>

          {/* Vendor */}
          <div className="form-group">
            <label className="form-label">
              <Truck size={12} style={{ display: "inline", marginRight: 4 }} />
              {isImported ? "Importer / Clearing Agent" : "Vendor / Supplier"}
            </label>
            <input
              className="form-input"
              placeholder={isImported ? "e.g. Nairobi Clearing Co." : "e.g. Jua Kali Supplies Ltd"}
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
            />
          </div>

          {/* GRN Reference */}
          <div className="form-group">
            <label className="form-label">
              <FileText size={12} style={{ display: "inline", marginRight: 4 }} />
              GRN / Invoice Reference
            </label>
            <input
              className="form-input"
              placeholder="e.g. GRN-2026-0041"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>

          {/* Toast */}
          {toast && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
              borderRadius: 8, fontSize: 13,
              background: toast.type === "success"
                ? "rgba(76,175,125,0.15)" : "rgba(224,85,85,0.15)",
              border: `1px solid ${toast.type === "success" ? "rgba(76,175,125,0.4)" : "rgba(224,85,85,0.4)"}`,
              color: toast.type === "success" ? "var(--green)" : "var(--red)",
            }}>
              {toast.type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              {toast.msg}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4,
              padding: "14px 20px",
              borderRadius: 10, border: "none", cursor: loading ? "not-allowed" : "pointer",
              background: isImported ? "var(--blue)" : "var(--teal)",
              color: isImported ? "#fff" : "#000",
              fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              opacity: loading ? 0.7 : 1,
              transition: "all 0.15s",
            }}
          >
            {loading ? "Saving…" : `Add to Inventory — ${isImported ? "Imported" : "Local Purchase"}`}
          </button>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";

export default function ReceivePage() {
  const [materialName, setMaterialName] = useState("Steel rod 16mm");
  const [diameter, setDiameter] = useState("16mm");
  const [kgReceived, setKgReceived] = useState("");
  const [supplier, setSupplier] = useState("Steel Masters Ltd");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    try {
      const response = await fetch("/api/inventory/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialName,
          diameter,
          kgReceived: parseFloat(kgReceived),
          supplier,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setMessage(result.message);
        // Reset form
        setKgReceived("");
        setReference("");
        setNotes("");
      } else {
        setMessage(result.error || "Failed to log stock");
      }
    } catch (error) {
      setMessage("Network error: Could not log stock");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="section-header mb-16">
        <div><div className="section-title">Receive raw materials</div><div className="section-sub">Log incoming stock into warehouse</div></div>
      </div>
      <div className="card" style={{maxWidth:'560px'}}>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Material type</label>
              <select
                className="form-input"
                value={materialName}
                onChange={(e) => {
                  setMaterialName(e.target.value);
                  // Auto-set diameter based on material
                  if (e.target.value.includes("16mm")) setDiameter("16mm");
                  else if (e.target.value.includes("20mm")) setDiameter("20mm");
                  else if (e.target.value.includes("25mm")) setDiameter("25mm");
                }}
              >
                <option>Steel rod 16mm</option>
                <option>Steel rod 20mm</option>
                <option>Steel rod 25mm</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Quantity (kg)</label>
              <input
                type="number"
                className="form-input"
                placeholder="e.g. 200"
                value={kgReceived}
                onChange={(e) => setKgReceived(e.target.value)}
                required
                min="0.01"
                step="0.01"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">GRN / Reference</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. GRN-2242"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Supplier</label>
              <select
                className="form-input"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
              >
                <option>Steel Masters Ltd</option>
                <option>KenSteel Supply</option>
              </select>
            </div>
          </div>
          <div className="form-group mb-16">
            <label className="form-label">Notes</label>
            <input
              type="text"
              className="form-input"
              placeholder="Optional"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Logging..." : "Confirm receipt"}
          </button>
          {message && <p className="mt-4 text-sm">{message}</p>}
        </form>
      </div>
    </div>
  );
}
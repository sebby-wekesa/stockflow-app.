"use client";

import { useState } from "react";
import { RAW_MATERIAL_CATEGORIES, type RawMaterialCategory } from "@/lib/raw-materials";

export default function ReceivePage() {
  const [category, setCategory] = useState<RawMaterialCategory>("Flat Bars");
  const [materialName, setMaterialName] = useState("");
  const [diameter, setDiameter] = useState("");
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [kgReceived, setKgReceived] = useState("");
  const [piecesReceived, setPiecesReceived] = useState("");
  const [supplier, setSupplier] = useState("");
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
          category,
          diameter,
          length,
          width,
          height,
          kgReceived: parseFloat(kgReceived),
          piecesReceived: Number(piecesReceived),
          supplier,
          reference,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setMessage(result.message);
        // Reset form
        setKgReceived("");
        setPiecesReceived("");
        setLength("");
        setWidth("");
        setHeight("");
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
              <label className="form-label">Category</label>
              <select
                className="form-input"
                value={category}
                onChange={(e) => setCategory(e.target.value as RawMaterialCategory)}
                required
              >
                {RAW_MATERIAL_CATEGORIES.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Material type</label>
              <input
                type="text"
                className="form-input"
                list="material-types"
                value={materialName}
                onChange={(e) => setMaterialName(e.target.value)}
                placeholder="Material type from inventory"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Quantity (kg)</label>
              <input
                type="number"
                className="form-input"
                placeholder="0.00"
                value={kgReceived}
                onChange={(e) => setKgReceived(e.target.value)}
                required
                min="0.01"
                step="0.01"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Amount (pieces)</label>
              <input
                type="number"
                className="form-input"
                placeholder="0"
                value={piecesReceived}
                onChange={(e) => setPiecesReceived(e.target.value)}
                required
                min="1"
                step="1"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Length</label>
              <input
                type="text"
                className="form-input"
                placeholder="Length"
                value={length}
                onChange={(e) => setLength(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Width / Diameter</label>
              <input
                type="text"
                className="form-input"
                placeholder="Width or diameter"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Height</label>
              <input
                type="text"
                className="form-input"
                placeholder="Height"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">GRN / Reference</label>
              <input
                type="text"
                className="form-input"
                placeholder="GRN or reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Supplier</label>
              <input
                type="text"
                className="form-input"
                list="suppliers"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Supplier from database"
              />
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

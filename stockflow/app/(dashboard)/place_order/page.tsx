"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Package, Plus, Trash2 } from "lucide-react";
import { CreateProductionOrderForm } from "@/components/CreateProductionOrderForm";
import { useToast } from "@/components/Toast";
import { Design } from "@/types";

type RawMaterialOption = {
  id: string;
  materialName: string;
  diameter: string;
  width: string;
  height: string;
  length: string;
  availableKg: number | string;
  availablePieces: number;
};

type MaterialLine = {
  rawMaterialId: string;
  cutLength: string;
  pieces: string;
  totalLength: string;
};

const emptyLine = (): MaterialLine => ({
  rawMaterialId: "",
  cutLength: "",
  pieces: "1",
  totalLength: "",
});

function materialLabel(material: RawMaterialOption) {
  const size = [material.width, material.height, material.diameter, material.length]
    .filter(Boolean)
    .join("x");
  return `${size ? `${size} - ` : ""}${material.materialName}`;
}

export default function PlaceOrderPage() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<"quick" | "template">("quick");
  const [designs, setDesigns] = useState<Design[]>([]);
  const [materials, setMaterials] = useState<RawMaterialOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productName, setProductName] = useState("");
  const [expectedPieces, setExpectedPieces] = useState("15");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [lines, setLines] = useState<MaterialLine[]>([emptyLine()]);

  useEffect(() => {
    async function load() {
      try {
        const [designResponse, materialResponse] = await Promise.all([
          fetch("/api/designs"),
          fetch("/api/inventory/materials"),
        ]);

        if (designResponse.ok) {
          const designsData = await designResponse.json();
          setDesigns(Array.isArray(designsData) ? designsData : []);
        }

        if (materialResponse.ok) {
          const materialData = await materialResponse.json();
          setMaterials(Array.isArray(materialData.data) ? materialData.data : []);
        }
      } catch (error) {
        console.error("Error loading order data:", error);
        showToast("Could not load order data", "error");
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [showToast]);

  const canSubmit = useMemo(() => {
    return (
      productName.trim().length >= 2 &&
      Number(expectedPieces) > 0 &&
      lines.length > 0 &&
      lines.every((line) => line.rawMaterialId && Number(line.pieces) > 0)
    );
  }, [expectedPieces, lines, productName]);

  function updateLine(index: number, patch: Partial<MaterialLine>) {
    setLines((current) =>
      current.map((line, i) => {
        if (i !== index) return line;
        const next = { ...line, ...patch };
        if ("cutLength" in patch || "pieces" in patch) {
          const cutLength = Number(next.cutLength);
          const pieces = Number(next.pieces);
          if (cutLength > 0 && pieces > 0) {
            next.totalLength = String(cutLength * pieces);
          }
        }
        return next;
      })
    );
  }

  async function submitQuickOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/production-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType: "direct",
          productName,
          expectedPieces: Number(expectedPieces),
          priority,
          initialWeight: 0.0001,
          materialLines: lines.map((line) => ({
            rawMaterialId: line.rawMaterialId,
            cutLength: line.cutLength === "" ? null : Number(line.cutLength),
            pieces: Number(line.pieces),
            totalLength: line.totalLength === "" ? null : Number(line.totalLength),
          })),
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to create quick order");
      }

      showToast(payload?.message || "Quick production order created", "success");
      setProductName("");
      setExpectedPieces("15");
      setPriority("MEDIUM");
      setLines([emptyLine()]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to create quick order", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="dashboard-content">
      <div className="section-header">
        <div>
          <h1>Place Production Order</h1>
          <div className="section-sub">Create direct production orders or use a saved design template</div>
        </div>
        <div className="badge badge-amber">
          <Package size={14} /> New order
        </div>
      </div>

      <div className="card">
        <div className="flex gap-2 mb-16">
          <button
            type="button"
            className={`btn ${activeTab === "quick" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setActiveTab("quick")}
          >
            Quick order
          </button>
          <button
            type="button"
            className={`btn ${activeTab === "template" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setActiveTab("template")}
          >
            From saved template
          </button>
        </div>

        {activeTab === "quick" ? (
          <form onSubmit={submitQuickOrder} className="space-y-4">
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Product name</label>
                <input
                  className="form-input"
                  value={productName}
                  onChange={(event) => setProductName(event.target.value)}
                  placeholder="Hilux rear spring leaf"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Expected finished pieces</label>
                <input
                  className="form-input"
                  type="number"
                  min="1"
                  step="1"
                  value={expectedPieces}
                  onChange={(event) => setExpectedPieces(event.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Priority</label>
              <div className="flex gap-2">
                {(["LOW", "MEDIUM", "HIGH"] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={`btn ${priority === level ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => setPriority(level)}
                  >
                    {level.charAt(0) + level.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="section-header mb-16">
              <div>
                <div className="section-title">Material lines</div>
                <div className="section-sub">Pick stock, enter cut length and pieces, then adjust total length when offcuts apply</div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setLines((current) => [...current, emptyLine()])}
              >
                <Plus size={14} /> Add material
              </button>
            </div>

            <div className="space-y-3">
              {lines.map((line, index) => (
                <div key={index} className="card-sm">
                  <div className="grid-4" style={{ gap: "10px", alignItems: "end" }}>
                    <div className="form-group">
                      <label className="form-label">Raw material</label>
                      <select
                        className="form-input"
                        value={line.rawMaterialId}
                        onChange={(event) => updateLine(index, { rawMaterialId: event.target.value })}
                      >
                        <option value="">Pick material...</option>
                        {materials.map((material) => (
                          <option key={material.id} value={material.id}>
                            {materialLabel(material)} ({Number(material.availableKg).toFixed(1)} kg)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Cut length</label>
                      <input
                        className="form-input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.cutLength}
                        onChange={(event) => updateLine(index, { cutLength: event.target.value })}
                        placeholder="70"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Pieces</label>
                      <input
                        className="form-input"
                        type="number"
                        min="1"
                        step="1"
                        value={line.pieces}
                        onChange={(event) => updateLine(index, { pieces: event.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Total length</label>
                      <div className="flex gap-2">
                        <input
                          className="form-input"
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.totalLength}
                          onChange={(event) => updateLine(index, { totalLength: event.target.value })}
                          placeholder="210"
                        />
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                          disabled={lines.length === 1}
                          aria-label="Remove material line"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={!canSubmit || isSubmitting || isLoading}
            >
              {isSubmitting ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Package size={16} />}
              {isSubmitting ? "Creating..." : "Create quick order"}
            </button>
          </form>
        ) : isLoading ? (
          <div className="p-8 text-center text-muted">Loading designs...</div>
        ) : designs.length === 0 ? (
          <div className="p-8 text-center text-muted">No saved design templates found.</div>
        ) : (
          <CreateProductionOrderForm designs={designs} />
        )}
      </div>
    </div>
  );
}

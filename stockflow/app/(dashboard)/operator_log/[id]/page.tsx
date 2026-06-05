"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";

import { useToast } from "@/components/Toast";
import { recordProductionOutput } from "@/app/actions/production";

export default function OperatorLogPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const { showToast } = useToast();
  
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [kgOut, setKgOut] = useState<number>(0);
  const [kgScrap, setKgScrap] = useState<number>(0);
  const [piecesOut, setPiecesOut] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [materialLineId, setMaterialLineId] = useState("");
  const [weightIn, setWeightIn] = useState("");
  const [actualPieces, setActualPieces] = useState("");
  const [actualWeightOut, setActualWeightOut] = useState("");
  const [outputResult, setOutputResult] = useState<null | { efficiency: number; actualPieces: number; expectedPieces: number }>(null);

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const response = await fetch(`/api/production-orders/${id}`);
        if (!response.ok) throw new Error("Failed to fetch");
        const data = await response.json();
        setOrder(data);
      } catch (e) {
        console.error(e);
        showToast("Order not found", "error");
        router.push("/operator_queue");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, router, showToast]);

  const inheritedKg = order?.inheritedKg || 0;
  const inheritedPieces = order?.StageLog?.[0]?.piecesOut ?? order?.quantity ?? 0;
  
  const isValid = useMemo(() => {
    const total = Number(kgOut) + Number(kgScrap);
    const parsedPiecesOut = Number(piecesOut);
    const hasValidPiecesOut =
      piecesOut.trim() !== "" &&
      Number.isInteger(parsedPiecesOut) &&
      parsedPiecesOut >= 0;
    return Math.abs(total - inheritedKg) < 0.01 && kgOut > 0 && hasValidPiecesOut;
  }, [kgOut, kgScrap, inheritedKg, piecesOut]);

  const submitStage = async () => {
    if (!isValid || isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      const resp = await fetch("/api/production/log-stage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: id,
          stageId: order.design.stages.find((s: any) => s.sequence === order.currentStage)?.id,
          kgIn: inheritedKg,
          kgOut,
          kgScrap,
          piecesIn: inheritedPieces,
          piecesOut: Number(piecesOut),
          department: order.currentDept,
        }),
      });

      if (resp.ok) {
        showToast("Stage completed successfully", "success");
        router.push("/operator_queue");
      } else {
        const err = await resp.json();
        showToast(err.error || "Failed to complete stage", "error");
      }
    } catch (e) {
      showToast("Network error", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-[#7a8090] animate-pulse">Loading order details...</div>;
  if (!order) return null;

  const isDirectOrder = !order.design;

  const submitDirectOutput = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const result = await recordProductionOutput({
        orderId: id,
        materialLineId: materialLineId || undefined,
        weightIn: Number(weightIn),
        actualPieces: Number(actualPieces),
        actualWeightOut: actualWeightOut === "" ? null : Number(actualWeightOut),
      });
      setOutputResult(result);
      showToast(`Output recorded at ${result.efficiency}% efficiency`, "success");
      setTimeout(() => router.push("/operator_queue"), 900);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to record production output", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isDirectOrder) {
    const selectedMaterial = order.materials?.find((line: any) => line.id === materialLineId) ?? order.materials?.[0];
    const canRecordOutput =
      Number(weightIn) > 0 &&
      Number.isInteger(Number(actualPieces)) &&
      Number(actualPieces) > 0 &&
      (order.materials?.length <= 1 || Boolean(materialLineId)) &&
      !order.outputRecordedAt;

    return (
      <div>
        <div className="section-header mb-16">
          <div>
            <div className="section-title">Record production output</div>
            <div className="section-sub">{order.orderNumber} · {order.productName || "Direct order"} · expected {order.expectedPieces || order.quantity} pieces</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => router.push("/operator_queue")}>Back to queue</button>
        </div>

        <div className="card mb-16">
          <div className="section-header mb-16">
            <div>
              <div className="section-title">{order.productName || "Direct order"}</div>
              <div className="section-sub">Material is consumed when this output is saved</div>
            </div>
            <span className={`badge ${order.outputRecordedAt ? "badge-green" : "badge-amber"}`}>
              {order.outputRecordedAt ? "Recorded" : order.priority}
            </span>
          </div>

          <div className="grid-3">
            <div className="card-sm">
              <div className="stat-label">Expected pieces</div>
              <div className="stat-value">{order.expectedPieces || order.quantity}</div>
            </div>
            <div className="card-sm">
              <div className="stat-label">Material options</div>
              <div className="stat-value">{order.materials?.length || 0}</div>
            </div>
            <div className="card-sm">
              <div className="stat-label">Current department</div>
              <div className="stat-sub">{order.currentDept || "Production"}</div>
            </div>
          </div>
        </div>

        <div className="log-form">
          <div style={{fontSize:'13px',fontWeight:'600',marginBottom:'4px'}}>Production output</div>
          <div style={{fontSize:'12px',color:'var(--muted)',marginBottom:'14px'}}>
            Enter the actual material weight used and finished pieces produced.
          </div>

          {order.materials?.length > 1 && (
            <div className="kg-input-group" style={{ textAlign: "left", marginBottom: "12px" }}>
              <label>Material consumed</label>
              <select
                className="form-input"
                value={materialLineId}
                onChange={(event) => setMaterialLineId(event.target.value)}
              >
                <option value="">Choose material...</option>
                {order.materials.map((line: any) => (
                  <option key={line.id} value={line.id}>
                    {line.RawMaterial.materialName} {line.RawMaterial.width || line.RawMaterial.diameter || ""}x{line.RawMaterial.height || line.RawMaterial.length || ""} · {line.pieces} pcs · {line.weightKg ?? "no"} kg planned
                  </option>
                ))}
              </select>
            </div>
          )}

          {order.materials?.length === 1 && selectedMaterial && (
            <div className="card-sm mb-16">
              <strong>{selectedMaterial.RawMaterial.materialName}</strong>
              <div className="section-sub">
                {selectedMaterial.pieces} pcs planned · {selectedMaterial.weightKg ?? "no"} kg planned · {selectedMaterial.totalLength ?? "no"} total length · {selectedMaterial.RawMaterial.availableKg.toFixed(2)} kg and {selectedMaterial.RawMaterial.availablePieces} pcs available
              </div>
            </div>
          )}

          <div className="kg-inputs">
            <div className="kg-input-group">
              <label>Weight in consumed</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={weightIn}
                onChange={(event) => setWeightIn(event.target.value)}
                disabled={Boolean(order.outputRecordedAt)}
              />
            </div>
            <div className="kg-input-group output">
              <label>Actual finished pieces</label>
              <input
                type="number"
                min="1"
                step="1"
                value={actualPieces}
                onChange={(event) => setActualPieces(event.target.value)}
                disabled={Boolean(order.outputRecordedAt)}
              />
            </div>
            <div className="kg-input-group">
              <label>Weight out optional</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={actualWeightOut}
                onChange={(event) => setActualWeightOut(event.target.value)}
                disabled={Boolean(order.outputRecordedAt)}
              />
            </div>
          </div>

          <div className={`kg-balance ${outputResult ? "valid" : ""}`}>
            {outputResult
              ? `Recorded - ${outputResult.actualPieces} of ${outputResult.expectedPieces} pieces = ${outputResult.efficiency}% efficiency`
              : order.outputRecordedAt
                ? "Production output has already been recorded for this order"
                : "Raw stock will be decremented only when you save this output"}
          </div>

          <div style={{marginTop:'14px',display:'flex',gap:'10px'}}>
            <button
              className="btn btn-primary"
              disabled={!canRecordOutput || isSubmitting}
              onClick={submitDirectOutput}
            >
              {isSubmitting ? "Saving..." : "Record output and consume material"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentStageInfo = order.design.stages.find((s: any) => s.sequence === order.currentStage);
  const nextStageInfo = order.design.stages.find((s: any) => s.sequence === order.currentStage + 1);

  return (
    <div>
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Log stage output</div>
          <div className="section-sub">{order.orderNumber} · {order.design.name} · {order.currentDept} stage</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => router.push("/operator_queue")}>← Back to queue</button>
      </div>

      <div className="card mb-16">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'14px'}}>
          <div>
            <div style={{fontSize:'11px',color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.5px'}}>Job details</div>
            <div style={{fontFamily:'var(--font-head)',fontSize:'17px',fontWeight:'700',marginTop:'4px'}}>
              {order.design.name} — {currentStageInfo?.name}
            </div>
          </div>
          <span className={`badge ${order.priority === 'URGENT' ? 'badge-red' : 'badge-amber'}`}>{order.priority}</span>
        </div>

        <div className="grid-3" style={{gap:'10px',marginBottom:'14px'}}>
          <div className="card-sm">
            <div style={{fontSize:'10px',color:'var(--muted)'}}>KG RECEIVED</div>
            <div style={{fontFamily:'var(--font-mono)',fontSize:'18px',color:'var(--accent)',marginTop:'4px'}}>{inheritedKg} kg</div>
          </div>
          <div className="card-sm">
            <div style={{fontSize:'10px',color:'var(--muted)'}}>PIECES/SETS IN</div>
            <div style={{fontFamily:'var(--font-mono)',fontSize:'18px',color:'var(--teal)',marginTop:'4px'}}>{inheritedPieces}</div>
          </div>
          <div className="card-sm">
            <div style={{fontSize:'10px',color:'var(--muted)'}}>TARGET DIMS</div>
            <div style={{fontSize:'13px',marginTop:'4px'}}>{order.design.targetDimensions || order.design.targetDim || "Standard"}</div>
          </div>
        </div>

        <div className="grid-3" style={{gap:'10px',marginBottom:'14px'}}>
          <div className="card-sm">
            <div style={{fontSize:'10px',color:'var(--muted)'}}>NEXT DEPT</div>
            <div style={{fontSize:'13px',marginTop:'4px',color:'var(--purple)'}}>{nextStageInfo?.department || "Finished Goods"}</div>
          </div>
        </div>

        <div style={{fontSize:'10px',color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'8px'}}>Stage progress</div>
        <div className="kg-trail">
          <div className="kg-stage done">
            <div className="kg-stage-name">Received</div>
            <div className="kg-stage-val">{inheritedKg} kg · {inheritedPieces} pcs/sets</div>
          </div>
          <div className="kg-arrow">→</div>
          <div className="kg-stage active">
            <div className="kg-stage-name">{currentStageInfo?.name}</div>
            <div className="kg-stage-val">{kgOut || "—"} kg · {piecesOut || "—"} pcs/sets</div>
          </div>
          <div className="kg-arrow">→</div>
          <div className="kg-stage">
            <div className="kg-stage-name">{nextStageInfo?.name || "Done"}</div>
            <div className="kg-stage-val">—</div>
          </div>
        </div>
      </div>

      <div className="log-form">
        <div style={{fontSize:'13px',fontWeight:'600',marginBottom:'4px'}}>Record {currentStageInfo?.name?.toLowerCase()} output</div>
        <div style={{fontSize:'12px',color:'var(--muted)',marginBottom:'14px'}}>Kg in must equal kg passed forward + kg scrap. Pieces/sets are saved for traceability.</div>
        
        <div className="kg-inputs">
          <div className="kg-input-group">
            <label>Kg in (received)</label>
            <input type="number" value={inheritedKg} readOnly style={{opacity:'0.6'}}/>
          </div>
          <div className="kg-input-group output">
            <label>Kg out (to {nextStageInfo?.department || "Next"})</label>
            <input 
              type="number" 
              placeholder="0" 
              value={kgOut || ""}
              onChange={(e) => setKgOut(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="kg-input-group scrap">
            <label>Kg scrap</label>
            <input 
              type="number" 
              placeholder="0" 
              value={kgScrap || ""}
              onChange={(e) => setKgScrap(parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>

        <div className="kg-inputs" style={{marginTop:'12px'}}>
          <div className="kg-input-group">
            <label>Pieces/sets in</label>
            <input type="number" value={inheritedPieces} readOnly style={{opacity:'0.6'}}/>
          </div>
          <div className="kg-input-group output">
            <label>Pieces/sets out (to {nextStageInfo?.department || "Next"})</label>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="0"
              value={piecesOut}
              onChange={(e) => setPiecesOut(e.target.value)}
            />
          </div>
          <div className="kg-input-group">
            <label>Pieces/sets difference</label>
            <input
              type="text"
              value={piecesOut.trim() === "" ? "—" : String(inheritedPieces - Number(piecesOut))}
              readOnly
              style={{opacity:'0.6'}}
            />
          </div>
        </div>

        <div className={`kg-balance ${!kgOut && !kgScrap ? "" : isValid ? "valid" : "invalid"}`}>
          {!kgOut && !kgScrap ? "Enter kg out, kg scrap, and pieces/sets out to verify balance" : 
           isValid ? `Balanced - ${kgOut} kg forward + ${kgScrap} kg scrap = ${inheritedKg} kg` : 
           `Mismatch - ${kgOut} + ${kgScrap} = ${parseFloat((kgOut + kgScrap).toFixed(2))} kg (expected ${inheritedKg} kg), and pieces/sets out is required`}
        </div>

        <div style={{marginTop:'14px',display:'flex',gap:'10px'}}>
          <button 
            className="btn btn-primary" 
            disabled={!isValid || isSubmitting}
            onClick={submitStage}
          >
            {isSubmitting ? "Processing..." : `Mark stage complete → send to ${nextStageInfo?.department || "Finished Goods"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";

import { useToast } from "@/components/Toast";

export default function OperatorLogPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const { showToast } = useToast();
  
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [kgOut, setKgOut] = useState<number>(0);
  const [kgScrap, setKgScrap] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  
  const isValid = useMemo(() => {
    const total = Number(kgOut) + Number(kgScrap);
    return Math.abs(total - inheritedKg) < 0.01 && kgOut > 0;
  }, [kgOut, kgScrap, inheritedKg]);

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
            <div style={{fontSize:'10px',color:'var(--muted)'}}>TARGET DIMS</div>
            <div style={{fontSize:'13px',marginTop:'4px'}}>{order.design.targetDimensions || order.design.targetDim || "Standard"}</div>
          </div>
          <div className="card-sm">
            <div style={{fontSize:'10px',color:'var(--muted)'}}>NEXT DEPT</div>
            <div style={{fontSize:'13px',marginTop:'4px',color:'var(--purple)'}}>{nextStageInfo?.department || "Finished Goods"}</div>
          </div>
        </div>

        <div style={{fontSize:'10px',color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'8px'}}>Stage progress</div>
        <div className="kg-trail">
          <div className="kg-stage done">
            <div className="kg-stage-name">Received</div>
            <div className="kg-stage-val">{inheritedKg} kg</div>
          </div>
          <div className="kg-arrow">→</div>
          <div className="kg-stage active">
            <div className="kg-stage-name">{currentStageInfo?.name}</div>
            <div className="kg-stage-val">{kgOut || "—"} kg</div>
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
        <div style={{fontSize:'12px',color:'var(--muted)',marginBottom:'14px'}}>Kg in must equal kg passed forward + kg scrap</div>
        
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

        <div className={`kg-balance ${!kgOut && !kgScrap ? "" : isValid ? "valid" : "invalid"}`}>
          {!kgOut && !kgScrap ? "Enter kg out and scrap to verify balance" : 
           isValid ? `✓ Balanced — ${kgOut} kg forward + ${kgScrap} kg scrap = ${inheritedKg} kg` : 
           `✗ Mismatch — ${kgOut} + ${kgScrap} = ${parseFloat((kgOut + kgScrap).toFixed(2))} kg (expected ${inheritedKg} kg)`}
        </div>

        <div style={{marginTop:'14px',display:'flex',gap:'10px'}}>
          <button 
            className="btn btn-primary" 
            disabled={!isValid || isSubmitting}
            onClick={submitStage}
          >
            {isSubmitting ? "Processing..." : `Mark stage complete → send to ${nextStageInfo?.department || "Finished Goods"}`}
          </button>
          <button className="btn btn-ghost" disabled={isSubmitting}>Save draft</button>
        </div>
      </div>
    </div>
  );
}
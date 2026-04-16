"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";

export default function DesignsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const designs = [
    {name:'Hex bolt M12',code:'HB-M12',stages:['Cut','Forge','Thread','Plate'],dims:'M12 × 60mm',yield:'88%',mat:'Steel rod 16mm'},
    {name:'Stud rod 8mm',code:'SR-08',stages:['Cut','Thread','Lock'],dims:'8mm × 120mm',yield:'93%',mat:'Steel rod 10mm'},
    {name:'Anchor bolt',code:'AB-16',stages:['Cut','Forge','Chamfer','Thread','Drill','Plate'],dims:'M16 × 150mm',yield:'82%',mat:'Steel rod 20mm'},
    {name:'Hex bolt M10',code:'HB-M10',stages:['Cut','Thread','Plate'],dims:'M10 × 50mm',yield:'91%',mat:'Steel rod 14mm'},
    {name:'Foundation bolt',code:'FB-20',stages:['Cut','Forge','Thread','Lock','Plate'],dims:'M20 × 200mm',yield:'85%',mat:'Steel rod 25mm'},
    {name:'Machine screw',code:'MS-06',stages:['Cut','Chamfer','Thread','Grind'],dims:'M6 × 30mm',yield:'95%',mat:'Steel rod 8mm'},
  ];

  return (
    <div>
      <div className="section-header mb-16">
        <div><div className="section-title">Design templates</div><div className="section-sub">Standardised product designs with process stages and dimensions</div></div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>+ New design</button>
      </div>
      <div className="grid-3 mb-24">
        {designs.map(d => (
          <div className="card" style={{cursor:'pointer'}} onClick={() => alert('View design modal')}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'10px'}}>
              <div>
                <div style={{fontFamily:'var(--font-head)',fontSize:'15px',fontWeight:'700'}}>{d.name}</div>
                <div style={{fontFamily:'var(--font-mono)',fontSize:'11px',color:'var(--muted)',marginTop:'2px'}}>{d.code}</div>
              </div>
              <span className="badge badge-green">{d.yield} yield</span>
            </div>
            <div style={{fontSize:'11px',color:'var(--muted)',marginBottom:'8px'}}>Material: {d.mat}</div>
            <div style={{fontSize:'11px',color:'var(--muted)',marginBottom:'10px'}}>Dims: {d.dims}</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:'4px'}}>
              {d.stages.map((s,i) => <span style={{background:'rgba(139,124,248,0.12)',color:'var(--purple)',fontSize:'10px',padding:'2px 7px',borderRadius:'10px',fontWeight:'500'}}>{i+1}. {s}</span>)}
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}>
        <div>
          <div className="modal-title">New design template</div>
          <div className="modal-sub">Define process stages, dimensions and expected yield</div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Design name</label><input className="form-input" placeholder="e.g. Hex bolt M14"/></div>
            <div className="form-group"><label className="form-label">Design code</label><input className="form-input" placeholder="e.g. HB-M14"/></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Raw material</label><select className="form-input"><option>Steel rod 16mm</option><option>Steel rod 20mm</option><option>Steel rod 25mm</option></select></div>
            <div className="form-group"><label className="form-label">Target dimensions</label><input className="form-input" placeholder="e.g. M14 × 70mm"/></div>
          </div>
          <div className="form-group" style={{marginBottom:'10px'}}><label className="form-label">Select process stages (in order)</label></div>
          <div className="stage-builder" id="stage-builder">
            {['Cutting','Chamfering','Forging','Skimming','Threading','Locking','Electroplating','Drilling','Grinding'].map((s,i) => (
              <div key={i} className="stage-chip off" id={`chip-${i}`} onClick={() => toggleChip(i,s)}>
                <span className="chip-num" id={`cn-${i}`}>·</span>{s}
              </div>
            ))}
          </div>
          <div className="form-row" style={{marginTop:'14px'}}>
            <div className="form-group"><label className="form-label">Expected yield (%)</label><input className="form-input" type="number" placeholder="e.g. 88"/></div>
            <div className="form-group"><label className="form-label">Kg per finished unit</label><input className="form-input" type="number" placeholder="e.g. 2.83"/></div>
          </div>
          <button className="btn btn-primary" style={{marginTop:'6px'}} onClick={() => { alert('Design saved'); setModalOpen(false); }}>Save design</button>
        </div>
      </Modal>
    </div>
  );
}

function toggleChip(i: number, name: string) {
  // Simplified, not implementing full logic
  alert(`Toggled ${name}`);
}
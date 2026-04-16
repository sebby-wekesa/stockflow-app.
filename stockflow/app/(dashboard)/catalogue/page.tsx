"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";

export default function CataloguePage() {
  const [modalOpen, setModalOpen] = useState(false);
  const products = [
    {name:'Hex bolt M12',code:'HB-M12',kg:340,units:120,desc:'M12 × 60mm · Hot-dip galvanised'},
    {name:'Stud rod 8mm',code:'SR-08',kg:180,units:65,desc:'8mm × 120mm · Plain finish'},
    {name:'Anchor bolt',code:'AB-16',kg:520,units:62,desc:'M16 × 150mm · Zinc plated'},
    {name:'Hex bolt M10',code:'HB-M10',kg:95,units:45,desc:'M10 × 50mm · Hot-dip galvanised'},
    {name:'Foundation bolt',code:'FB-20',kg:205,units:30,desc:'M20 × 200mm · Zinc plated'},
  ];

  return (
    <div>
      <div className="section-header mb-16">
        <div><div className="section-title">Available stock</div><div className="section-sub">Finished goods ready to order</div></div>
      </div>
      <div className="product-grid">
        {products.map(p => (
          <div className="product-card" onClick={() => alert('Place order modal')}>
            <div className="product-name">{p.name}</div>
            <div className="product-code">{p.code}</div>
            <div style={{fontSize:'12px',color:'var(--muted)'}}>{p.desc}</div>
            <div className="product-stock">
              <div><div className="product-kg">{p.kg} kg</div><div className="product-unit">{p.units} units in stock</div></div>
              <button className="btn btn-teal btn-sm" onClick={() => setModalOpen(true)}>Order</button>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}>
        <div>
          <div className="modal-title">Place sale order</div>
          <div className="modal-sub">Hex bolt M12 — 120 units / 340 kg available</div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Quantity (units)</label><input className="form-input" type="number" placeholder="max 120"/></div>
            <div className="form-group"><label className="form-label">Client</label><input className="form-input" placeholder="Client name"/></div>
          </div>
          <div className="form-group mb-16"><label className="form-label">Notes</label><input className="form-input" placeholder="Optional delivery notes"/></div>
          <button className="btn btn-teal" onClick={() => { alert('Order placed — sent to packaging queue'); setModalOpen(false); }}>Place order → packaging</button>
        </div>
      </Modal>
    </div>
  );
}
"use client";

function Modal({ isOpen, onClose, children }: { isOpen: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!isOpen) return null
  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        {children}
      </div>
    </div>
  )
}

export function NewOrderModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div>
        <div className="modal-title">New production order</div>
        <div className="modal-sub">Select a design to auto-fill the process stages</div>
        <div className="form-group mb-16">
          <label className="form-label">Design template</label>
          <select className="form-input">
            <option>Hex bolt M12</option>
            <option>Stud rod 8mm</option>
            <option>Anchor bolt</option>
          </select>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Quantity (units)</label>
            <input className="form-input" type="number" placeholder="e.g. 500" />
          </div>
          <div className="form-group">
            <label className="form-label">Kg to reserve</label>
            <input className="form-input" type="number" placeholder="Auto-calculated" />
          </div>
        </div>
        <div className="form-group mb-16">
          <label className="form-label">Client / reference</label>
          <input className="form-input" type="text" placeholder="e.g. Apex Hardware" />
        </div>
        <div style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'12px',marginBottom:'16px'}}>
          <div style={{fontSize:'11px',color:'var(--muted)',marginBottom:'6px',textTransform:'uppercase',letterSpacing:'0.5px'}}>Process stages (from design)</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:'4px'}}>
            {['1. Cut','2. Forge','3. Thread','4. Electroplate'].map(s => (
              <span key={s} style={{background:'rgba(139,124,248,0.12)',color:'var(--purple)',fontSize:'11px',padding:'3px 8px',borderRadius:'10px'}}>
                {s}
              </span>
            ))}
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => { alert('Order created — sent to manager for approval'); onClose(); }}>
          Create order → send for approval
        </button>
      </div>
    </Modal>
  )
}
"use client";

export default function OperatorLogPage() {
  return (
    <div>
      <div className="section-header mb-16">
        <div><div className="section-title">Log stage output</div><div className="section-sub">PO-0040 · Stud rod 8mm · Cutting stage</div></div>
        <button className="btn btn-ghost btn-sm">← Back to queue</button>
      </div>
      <div className="card mb-16">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'14px'}}>
          <div>
            <div style={{fontSize:'11px',color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.5px'}}>Job details</div>
            <div style={{fontFamily:'var(--font-head)',fontSize:'17px',fontWeight:'700',marginTop:'4px'}}>Stud rod 8mm — Cutting</div>
          </div>
          <span className="badge badge-amber">In progress</span>
        </div>
        <div className="grid-3" style={{gap:'10px',marginBottom:'14px'}}>
          <div className="card-sm"><div style={{fontSize:'10px',color:'var(--muted)'}}>KG RECEIVED</div><div style={{fontFamily:'var(--font-mono)',fontSize:'18px',color:'var(--accent)',marginTop:'4px'}}>85 kg</div></div>
          <div className="card-sm"><div style={{fontSize:'10px',color:'var(--muted)'}}>TARGET DIMS</div><div style={{fontSize:'13px',marginTop:'4px'}}>8mm × 120mm</div></div>
          <div className="card-sm"><div style={{fontSize:'10px',color:'var(--muted)'}}>NEXT DEPT</div><div style={{fontSize:'13px',marginTop:'4px',color:'var(--purple)'}}>Threading</div></div>
        </div>
        <div style={{fontSize:'10px',color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'8px'}}>Stage progress</div>
        <div className="kg-trail">
          <div className="kg-stage done"><div className="kg-stage-name">Received</div><div className="kg-stage-val">85 kg</div></div>
          <div className="kg-arrow">→</div>
          <div className="kg-stage active"><div className="kg-stage-name">Cutting</div><div className="kg-stage-val">— kg</div></div>
          <div className="kg-arrow">→</div>
          <div className="kg-stage"><div className="kg-stage-name">Threading</div><div className="kg-stage-val">—</div></div>
          <div className="kg-arrow">→</div>
          <div className="kg-stage"><div className="kg-stage-name">Locking</div><div className="kg-stage-val">—</div></div>
          <div className="kg-arrow">→</div>
          <div className="kg-stage"><div className="kg-stage-name">Finished</div><div className="kg-stage-val">—</div></div>
        </div>
      </div>
      <div className="log-form">
        <div style={{fontSize:'13px',fontWeight:'600',marginBottom:'4px'}}>Record cutting output</div>
        <div style={{fontSize:'12px',color:'var(--muted)',marginBottom:'14px'}}>Kg in must equal kg passed forward + kg scrap</div>
        <div className="kg-inputs">
          <div className="kg-input-group"><label>Kg in (received)</label><input type="number" value="85" readOnly style={{opacity:'0.6'}}/></div>
          <div className="kg-input-group output"><label>Kg out (to threading)</label><input type="number" id="kg-out" placeholder="0" onInput={() => checkBalance()}/></div>
          <div className="kg-input-group scrap"><label>Kg scrap</label><input type="number" id="kg-scrap" placeholder="0" onInput={() => checkBalance()}/></div>
        </div>
        <div className="kg-balance" id="kg-balance">Enter kg out and scrap to verify balance</div>
        <div style={{marginTop:'14px',display:'flex',gap:'10px'}}>
          <button className="btn btn-primary" onClick={() => submitStage()}>Mark stage complete → send to threading</button>
          <button className="btn btn-ghost">Save draft</button>
        </div>
      </div>
    </div>
  );
}

function checkBalance() {
  const out = parseFloat((document.getElementById('kg-out') as HTMLInputElement)?.value) || 0;
  const scrap = parseFloat((document.getElementById('kg-scrap') as HTMLInputElement)?.value) || 0;
  const bal = document.getElementById('kg-balance');
  if (!bal) return;
  const total = out + scrap;
  if (!out && !scrap) { bal.className = 'kg-balance'; bal.textContent = 'Enter kg out and scrap to verify balance'; return; }
  if (Math.abs(total - 85) < 0.01) {
    bal.className = 'kg-balance valid';
    bal.textContent = `✓ Balanced — ${out} kg forward + ${scrap} kg scrap = 85 kg`;
  } else {
    bal.className = 'kg-balance invalid';
    bal.textContent = `✗ Mismatch — ${out} + ${scrap} = ${total} kg (expected 85 kg)`;
  }
}

function submitStage() {
  const out = parseFloat((document.getElementById('kg-out') as HTMLInputElement)?.value) || 0;
  const scrap = parseFloat((document.getElementById('kg-scrap') as HTMLInputElement)?.value) || 0;
  if (Math.abs(out + scrap - 85) < 0.01) {
    alert(`Stage complete!\n\n${out} kg passed to Threading dept\n${scrap} kg logged as scrap\n\nThreading dept notified.`);
    // navigate('operator_queue');
  } else {
    alert('Please ensure kg out + kg scrap = 85 kg before completing the stage.');
  }
}
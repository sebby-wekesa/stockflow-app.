export default function ReceivePage() {
  return (
    <div>
      <div className="section-header mb-16">
        <div><div className="section-title">Receive raw materials</div><div className="section-sub">Log incoming stock into warehouse</div></div>
      </div>
      <div className="card" style={{maxWidth:'560px'}}>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Material type</label><select className="form-input"><option>Steel rod 16mm</option><option>Steel rod 20mm</option><option>Steel rod 25mm</option></select></div>
          <div className="form-group"><label className="form-label">Quantity (kg)</label><input type="number" className="form-input" placeholder="e.g. 200"/></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">GRN / Reference</label><input type="text" className="form-input" placeholder="e.g. GRN-2242"/></div>
          <div className="form-group"><label className="form-label">Supplier</label><select className="form-input"><option>Steel Masters Ltd</option><option>KenSteel Supply</option></select></div>
        </div>
        <div className="form-group mb-16"><label className="form-label">Notes</label><input type="text" className="form-input" placeholder="Optional"/></div>
        <button className="btn btn-primary" onClick={() => alert('Stock received and logged')}>Confirm receipt</button>
      </div>
    </div>
  );
}
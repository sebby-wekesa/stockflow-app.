export default function InventoryPage() {
  return (
    <div>
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Raw materials</div>
          <div className="section-sub">Current stock levels in kg</div>
        </div>
        <button className="btn btn-primary">+ Receive stock</button>
      </div>
      <div className="stats-grid mb-24" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
        {[
          {name:'Steel rod 16mm',kg:'1,840',reserved:'960',free:'880',trend:'teal'},
          {name:'Steel rod 20mm',kg:'1,420',reserved:'640',free:'780',trend:'teal'},
          {name:'Steel rod 25mm',kg:'1,560',reserved:'1,200',free:'360',trend:'amber'},
        ].map(m => (
          <div key={m.name} className={`stat-card ${m.trend}`}>
            <div className="stat-label">{m.name}</div>
            <div className="stat-value">{m.kg}<span style={{fontSize:'14px',color:'var(--muted)'}}> kg</span></div>
            <div className="stat-sub"><span>{m.free} kg free</span> · {m.reserved} kg reserved</div>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="section-header mb-16">
          <div className="section-title">Receipt history</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Material</th>
              <th>Kg received</th>
              <th>Reference</th>
              <th>Logged by</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>25 Mar 2026</td><td>Steel rod 16mm</td><td><span className="job-kg">200 kg</span></td><td>GRN-2241</td><td>Warehouse</td></tr>
            <tr><td>24 Mar 2026</td><td>Steel rod 25mm</td><td><span className="job-kg">500 kg</span></td><td>GRN-2240</td><td>Warehouse</td></tr>
            <tr><td>23 Mar 2026</td><td>Steel rod 20mm</td><td><span className="job-kg">300 kg</span></td><td>GRN-2239</td><td>Warehouse</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
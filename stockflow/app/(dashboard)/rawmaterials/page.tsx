export default function RawmaterialsPage() {
  const materials = [
    {name:'Steel rod 16mm',kg:'1,840',reserved:'960',free:'880',trend:'teal'},
    {name:'Steel rod 20mm',kg:'1,420',reserved:'640',free:'780',trend:'teal'},
    {name:'Steel rod 25mm',kg:'1,560',reserved:'1,200',free:'360',trend:'amber'},
  ];

  const receipts = [
    {date:'25 Mar 2026',mat:'Steel rod 16mm',kg:'200 kg',ref:'GRN-2241',by:'Warehouse'},
    {date:'24 Mar 2026',mat:'Steel rod 25mm',kg:'500 kg',ref:'GRN-2240',by:'Warehouse'},
    {date:'23 Mar 2026',mat:'Steel rod 20mm',kg:'300 kg',ref:'GRN-2239',by:'Warehouse'},
  ];

  return (
    <div>
      <div className="section-header mb-16">
        <div><div className="section-title">Raw materials</div><div className="section-sub">Current stock levels in kg</div></div>
        <button className="btn btn-primary">+ Receive stock</button>
      </div>
      <div className="stats-grid mb-24" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
        {materials.map(m => (
          <div key={m.name} className={`stat-card ${m.trend}`}>
            <div className="stat-label">{m.name}</div>
            <div className="stat-value">{m.kg}<span style={{fontSize:'14px',color:'var(--muted)'}}> kg</span></div>
            <div className="stat-sub"><span>{m.free} kg free</span> · {m.reserved} kg reserved</div>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="section-header mb-16"><div className="section-title">Receipt history</div></div>
        <table>
          <thead><tr><th>Date</th><th>Material</th><th>Kg received</th><th>Reference</th><th>Logged by</th></tr></thead>
          <tbody>
            {receipts.map(r => (
              <tr key={r.ref}>
                <td>{r.date}</td>
                <td>{r.mat}</td>
                <td><span className="job-kg">{r.kg}</span></td>
                <td>{r.ref}</td>
                <td>{r.by}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
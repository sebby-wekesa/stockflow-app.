export default function FinishedgoodsPage() {
  const goods = [
    {design:'Hex bolt M12',code:'HB-M12',units:120,totalKg:'340 kg',kgUnit:'2.83 kg',order:'PO-0038',status:'Available'},
    {design:'Stud rod 8mm',code:'SR-08',units:65,totalKg:'180 kg',kgUnit:'2.77 kg',order:'PO-0036',status:'Available'},
    {design:'Anchor bolt',code:'AB-16',units:62,totalKg:'520 kg',kgUnit:'8.39 kg',order:'PO-0035',status:'Available'},
    {design:'Hex bolt M10',code:'HB-M10',units:45,totalKg:'95 kg',kgUnit:'2.11 kg',order:'PO-0034',status:'Available'},
    {design:'Foundation bolt',code:'FB-20',units:30,totalKg:'205 kg',kgUnit:'6.83 kg',order:'PO-0033',status:'Partial reserve'},
  ];

  return (
    <div>
      <div className="section-header mb-16">
        <div><div className="section-title">Finished goods</div><div className="section-sub">Stock ready for sale</div></div>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Design</th><th>Code</th><th>Units</th><th>Total kg</th><th>Kg/unit</th><th>Production order</th><th>Status</th></tr></thead>
          <tbody>
            {goods.map(g => (
              <tr key={g.code}>
                <td>{g.design}</td>
                <td><span style={{fontFamily:'var(--font-mono)',color:'var(--muted)'}}>{g.code}</span></td>
                <td>{g.units}</td>
                <td><span className="job-kg">{g.totalKg}</span></td>
                <td>{g.kgUnit}</td>
                <td>{g.order}</td>
                <td><span className={`badge ${g.status === 'Available' ? 'badge-teal' : 'badge-amber'}`}>{g.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
export default function PackQueuePage() {
  const orders = [
    {id:'SO-0091',product:'Hex bolt M12',qty:'50 units · 140 kg',client:'Apex Hardware',priority:'high',date:'Today · 09:14'},
    {id:'SO-0090',product:'Anchor bolt',qty:'20 units · 167 kg',client:'BuildPro Ltd',priority:'high',date:'Today · 08:51'},
    {id:'SO-0089',product:'Stud rod 8mm',qty:'30 units · 83 kg',client:'Mech Supplies',priority:'normal',date:'Yesterday · 16:30'},
    {id:'SO-0088',product:'Hex bolt M10',qty:'45 units · 95 kg',client:'Apex Hardware',priority:'normal',date:'Yesterday · 14:20'},
    {id:'SO-0087',product:'Foundation bolt',qty:'10 units · 68 kg',client:'KenSteel Ltd',priority:'normal',date:'Yesterday · 11:05'},
  ];

  return (
    <div>
      <div className="section-header mb-16">
        <div><div className="section-title">Packaging queue</div><div className="section-sub">Sale orders awaiting fulfilment</div></div>
      </div>
      {orders.map(o => (
        <div key={o.id} className="pack-card">
          <div className="pack-priority" style={{background:o.priority==='high'?'var(--red)':'var(--border2)'}}></div>
          <div className="pack-info">
            <div className="pack-order">{o.id} · {o.date}</div>
            <div className="pack-product">{o.product}</div>
            <div className="pack-detail">{o.qty} · {o.client}</div>
          </div>
          <div className="pack-actions">
            {o.priority==='high' && <span className="badge badge-red">Priority</span>}
            <button className="btn btn-teal btn-sm" onClick={() => alert(`Order ${o.id} marked as fulfilled`)}>Mark fulfilled</button>
          </div>
        </div>
      ))}
    </div>
  );
}
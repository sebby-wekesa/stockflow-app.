export function PackQueueScreen() {
  return (
    <>
      <div className="section-header mb-16">
        <div><div className="section-title">Packaging queue</div><div className="section-sub">Sale orders awaiting fulfilment</div></div>
      </div>
      <div style={{padding: '40px', textAlign: 'center', color: 'var(--muted)'}}>
        No orders in packaging queue
      </div>
    </>
  );
}
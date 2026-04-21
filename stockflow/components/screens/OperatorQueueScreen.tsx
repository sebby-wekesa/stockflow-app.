export function OperatorQueueScreen() {
  return (
    <>
      <div className="section-header mb-16">
        <div><div className="section-title">Cutting dept — job queue</div><div className="section-sub">Jobs ready for your department</div></div>
      </div>
      <div style={{padding: '40px', textAlign: 'center', color: 'var(--muted)'}}>
        No jobs in queue
      </div>
    </>
  );
}
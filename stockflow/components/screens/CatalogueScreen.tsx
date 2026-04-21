export function CatalogueScreen() {
  return (
    <>
      <div className="section-header mb-16">
        <div><div className="section-title">Available stock</div><div className="section-sub">Finished goods ready to order</div></div>
      </div>
      <div style={{padding: '40px', textAlign: 'center', color: 'var(--muted)'}}>
        No products available
      </div>
    </>
  );
}
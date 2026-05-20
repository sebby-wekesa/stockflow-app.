'use client';

export default function ExportStockButton({ products }: { products: any[] }) {
  const handleExport = () => {
    const headers = ['SKU', 'Name', 'Category', 'Stock', 'Status'];
    const rows = products.map(p => [
      p.sku, 
      p.name, 
      p.category, 
      p.currentStock || 0, 
      p.stockStatus || 'AVAILABLE'
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stock-export.csv';
    a.click();
  };

  return (
    <button className="btn btn-ghost" onClick={handleExport}>
      Export CSV
    </button>
  );
}

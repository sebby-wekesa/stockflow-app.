"use client";

import { ShoppingCart, Search, Package, DollarSign, TrendingUp, Filter, X } from "lucide-react";
import { useState } from "react";

export function SalesCatalogue({ products }: { products: any[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("name");

  const filteredProducts = products
    .filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "stock":
          return b.stock - a.stock;
        case "name":
        default:
          return a.name.localeCompare(b.name);
      }
    });

  // Mock pricing logic - in a real app this would come from the database
  const getPrice = (product: any) => {
    // Base price on unit weight with some variation
    const basePrice = product.unitWeight * 2.5;
    return Math.round(basePrice * 100) / 100;
  };

  const getStockStatus = (stock: number) => {
    if (stock === 0) return { label: "Out of Stock", class: "badge-red" };
    if (stock < 50) return { label: "Low Stock", class: "badge-amber" };
    return { label: "In Stock", class: "badge-green" };
  };

  return (
    <div>
      {/* Controls Section */}
      <div className="card-sm mb-6">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-start', flex: 1 }}>
              {/* Search Bar */}
              <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
                <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} size={18} />
                <input
                  type="text"
                  placeholder="Search products, descriptions, or codes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border2)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 10px 8px 36px',
                    color: 'var(--text)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--muted)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Filter and Sort */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Filter size={14} style={{ color: 'var(--muted)' }} />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{
                    background: 'var(--surface2)',
                    border: '1px solid var(--border2)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '6px 10px',
                    color: 'var(--text)',
                    fontSize: '12px',
                    outline: 'none'
                  }}
                >
                  <option value="name">Sort by Name</option>
                  <option value="stock">Sort by Stock</option>
                </select>
              </div>
            </div>

            {/* Results Counter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              <span style={{
                background: 'rgba(240,192,64,0.15)',
                color: 'var(--accent)',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 600
              }}>
                {filteredProducts.length}
              </span>
              <span style={{ color: 'var(--muted)' }}>of {products.length} products</span>
            </div>
          </div>

          {/* Search Info */}
          {searchTerm && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--muted)' }}>
              <span>Searching for:</span>
              <span style={{
                background: 'rgba(240,192,64,0.15)',
                color: 'var(--accent)',
                padding: '2px 6px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 500
              }}>
                &quot;{searchTerm}&quot;
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Product Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '16px'
      }}>
        {filteredProducts.map((product) => {
          const price = getPrice(product);
          const stockStatus = getStockStatus(product.stock);
          const totalValue = price * product.stock;

          return (
            <div key={product.id} className="card" style={{ cursor: 'pointer' }}>
              <div style={{ padding: '20px' }}>
                {/* Header */}
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="p-3 bg-gradient-to-br from-accent/10 to-accent/5 rounded-xl border border-accent/20">
                      <Package className="text-accent" size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-mono text-muted uppercase tracking-wider font-semibold">
                        {product.code}
                      </div>
                      <div className={`badge ${stockStatus.class} text-xs mt-2 inline-block`}>
                        {stockStatus.label}
                      </div>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-lg font-mono font-bold text-accent">
                      ${price.toFixed(2)}
                    </div>
                    <div className="text-xs text-muted">per unit</div>
                  </div>
                </div>

                {/* Product Info */}
                <div className="space-y-3">
                  <h3 className="font-head font-bold text-text leading-tight text-lg line-clamp-2">
                    {product.name}
                  </h3>
                  <p className="text-sm text-muted leading-relaxed line-clamp-2">
                    {product.description}
                  </p>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-4 py-4 border-t border-border2">
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-muted uppercase tracking-wider">
                      Available Stock
                    </div>
                    <div className="text-2xl font-mono font-bold text-text">
                      {product.stock.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted">units</div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-1">
                      <TrendingUp size={12} />
                      Total Value
                    </div>
                    <div className="text-2xl font-mono font-bold text-green">
                      ${(totalValue / 1000).toFixed(1)}k
                    </div>
                    <div className="text-xs text-muted">${totalValue.toLocaleString()}</div>
                  </div>
                </div>

                {/* Weight Info */}
                <div className="bg-gradient-to-r from-surface2 to-surface border border-border2 rounded-xl p-4">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-accent rounded-full"></div>
                      <span className="text-muted">Unit: <span className="font-mono text-text">{product.unitWeight}g</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-teal rounded-full"></div>
                      <span className="text-muted">Total: <span className="font-mono text-text">{(product.kgProduced / 1000).toFixed(2)}kg</span></span>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <button className="w-full flex items-center justify-center gap-3 p-4 bg-gradient-to-r from-accent to-accent2 text-black rounded-xl hover:shadow-lg hover:shadow-accent/20 transition-all duration-200 font-semibold group-hover:scale-[1.02] active:scale-[0.98]">
                  <ShoppingCart size={18} />
                  Add to Order
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredProducts.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          color: 'var(--muted)'
        }}>
          <div style={{
            display: 'inline-block',
            position: 'relative',
            marginBottom: '20px'
          }}>
            <div style={{
              padding: '20px',
              background: 'var(--surface2)',
              border: '1px solid var(--border2)',
              borderRadius: 'var(--radius)',
              display: 'inline-block'
            }}>
              <Package size={36} style={{ color: 'var(--muted)' }} />
            </div>
            <div style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              width: '20px',
              height: '20px',
              background: 'var(--accent)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Search size={10} style={{ color: '#000' }} />
            </div>
          </div>
          <h3 style={{
            fontSize: '18px',
            fontFamily: 'var(--font-head)',
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: '8px'
          }}>
            {searchTerm ? "No products match your search" : "No products available"}
          </h3>
          <p style={{
            color: 'var(--muted)',
            maxWidth: '400px',
            margin: '0 auto 20px'
          }}>
            {searchTerm
              ? `We couldn't find any products matching "${searchTerm}". Try different keywords or clear your search.`
              : "There are currently no products available in your catalogue."
            }
          </p>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="btn-primary"
              style={{ marginTop: '0' }}
            >
              Clear Search
            </button>
          )}
        </div>
      )}
    </div>
  );
}
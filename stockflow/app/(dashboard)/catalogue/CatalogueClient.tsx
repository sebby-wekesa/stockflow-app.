"use client";

import { useState, useMemo } from "react";
import { SalesOrderForm } from "@/components/SalesOrderForm";

type SortOption = 'name' | 'code' | 'price' | 'quantity' | 'date';

interface Product {
  id: string;
  name: string;
  code: string;
  availableQty: number;
  kgProduced: number;
  price: number;
  createdAt: string;
}

interface CatalogueProduct {
  id: string;
  design: {
    name: string;
    code: string;
    description?: string;
  };
  quantity: number;
  kgProduced: number;
  price: number | null;
  createdAt: Date;
}

export default function CatalogueClient({ products }: { products: CatalogueProduct[] }) {
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showOnlyInStock, setShowOnlyInStock] = useState(false);

  const formattedProducts = products.map(p => ({
    id: p.id,
    name: p.design.name,
    code: p.design.code,
    availableQty: p.quantity,
    kgProduced: p.kgProduced,
    price: p.price || 0, // Default price if not set
    createdAt: p.createdAt
  }));

  const filteredAndSortedProducts = useMemo(() => {
    let filtered = formattedProducts;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.code.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by availability
    if (showOnlyInStock) {
      filtered = filtered.filter(product => product.availableQty > 0);
    }

    // Sort products
    filtered.sort((a: Product, b: Product) => {
      let aValue: string | number | Date;
      let bValue: string | number | Date;

      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'code':
          aValue = a.code.toLowerCase();
          bValue = b.code.toLowerCase();
          break;
        case 'price':
          aValue = a.price;
          bValue = b.price;
          break;
        case 'quantity':
          aValue = a.availableQty;
          bValue = b.availableQty;
          break;
        case 'date':
          aValue = new Date(a.createdAt);
          bValue = new Date(b.createdAt);
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [formattedProducts, searchTerm, sortBy, sortOrder, showOnlyInStock]);

  if (showOrderForm) {
    return (
      <div className="dashboard-content">
        <div className="section-header">
          <div>
            <h1>Place Sales Order</h1>
            <div className="section-sub">Create a new sales order from available products</div>
          </div>
          <button
            onClick={() => setShowOrderForm(false)}
            className="btn btn-secondary"
          >
            ← Back to Catalogue
          </button>
        </div>
        <div className="card">
          <SalesOrderForm
            products={formattedProducts}
            onOrderPlaced={() => setShowOrderForm(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-content">
      <div className="section-header">
        <div>
          <h1>Product Catalogue</h1>
          <div className="section-sub">Browse and order finished goods from available stock</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowOrderForm(true)}>
          Place Sales Order
        </button>
      </div>

      {/* Search and Filter Controls */}
      <div className="card">
        <div style={{
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <div style={{ flex: 1, minWidth: '250px' }}>
            <input
              type="text"
              placeholder="Search by name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--surface2)',
                border: '1px solid var(--border2)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
                color: 'var(--text)',
                fontSize: '14px',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border2)'}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              fontSize: '13px'
            }}>
              <input
                type="checkbox"
                checked={showOnlyInStock}
                onChange={(e) => setShowOnlyInStock(e.target.checked)}
                style={{
                  width: '14px',
                  height: '14px',
                  accentColor: 'var(--accent)'
                }}
              />
              <span style={{ color: 'var(--text)' }}>In stock only</span>
            </label>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text)'
            }}>
              Sort by:
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              style={{
                background: 'var(--surface2)',
                border: '1px solid var(--border2)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 10px',
                color: 'var(--text)',
                fontSize: '13px',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="name">Name</option>
              <option value="code">Code</option>
              <option value="price">Price</option>
              <option value="quantity">Quantity</option>
              <option value="date">Date Added</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="btn btn-secondary"
              style={{ padding: '6px 10px', fontSize: '12px' }}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="card">
        <div className="section-header">
          <div>
            <div className="section-title">Available Products</div>
            <div className="section-sub">
              {filteredAndSortedProducts.length} product{filteredAndSortedProducts.length !== 1 ? 's' : ''} available
            </div>
          </div>
        </div>

        {filteredAndSortedProducts.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: 'var(--muted)'
          }}>
            <div style={{
              display: 'inline-block',
              marginBottom: '12px'
            }}>
              <div style={{
                padding: '16px',
                background: 'var(--surface2)',
                border: '1px solid var(--border2)',
                borderRadius: 'var(--radius)',
                display: 'inline-block'
              }}>
                📦
              </div>
            </div>
            <p style={{
              fontSize: '14px',
              color: 'var(--muted)',
              marginBottom: '4px'
            }}>
              No products found
            </p>
            <p style={{
              fontSize: '12px',
              color: 'var(--muted)'
            }}>
              {products.length === 0
                ? "No finished goods available in catalogue."
                : "Try adjusting your search or filter criteria."}
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Code</th>
                  <th>Description</th>
                  <th>Weight</th>
                  <th>Stock</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedProducts.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 500, color: 'var(--text)' }}>
                      {p.name}
                    </td>
                    <td>
                      <code style={{
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--blue)',
                        background: 'rgba(74,158,255,0.1)',
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid rgba(74,158,255,0.2)'
                      }}>
                        {p.code}
                      </code>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      {products.find(prod => prod.id === p.id)?.design?.description || 'Standard finish'}
                    </td>
                    <td style={{
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 500,
                      color: 'var(--green)'
                    }}>
                      {p.kgProduced.toFixed(2)} kg
                    </td>
                    <td>
                      <span style={{
                        fontWeight: 500,
                        color: p.availableQty > 0 ? 'var(--green)' : 'var(--red)'
                      }}>
                        {p.availableQty} unit{p.availableQty !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td style={{
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 500,
                      color: 'var(--accent)'
                    }}>
                      ${p.price?.toFixed(2) || 'TBD'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

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
  createdAt: string;
}

export default function CatalogueClient({ products }: { products: CatalogueProduct[] }) {
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showOnlyInStock, setShowOnlyInStock] = useState(false);

  // Selection for sales team to choose multiple items directly from catalogue
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAllVisible = () => {
    const visibleIds = filteredAndSortedProducts.map(p => p.id);
    const newSelected = new Set(selectedIds);
    visibleIds.forEach(id => newSelected.add(id));
    setSelectedIds(newSelected);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const selectedProducts = formattedProducts.filter(p => selectedIds.has(p.id));

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
    const preselected = selectedIds.size > 0 
      ? formattedProducts.filter(p => selectedIds.has(p.id))
      : undefined;

    return (
      <div className="dashboard-content">
        <div className="section-header">
          <div>
            <h1>Place Sales Order</h1>
            <div className="section-sub">
              {preselected 
                ? `Ordering ${preselected.length} selected item${preselected.length !== 1 ? 's' : ''}`
                : 'Create a new sales order from available products'
              }
            </div>
          </div>
          <button
            onClick={() => {
              setShowOrderForm(false);
              // keep selection so user can adjust if needed
            }}
            className="btn btn-secondary"
          >
            ← Back to Catalogue
          </button>
        </div>
        <div className="card">
          <SalesOrderForm
            products={formattedProducts}
            preselectedItems={preselected}
            onOrderPlaced={() => {
              setShowOrderForm(false);
              clearSelection();
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-content">
      <div className="section-header">
        <div>
          <div className="section-title">Product Catalogue</div>
          <div className="section-sub">Browse and order finished goods from available stock</div>
        </div>
        <button 
          className="btn btn-primary" 
          onClick={() => setShowOrderForm(true)}
        >
          Place Sales Order
        </button>
      </div>

      {/* Search and Filter Controls */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[240px]">
            <input
              type="text"
              placeholder="Search by name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input w-full"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlyInStock}
                onChange={(e) => setShowOnlyInStock(e.target.checked)}
                className="accent-accent"
              />
              <span>In stock only</span>
            </label>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="form-input text-sm py-1"
              >
                <option value="name">Name</option>
                <option value="code">Code</option>
                <option value="price">Price</option>
                <option value="quantity">Quantity</option>
                <option value="date">Date Added</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="btn btn-ghost btn-sm px-2"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
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

          {/* Selection controls for sales team */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted">
                {selectedIds.size} selected
              </span>
              <button onClick={clearSelection} className="btn btn-ghost btn-sm">
                Clear
              </button>
              <button 
                onClick={() => setShowOrderForm(true)} 
                className="btn btn-primary btn-sm"
              >
                Create Order from Selection
              </button>
            </div>
          )}
          {selectedIds.size === 0 && (
            <button onClick={selectAllVisible} className="btn btn-ghost btn-sm">
              Select all visible
            </button>
          )}
        </div>

        {filteredAndSortedProducts.length === 0 ? (
          <div className="text-center py-12 text-muted">
            <div className="inline-block mb-3 p-4 bg-surface2 border border-border2 rounded-lg text-2xl">
              📦
            </div>
            <p className="text-sm mb-1">No products found</p>
            <p className="text-xs">
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
                  <th style={{ width: '40px' }}>
                    <input 
                      type="checkbox" 
                      checked={filteredAndSortedProducts.length > 0 && filteredAndSortedProducts.every(p => selectedIds.has(p.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          selectAllVisible();
                        } else {
                          clearSelection();
                        }
                      }}
                    />
                  </th>
                  <th>Product</th>
                  <th>Code</th>
                  <th>Description</th>
                  <th>Weight</th>
                  <th>Stock</th>
                  <th>Price</th>
                  <th style={{ width: '100px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedProducts.map(p => (
                  <tr 
                    key={p.id} 
                    style={{ cursor: 'pointer' }}
                    onClick={() => toggleSelect(p.id)}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.has(p.id)}
                        onChange={() => toggleSelect(p.id)}
                      />
                    </td>
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
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          const newSelected = new Set(selectedIds);
                          newSelected.add(p.id);
                          setSelectedIds(newSelected);
                          setShowOrderForm(true);
                        }}
                        className="btn btn-primary btn-sm text-xs px-3 py-1"
                      >
                        Choose
                      </button>
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

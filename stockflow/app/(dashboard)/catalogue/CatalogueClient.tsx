"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpDown, Package, Search, ShoppingCart, X } from "lucide-react";
import { formatKES } from "@/lib/sales-utils";

type SortOption = "name" | "code" | "price" | "quantity" | "date";
type SourceFilter = "all" | "manufactured" | "product";

type CatalogueProduct = {
  id: string;
  name: string;
  code: string;
  description: string;
  quantity: number;
  reservedQuantity?: number;
  kgProduced: number;
  piecesSets: number;
  uom: string;
  category: string;
  origin: string;
  price: number | null;
  createdAt: string;
  branchName: string | null;
  source: "manufactured" | "product";
};

function sourceLabel(source: CatalogueProduct["source"]) {
  return source === "manufactured" ? "Finished goods" : "Product stock";
}

function stockBadgeClass(quantity: number) {
  if (quantity <= 0) return "badge-red";
  if (quantity < 10) return "badge-amber";
  return "badge-teal";
}

export default function CatalogueClient({ products }: { products: CatalogueProduct[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [showOnlyInStock, setShowOnlyInStock] = useState(true);

  const stats = useMemo(() => {
    const totalQty = products.reduce((sum, product) => sum + product.quantity, 0);
    const totalValue = products.reduce(
      (sum, product) => sum + product.quantity * (product.price ?? 0),
      0
    );
    const manufactured = products.filter((product) => product.source === "manufactured").length;
    return { totalQty, totalValue, manufactured };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const filtered = products.filter((product) => {
      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.code.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query) ||
        product.origin.toLowerCase().includes(query);

      const matchesSource = sourceFilter === "all" || product.source === sourceFilter;
      const matchesStock = !showOnlyInStock || product.quantity > 0;
      return matchesSearch && matchesSource && matchesStock;
    });

    return filtered.toSorted((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortBy) {
        case "code":
          aValue = a.code.toLowerCase();
          bValue = b.code.toLowerCase();
          break;
        case "price":
          aValue = a.price ?? 0;
          bValue = b.price ?? 0;
          break;
        case "quantity":
          aValue = a.quantity;
          bValue = b.quantity;
          break;
        case "date":
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case "name":
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }

      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [products, searchTerm, showOnlyInStock, sortBy, sortOrder, sourceFilter]);

  return (
    <div className="dashboard-content">
      <div className="section-header">
        <div>
          <h1>Sales Catalogue</h1>
          <div className="section-sub">Live sellable stock from finished goods and product inventory</div>
        </div>
        <Link href="/sales/new" className="btn btn-primary">
          <ShoppingCart size={16} /> New sales order
        </Link>
      </div>

      <div className="stats-grid">
        <div className="stat-card teal">
          <div className="stat-label">Catalogue items</div>
          <div className="stat-value">{products.length.toLocaleString()}</div>
          <div className="stat-sub">Records available from the database</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-label">Available quantity</div>
          <div className="stat-value">{stats.totalQty.toLocaleString()}</div>
          <div className="stat-sub">Finished goods plus product stock</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">Finished goods</div>
          <div className="stat-value">{stats.manufactured.toLocaleString()}</div>
          <div className="stat-sub">Manufactured stock lines</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-label">Stock value</div>
          <div className="stat-value sales-money">{formatKES(stats.totalValue)}</div>
          <div className="stat-sub">Based on configured unit costs</div>
        </div>
      </div>

      <div className="card mb-16">
        <div className="section-header mb-16">
          <div>
            <div className="section-title">Filter Catalogue</div>
            <div className="section-sub">Search by product, SKU, category, or stock source</div>
          </div>
          <span className="badge badge-muted">{filteredProducts.length.toLocaleString()} shown</span>
        </div>

        <div className="sales-search-form">
          <div className="form-group">
            <label className="form-label">Search</label>
            <div style={{ position: "relative" }}>
              <Search size={16} style={{ position: "absolute", left: 12, top: 12, color: "var(--muted)" }} />
              <input
                type="search"
                className="form-input"
                style={{ paddingLeft: 36, paddingRight: searchTerm ? 36 : undefined }}
                placeholder="Search name, SKU, category..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchTerm("")}
                  style={{ position: "absolute", right: 10, top: 10, color: "var(--muted)", background: "transparent", border: 0 }}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Source</label>
            <select
              className="form-input"
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value as SourceFilter)}
            >
              <option value="all">All sources</option>
              <option value="manufactured">Finished goods</option>
              <option value="product">Product stock</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Sort by</label>
            <select
              className="form-input"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortOption)}
            >
              <option value="name">Name</option>
              <option value="code">SKU/code</option>
              <option value="quantity">Quantity</option>
              <option value="price">Unit cost</option>
              <option value="date">Date added</option>
            </select>
          </div>

          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setSortOrder((current) => (current === "asc" ? "desc" : "asc"))}
          >
            <ArrowUpDown size={16} /> {sortOrder === "asc" ? "Ascending" : "Descending"}
          </button>

          <label className="btn btn-ghost" style={{ cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={showOnlyInStock}
              onChange={(event) => setShowOnlyInStock(event.target.checked)}
            />
            In stock
          </label>
        </div>
      </div>

      <div className="card">
        <div className="section-header mb-16">
          <div>
            <div className="section-title">Catalogue Stock</div>
            <div className="section-sub">All rows are fetched from tenant-scoped database records</div>
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="p-8 text-center text-muted">
            <Package size={28} style={{ margin: "0 auto 10px" }} />
            <div>No catalogue items match the current filters.</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Source</th>
                  <th>Category</th>
                  <th className="text-right">Available</th>
                  <th className="text-right">Pieces/sets</th>
                  <th className="text-right">Weight</th>
                  <th className="text-right">Unit cost</th>
                  <th>Branch</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={`${product.source}-${product.id}`}>
                    <td>
                      <div className="font-medium text-text">{product.name}</div>
                      <div className="section-sub font-mono">{product.code}</div>
                      {product.description && <div className="section-sub">{product.description}</div>}
                    </td>
                    <td>
                      <span className={`badge ${product.source === "manufactured" ? "badge-purple" : "badge-blue"}`}>
                        {sourceLabel(product.source)}
                      </span>
                    </td>
                    <td>{product.category}</td>
                    <td className="text-right">
                      <span className={`badge ${stockBadgeClass(product.quantity)}`}>
                        {product.quantity.toLocaleString()} {product.uom}
                      </span>
                    </td>
                    <td className="text-right font-mono">{product.piecesSets.toLocaleString()}</td>
                    <td className="text-right font-mono">
                      {product.kgProduced > 0 ? `${product.kgProduced.toLocaleString()} kg` : "-"}
                    </td>
                    <td className="text-right font-mono">
                      {product.price != null ? formatKES(product.price) : "TBD"}
                    </td>
                    <td className="section-sub">{product.branchName ?? "Main stock"}</td>
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

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Package, ShoppingCart, Ship, RefreshCw, TrendingUp,
  ArrowUpRight, Clock, Hash, Layers
} from "lucide-react";
import { ProductIntakeModal } from "@/components/inventory/ProductIntakeModal";

// ─── Types ───────────────────────────────────────────────────────────────────

type StockOrigin = "LOCAL_PURCHASE" | "IMPORTED" | "FACTORY_MADE";

interface ProductReceipt {
  id: string;
  qtyReceived: number;
  unitCost: number | null;
  landingCost: number | null;
  reference: string | null;
  vendor: string | null;
  loggedBy: string | null;
  createdAt: string;
}

interface Product {
  id: string;
  name: string;
  sku: string | null;
  origin: StockOrigin;
  uom: string;
  currentStock: number;
  unitCost: number | null;
  landingCost: number | null;
  vendor: string | null;
  branch: { name: string } | null;
  receipts: ProductReceipt[];
  createdAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number, dec = 0) {
  return n.toLocaleString("en-KE", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });
}

const TABS = [
  { key: "raw",   label: "Raw Materials",    icon: <Layers size={14} />,       color: "var(--accent)" },
  { key: "local", label: "Local Purchases",  icon: <ShoppingCart size={14} />, color: "var(--teal)" },
  { key: "imp",   label: "Imported Goods",   icon: <Ship size={14} />,          color: "var(--blue)" },
] as const;

type Tab = (typeof TABS)[number]["key"];

// ─── Raw Material row (from existing /api/inventory/materials) ────────────────
interface RawMaterial {
  id: string;
  materialName: string;
  diameter: string;
  availableKg: string | number;
  reservedKg: string | number;
  supplier?: { name: string } | null;
  createdAt: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const [tab, setTab] = useState<Tab>("raw");
  const [modalOpen, setModalOpen] = useState(false);

  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [localProducts, setLocalProducts] = useState<Product[]>([]);
  const [importedProducts, setImportedProducts] = useState<Product[]>([]);

  const [loadingRaw, setLoadingRaw] = useState(true);
  const [loadingLocal, setLoadingLocal] = useState(true);
  const [loadingImp, setLoadingImp] = useState(true);

  // ── Fetchers ──────────────────────────────────────────────────────────────

  const fetchRaw = useCallback(async () => {
    setLoadingRaw(true);
    try {
      const res = await fetch("/api/inventory/materials");
      if (res.ok) {
        const data = await res.json();
        // API returns { success: true, data: [...] }
        setRawMaterials(data.data ?? data.materials ?? data ?? []);
      }
    } catch { /* handled gracefully */ }
    finally { setLoadingRaw(false); }
  }, []);

  const fetchProducts = useCallback(async (origin: StockOrigin, setter: (p: Product[]) => void, setLoading: (b: boolean) => void) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory/products?origin=${origin}`);
      if (res.ok) {
        const data = await res.json();
        setter(data.products ?? []);
      }
    } catch { /* handled gracefully */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRaw(); }, [fetchRaw]);
  useEffect(() => { fetchProducts("LOCAL_PURCHASE", setLocalProducts, setLoadingLocal); }, [fetchProducts]);
  useEffect(() => { fetchProducts("IMPORTED", setImportedProducts, setLoadingImp); }, [fetchProducts]);

  function handleSuccess() {
    fetchProducts("LOCAL_PURCHASE", setLocalProducts, setLoadingLocal);
    fetchProducts("IMPORTED", setImportedProducts, setLoadingImp);
  }

  // ── Stats for current tab ─────────────────────────────────────────────────

  const totalLocal  = localProducts.reduce((s, p) => s + p.currentStock, 0);
  const totalImp    = importedProducts.reduce((s, p) => s + p.currentStock, 0);
  const totalRawKg  = rawMaterials.reduce((s, m) => s + Number(m.availableKg ?? 0), 0);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Page header */}
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Inventory</div>
          <div className="section-sub">Stock levels across all sources</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { fetchRaw(); handleSuccess(); }}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <RefreshCw size={13} /> Refresh
          </button>
          <button
            id="receive-stock-btn"
            className="btn btn-primary"
            onClick={() => setModalOpen(true)}
          >
            + Receive Stock
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="stats-grid mb-24" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
        <div className="stat-card amber">
          <div className="stat-label">Raw Material Stock</div>
          <div className="stat-value">{fmt(totalRawKg)}<span style={{ fontSize: 14, color: "var(--muted)" }}> kg</span></div>
          <div className="stat-sub"><Layers size={11} style={{ display: "inline", marginRight: 3 }} />Steel rod inventory</div>
        </div>
        <div className="stat-card teal">
          <div className="stat-label">Local Purchase Items</div>
          <div className="stat-value">{fmt(totalLocal)}<span style={{ fontSize: 14, color: "var(--muted)" }}> units</span></div>
          <div className="stat-sub"><TrendingUp size={11} style={{ display: "inline", marginRight: 3 }} />{localProducts.length} products</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">Imported Goods</div>
          <div className="stat-value">{fmt(totalImp)}<span style={{ fontSize: 14, color: "var(--muted)" }}> units</span></div>
          <div className="stat-sub"><ArrowUpRight size={11} style={{ display: "inline", marginRight: 3 }} />{importedProducts.length} products</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "var(--surface)", borderRadius: 10, padding: 4, border: "1px solid var(--border)" }}>
        {TABS.map(({ key, label, icon, color }) => (
          <button
            key={key}
            id={`tab-${key}`}
            onClick={() => setTab(key)}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              padding: "9px 16px", borderRadius: 8, border: "none", cursor: "pointer",
              fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600,
              transition: "all 0.15s",
              background: tab === key ? "var(--surface2)" : "transparent",
              color: tab === key ? color : "var(--muted)",
              borderBottom: tab === key ? `2px solid ${color}` : "2px solid transparent",
            }}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Raw Materials ─────────────────────────────────────────────── */}
      {tab === "raw" && (
        <div className="card">
          <div className="section-header mb-16">
            <div className="section-title" style={{ color: "var(--accent)" }}>Steel Rod Stock</div>
            <span className="badge badge-amber">{rawMaterials.length} materials</span>
          </div>
          {loadingRaw ? (
            <LoadingSkeleton rows={4} />
          ) : rawMaterials.length === 0 ? (
            <EmptyState icon={<Layers size={32} />} msg="No raw materials on record." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Diameter</th>
                    <th>Available (kg)</th>
                    <th>Reserved (kg)</th>
                    <th>Free (kg)</th>
                    <th>Supplier</th>
                  </tr>
                </thead>
                <tbody>
                  {rawMaterials.map((m) => {
                    const avail = Number(m.availableKg);
                    const reserved = Number(m.reservedKg);
                    const free = avail - reserved;
                    const pct = avail > 0 ? (free / avail) * 100 : 0;
                    return (
                      <tr key={m.id}>
                        <td style={{ fontWeight: 600 }}>{m.materialName}</td>
                        <td><span className="badge badge-muted">{m.diameter}</span></td>
                        <td><span className="job-kg">{fmt(avail, 1)} kg</span></td>
                        <td style={{ color: "var(--muted)" }}>{fmt(reserved, 1)} kg</td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ color: pct < 25 ? "var(--red)" : pct < 50 ? "var(--accent)" : "var(--teal)" }}>
                              {fmt(free, 1)} kg
                            </span>
                            <div style={{ width: 60, height: 4, background: "var(--surface2)", borderRadius: 2, overflow: "hidden" }}>
                              <div style={{
                                width: `${Math.min(pct, 100)}%`, height: "100%", borderRadius: 2,
                                background: pct < 25 ? "var(--red)" : pct < 50 ? "var(--accent)" : "var(--teal)",
                              }} />
                            </div>
                          </div>
                        </td>
                        <td style={{ color: "var(--muted)" }}>{m.supplier?.name ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Local Purchases ───────────────────────────────────────────── */}
      {tab === "local" && (
        <ProductTab
          products={localProducts}
          loading={loadingLocal}
          origin="LOCAL_PURCHASE"
          accentColor="var(--teal)"
          badgeClass="badge-teal"
          emptyMsg="No local purchases recorded yet. Click &ldquo;+ Receive Stock&rdquo; to add."
        />
      )}

      {/* ── Tab: Imported Goods ────────────────────────────────────────────── */}
      {tab === "imp" && (
        <ProductTab
          products={importedProducts}
          loading={loadingImp}
          origin="IMPORTED"
          accentColor="var(--blue)"
          badgeClass="badge-blue"
          emptyMsg="No imported goods recorded yet. Click &ldquo;+ Receive Stock&rdquo; to add."
        />
      )}

      {/* Modal */}
      <ProductIntakeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleSuccess}
      />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProductTab({
  products,
  loading,
  origin,
  accentColor,
  badgeClass,
  emptyMsg,
}: {
  products: Product[];
  loading: boolean;
  origin: StockOrigin;
  accentColor: string;
  badgeClass: string;
  emptyMsg: string;
}) {
  const label = origin === "LOCAL_PURCHASE" ? "Local Purchase" : "Imported";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Stock cards */}
      {!loading && products.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 4 }}>
          {products.map((p) => (
            <div key={p.id} className="card" style={{ borderTop: `2px solid ${accentColor}`, padding: 16 }}>
              <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 6 }}>
                {p.uom}
              </div>
              <div style={{ fontFamily: "var(--font-head)", fontSize: 15, fontWeight: 700, marginBottom: 4, lineHeight: 1.3 }}>
                {p.name}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 700, color: accentColor }}>
                {fmt(p.currentStock)}
              </div>
              {p.vendor && (
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
                  <Package size={10} /> {p.vendor}
                </div>
              )}
              {p.landingCost && (
                <div style={{ fontSize: 11, marginTop: 4, color: "var(--blue)" }}>
                  Landing: KSh {fmt(p.landingCost, 2)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Receipt history */}
      <div className="card">
        <div className="section-header mb-16">
          <div className="section-title" style={{ color: accentColor }}>
            {label} — Receipt History
          </div>
          <span className={`badge ${badgeClass}`}>{products.length} products</span>
        </div>

        {loading ? (
          <LoadingSkeleton rows={4} />
        ) : products.length === 0 ? (
          <EmptyState
            icon={origin === "IMPORTED" ? <Ship size={32} /> : <ShoppingCart size={32} />}
            msg={emptyMsg}
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Item</th>
                  <th>Qty Received</th>
                  {origin === "IMPORTED" && <th>Landing Cost</th>}
                  <th>Unit Cost</th>
                  <th>Vendor</th>
                  <th>Reference</th>
                  <th>Logged By</th>
                </tr>
              </thead>
              <tbody>
                {products.flatMap((p) =>
                  p.receipts.length === 0
                    ? [{
                        id: p.id + "_empty",
                        productName: p.name,
                        qtyReceived: p.currentStock,
                        unitCost: p.unitCost,
                        landingCost: p.landingCost,
                        reference: null,
                        vendor: p.vendor,
                        loggedBy: null,
                        uom: p.uom,
                        createdAt: p.createdAt,
                      }]
                    : p.receipts.map((r) => ({
                        id: r.id,
                        productName: p.name,
                        qtyReceived: r.qtyReceived,
                        unitCost: r.unitCost,
                        landingCost: r.landingCost,
                        reference: r.reference,
                        vendor: r.vendor,
                        loggedBy: r.loggedBy,
                        uom: p.uom,
                        createdAt: r.createdAt,
                      }))
                ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((row) => (
                  <tr key={row.id}>
                    <td style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>
                      <Clock size={11} style={{ display: "inline", marginRight: 4, opacity: 0.5 }} />
                      {fmtDate(row.createdAt)}
                    </td>
                    <td style={{ fontWeight: 600 }}>{row.productName}</td>
                    <td>
                      <span className="job-kg" style={{ color: accentColor }}>
                        <Hash size={11} style={{ display: "inline", marginRight: 2 }} />
                        {fmt(row.qtyReceived)} {row.uom}
                      </span>
                    </td>
                    {origin === "IMPORTED" && (
                      <td style={{ color: "var(--blue)", fontFamily: "var(--font-mono)" }}>
                        {row.landingCost ? `KSh ${fmt(row.landingCost, 2)}` : "—"}
                      </td>
                    )}
                    <td style={{ fontFamily: "var(--font-mono)", color: "var(--muted)" }}>
                      {row.unitCost ? `KSh ${fmt(row.unitCost, 2)}` : "—"}
                    </td>
                    <td style={{ color: "var(--muted)" }}>{row.vendor ?? "—"}</td>
                    <td>
                      {row.reference
                        ? <span className="badge badge-muted">{row.reference}</span>
                        : <span style={{ color: "var(--border2)" }}>—</span>}
                    </td>
                    <td style={{ color: "var(--muted)", fontSize: 12 }}>{row.loggedBy ?? "—"}</td>
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

function LoadingSkeleton({ rows }: { rows: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{
          height: 36, borderRadius: 6,
          background: "linear-gradient(90deg, var(--surface2) 25%, var(--border) 50%, var(--surface2) 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.4s infinite",
          opacity: 1 - i * 0.15,
        }} />
      ))}
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
    </div>
  );
}

function EmptyState({ icon, msg }: { icon: React.ReactNode; msg: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "48px 24px", color: "var(--muted)", gap: 12,
    }}>
      <div style={{ opacity: 0.3 }}>{icon}</div>
      <div style={{ fontSize: 13 }} dangerouslySetInnerHTML={{ __html: msg }} />
    </div>
  );
}
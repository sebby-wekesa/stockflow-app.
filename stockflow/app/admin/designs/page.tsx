import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function AdminDesignsPage() {
  const designs = await prisma.design.findMany({
    include: { stages: { orderBy: { sequence: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Design templates</div>
          <div className="section-sub">Standardised product designs with process stages</div>
        </div>
        <Link href="/designs/new" className="btn btn-primary">
          + New design
        </Link>
      </div>

      {designs.length === 0 ? (
        <div className="card text-center">
          <p className="text-muted text-sm">No designs yet. Create your first template.</p>
        </div>
      ) : (
        <div className="grid-3 mb-24">
          {designs.map((design) => (
            <div key={design.id} className="card" style={{ cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                <div>
                  <div style={{ fontFamily: "var(--font-head)", fontSize: "15px", fontWeight: "700" }}>{design.name}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                    {design.id.slice(0, 8).toUpperCase()}
                  </div>
                </div>
                {design.targetWeight && <span className="badge badge-green">{design.targetWeight} kg per unit</span>}
              </div>
              <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "8px" }}>
                {design.description || "No description"}
              </div>
              <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "10px" }}>
                {design.targetDimensions && `Dims: ${design.targetDimensions}`}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                {design.stages.map((stage) => (
                  <span
                    key={stage.id}
                    style={{ background: "rgba(139,124,248,0.12)", color: "var(--purple)", fontSize: "10px", padding: "2px 7px", borderRadius: "10px", fontWeight: "500" }}
                  >
                    {stage.sequence}. {stage.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
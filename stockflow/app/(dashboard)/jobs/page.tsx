import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import Link from "next/link";

export default function JobsPage() {
  return (
    <div>
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Cutting dept — job queue</div>
          <div className="section-sub">Jobs ready for your department</div>
        </div>
      </div>
      <div className="job-card urgent" style={{cursor:'pointer'}} onClick={() => alert('Navigate to log form')}>
        <div className="job-header">
          <span className="job-id">PO-0040 · Stage 1/3</span>
          <span className="badge badge-red">Urgent</span>
        </div>
        <div className="job-design">Stud rod 8mm — Cut to 120mm</div>
        <div className="job-meta" style={{marginTop:'8px'}}>
          <span>Received: <span className="job-kg">85 kg</span></span>
          <span>Target dims: 8mm × 120mm</span>
          <span>Client: BuildPro Ltd</span>
        </div>
      </div>
      <div className="job-card inprog" style={{cursor:'pointer'}} onClick={() => alert('Navigate to log form')}>
        <div className="job-header">
          <span className="job-id">PO-0039 · Stage 1/6</span>
          <span className="badge badge-amber">In progress</span>
        </div>
        <div className="job-design">Anchor bolt — Cut to 170mm</div>
        <div className="job-meta" style={{marginTop:'8px'}}>
          <span>Received: <span className="job-kg">200 kg</span></span>
          <span>Target dims: 16mm × 170mm</span>
          <span>Client: Apex Hardware</span>
        </div>
      </div>
      <div className="job-card">
        <div className="job-header">
          <span className="job-id">PO-0045 · Stage 1/4</span>
          <span className="badge badge-muted">Queued</span>
        </div>
        <div className="job-design">Hex bolt M12 — Cut to 70mm</div>
        <div className="job-meta" style={{marginTop:'8px'}}>
          <span>Received: <span className="job-kg">120 kg</span></span>
          <span>Target dims: 12mm × 70mm</span>
          <span>Client: Mech Supplies</span>
        </div>
      </div>
    </div>
  );
}

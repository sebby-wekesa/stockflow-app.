import { DesignTemplateBuilder } from "@/components/DesignTemplateBuilder";

export const dynamic = "force-dynamic";

export default function NewDesignPage() {
  return (
    <div>
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Create Design Template</div>
          <div className="section-sub">
            Define product details, production stages, specifications, yield, and material requirements
          </div>
        </div>
      </div>

      <DesignTemplateBuilder />
    </div>
  );
}

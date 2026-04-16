import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  color?: "amber" | "teal" | "purple" | "red" | "green";
  subLabel?: string;
  subLabelDown?: boolean;
}

export default function StatCard({ 
  label, 
  value, 
  color = "", 
  subLabel = "",
  subLabelDown = false
}: StatCardProps) {
  return (
    <div className={`stat-card ${color}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {subLabel && (
        <div className="stat-sub">
          <span className={subLabelDown ? "down" : ""}>
            {subLabel}
          </span>
        </div>
      )}
    </div>
  );
}
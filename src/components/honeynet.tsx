import { cn } from "@/lib/utils";

const sev: Record<string, string> = {
  critical: "bg-destructive text-destructive-foreground",
  high: "bg-destructive/20 text-destructive",
  medium: "bg-warning/20 text-warning",
  low: "bg-info/20 text-info",
};

export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={cn("rounded px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase", sev[severity] ?? sev['low'])}>
      {severity}
    </span>
  );
}

export function RiskMeter({ value }: { value: number }) {
  const color = value >= 70 ? "bg-destructive" : value >= 40 ? "bg-warning" : "bg-success";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded bg-muted">
        <div className={cn("h-full", color)} style={{ width: `${value}%` }} />
      </div>
      <span className="font-mono text-xs text-muted-foreground">{value}</span>
    </div>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

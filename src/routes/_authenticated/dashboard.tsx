import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, RiskMeter, SeverityBadge } from "@/components/honeynet";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Overview — Mirage" }, { name: "description", content: "Live honeynet activity." }] }),
  component: Dashboard,
});

function Dashboard() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["overview"],
    queryFn: async () => {
      const [s, a, i] = await Promise.all([
        supabase.from("sessions").select("*, personas(name, hostname)").order("last_activity_at", { ascending: false }).limit(20),
        supabase.from("alerts").select("*").order("created_at", { ascending: false }).limit(30),
        supabase.from("iocs").select("id", { count: "exact", head: true }),
      ]);
      return { sessions: s.data ?? [], alerts: a.data ?? [], iocCount: i.count ?? 0 };
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("overview")
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => qc.invalidateQueries({ queryKey: ["overview"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions" }, () => qc.invalidateQueries({ queryKey: ["overview"] }))
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const sessions = data?.sessions ?? [];
  const alerts = data?.alerts ?? [];
  const stats = [
    { label: "Sessions", value: sessions.length },
    { label: "Alerts", value: alerts.length },
    { label: "Critical / high", value: alerts.filter((a) => a.severity === "critical" || a.severity === "high").length },
    { label: "Indicators", value: data?.iocCount ?? 0 },
  ];

  return (
    <div>
      <PageHeader title="Overview" subtitle="Live activity across every deception host.">
        <Button asChild>
          <Link to="/console">New console session</Link>
        </Button>
      </PageHeader>
      <div className="grid grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</p>
            <p className="mt-2 font-mono text-3xl font-semibold">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <section className="rounded-lg border border-border bg-card lg:col-span-3">
          <h2 className="border-b border-border px-5 py-3 text-sm font-medium">Sessions</h2>
          {sessions.length === 0 ? (
            <Empty text="No attacker sessions yet. Open the console or connect a sensor." />
          ) : (
            <ul className="divide-y divide-border">
              {sessions.map((s) => (
                <li key={s.id}>
                  <Link to="/sessions/$id" params={{ id: s.id }} className="flex items-center justify-between px-5 py-3 hover:bg-accent/50">
                    <div className="min-w-0">
                      <p className="font-mono text-sm">
                        {s.source_ip ?? "unknown"} <span className="text-muted-foreground">→</span> {s.personas?.hostname}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.protocol.toUpperCase()} · {s.source} · {formatDistanceToNow(new Date(s.last_activity_at), { addSuffix: true })}
                      </p>
                    </div>
                    <RiskMeter value={s.risk_score} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-lg border border-border bg-card lg:col-span-2">
          <h2 className="flex items-center gap-2 border-b border-border px-5 py-3 text-sm font-medium">
            <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" /> SIEM alert feed
          </h2>
          {alerts.length === 0 ? (
            <Empty text="Alerts appear here in real time." />
          ) : (
            <ul className="max-h-[560px] divide-y divide-border overflow-auto">
              {alerts.map((a) => (
                <li key={a.id} className="px-5 py-3">
                  <Link to="/sessions/$id" params={{ id: a.session_id }} className="block">
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={a.severity} />
                      <span className="truncate text-sm font-medium">{a.title}</span>
                    </div>
                    {a.mitre_technique && <p className="mt-1 font-mono text-xs text-primary">{a.mitre_technique}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-5 py-10 text-center text-sm text-muted-foreground">{text}</p>;
}

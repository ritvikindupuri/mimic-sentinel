import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, RiskMeter, SeverityBadge } from "@/components/honeynet";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/sessions/$id")({
  head: () => ({ meta: [{ title: "Session report — Mirage" }, { name: "description", content: "Forensic replay of an attacker session." }] }),
  component: SessionPage,
});

function SessionPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["session", id],
    queryFn: async () => {
      const [s, e, a, i] = await Promise.all([
        supabase.from("sessions").select("*, personas(name, hostname, username)").eq("id", id).maybeSingle(),
        supabase.from("session_events").select("*").eq("session_id", id).order("created_at"),
        supabase.from("alerts").select("*").eq("session_id", id).order("created_at", { ascending: false }),
        supabase.from("iocs").select("*").eq("session_id", id).order("created_at", { ascending: false }),
      ]);
      return { session: s.data, events: e.data ?? [], alerts: a.data ?? [], iocs: i.data ?? [] };
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`session-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "session_events", filter: `session_id=eq.${id}` }, () =>
        qc.invalidateQueries({ queryKey: ["session", id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, qc]);

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (!data?.session) return <p className="text-muted-foreground">Session not found. <Link to="/dashboard" className="text-primary">Back</Link></p>;
  const { session, events, alerts, iocs } = data;

  function exportJson() {
    const blob = new Blob([JSON.stringify({ session, events, alerts, iocs }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `mirage-session-${id}.json`;
    a.click();
  }

  return (
    <div>
      <PageHeader
        title={`${session.source_ip ?? "unknown"} → ${session.personas?.hostname}`}
        subtitle={`${session.protocol.toUpperCase()} via ${session.source} · started ${format(new Date(session.started_at), "PPpp")}`}
      >
        <div className="flex items-center gap-4">
          <RiskMeter value={session.risk_score} />
          <Button variant="outline" onClick={exportJson}>Export forensics (JSON)</Button>
        </div>
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-lg border border-border bg-terminal lg:col-span-2">
          <h2 className="border-b border-border px-4 py-2 text-sm font-medium">Keystroke transcript · {events.length} events</h2>
          <div className="max-h-[70vh] overflow-auto p-4 font-mono text-sm">
            {events.map((e) => (
              <div key={e.id} className="mb-1">
                {e.kind === "command" ? (
                  <div>
                    <span className="mr-2 text-xs text-muted-foreground">{format(new Date(e.created_at), "HH:mm:ss")}</span>
                    <span className="text-primary">$</span> {e.content}
                  </div>
                ) : e.kind === "response" ? (
                  <pre className="whitespace-pre-wrap pl-16 text-terminal-foreground/80">{e.content}</pre>
                ) : (
                  <div className="my-2 rounded border border-warning/40 bg-warning/10 p-2 text-xs">
                    <span className="font-medium uppercase text-warning">{e.kind.replace("_", " ")}</span>
                    <pre className="mt-1 whitespace-pre-wrap text-foreground">{e.content.slice(0, 2000)}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
        <div className="space-y-6">
          <section className="rounded-lg border border-border bg-card">
            <h2 className="border-b border-border px-4 py-2 text-sm font-medium">Alerts · {alerts.length}</h2>
            {alerts.map((a) => (
              <div key={a.id} className="border-b border-border px-4 py-3 last:border-0">
                <div className="flex items-center gap-2"><SeverityBadge severity={a.severity} /><span className="text-sm font-medium">{a.title}</span></div>
                {a.mitre_technique && <p className="mt-1 font-mono text-xs text-primary">{a.mitre_technique}</p>}
                <p className="mt-1 text-xs text-muted-foreground">{a.description}</p>
                {a.command && <p className="mt-1 truncate font-mono text-xs text-foreground/70">$ {a.command}</p>}
              </div>
            ))}
          </section>
          <section className="rounded-lg border border-border bg-card">
            <h2 className="border-b border-border px-4 py-2 text-sm font-medium">Indicators · {iocs.length}</h2>
            {iocs.map((c) => (
              <div key={c.id} className="border-b border-border px-4 py-2 last:border-0">
                <p className="font-mono text-[10px] uppercase text-muted-foreground">{c.ioc_type}</p>
                <p className="break-all font-mono text-xs">{c.value}</p>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}

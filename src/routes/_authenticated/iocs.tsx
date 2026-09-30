import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/honeynet";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/iocs")({
  head: () => ({ meta: [{ title: "Indicators — Mirage" }, { name: "description", content: "Indicators of compromise from all sessions." }] }),
  component: IocPage,
});

function IocPage() {
  const { data: iocs = [] } = useQuery({
    queryKey: ["iocs"],
    queryFn: async () => (await supabase.from("iocs").select("*").order("created_at", { ascending: false }).limit(1000)).data ?? [],
  });

  function exportCsv() {
    const rows = [["timestamp", "type", "value", "context", "session_id"], ...iocs.map((i) => [i.created_at, i.ioc_type, i.value, i.context, i.session_id])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "mirage-iocs.csv";
    a.click();
  }

  return (
    <div>
      <PageHeader title="Indicators of compromise" subtitle="Extracted automatically from attacker activity.">
        <Button variant="outline" onClick={exportCsv} disabled={!iocs.length}>Export CSV for SIEM</Button>
      </PageHeader>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-3">Type</th><th className="px-4 py-3">Value</th><th className="px-4 py-3">Context</th><th className="px-4 py-3">Seen</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {iocs.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">No indicators yet.</td></tr>}
            {iocs.map((i) => (
              <tr key={i.id} className="hover:bg-accent/40">
                <td className="px-4 py-2 font-mono text-xs uppercase text-primary">{i.ioc_type}</td>
                <td className="max-w-md break-all px-4 py-2 font-mono text-xs">{i.value}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground">{i.context}</td>
                <td className="whitespace-nowrap px-4 py-2 text-xs">
                  <Link to="/sessions/$id" params={{ id: i.session_id }} className="text-muted-foreground hover:text-primary">
                    {format(new Date(i.created_at), "MMM d HH:mm")}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Trash2, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createSensor } from "@/lib/honeynet.functions";
import { PageHeader } from "@/components/honeynet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/sensors")({
  head: () => ({ meta: [{ title: "Sensors — Mirage" }, { name: "description", content: "Connect real SSH, HTTP and API sensors." }] }),
  component: SensorsPage,
});

function SensorsPage() {
  const qc = useQueryClient();
  const create = useServerFn(createSensor);
  const [name, setName] = useState("");
  const [personaId, setPersonaId] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ["sensors"],
    queryFn: async () => {
      const [s, p] = await Promise.all([
        supabase.from("sensors").select("*, personas(name, hostname)").order("created_at", { ascending: false }),
        supabase.from("personas").select("id, name, hostname"),
      ]);
      return { sensors: s.data ?? [], personas: p.data ?? [] };
    },
  });
  const endpoint = typeof window !== "undefined" ? `${window.location.origin}/api/public/sensor/ingest` : "/api/public/sensor/ingest";

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!personaId) return toast.error("Pick a persona");
    try {
      const r = await create({ data: { name, personaId } });
      setNewKey(r.key);
      setName("");
      qc.invalidateQueries({ queryKey: ["sensors"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create sensor");
    }
  }
  async function remove(id: string) {
    await supabase.from("sensors").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["sensors"] });
  }

  return (
    <div className="max-w-5xl">
      <PageHeader title="Sensors" subtitle="Forward real attacker traffic from SSH, HTTP or API listeners you run at the edge." />

      <form onSubmit={add} className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <div className="w-64"><p className="mb-1 text-xs text-muted-foreground">Sensor name</p><Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="dmz-ssh-eu-1" /></div>
        <div className="w-72">
          <p className="mb-1 text-xs text-muted-foreground">Persona it impersonates</p>
          <Select value={personaId} onValueChange={setPersonaId}>
            <SelectTrigger><SelectValue placeholder="Choose persona" /></SelectTrigger>
            <SelectContent>{data?.personas.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} · {p.hostname}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button type="submit">Create sensor key</Button>
      </form>

      {newKey && (
        <div className="mt-4 rounded-lg border border-primary/50 bg-primary/10 p-4">
          <p className="text-sm font-medium">Copy this key now — it won't be shown again.</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-terminal px-3 py-2 font-mono text-xs">{newKey}</code>
            <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(newKey); toast.success("Copied"); }}><Copy className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-3">Sensor</th><th className="px-4 py-3">Persona</th><th className="px-4 py-3">Key</th><th className="px-4 py-3">Last seen</th><th /></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {!data?.sensors.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No sensors connected yet.</td></tr>}
            {data?.sensors.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2 font-medium">{s.name}</td>
                <td className="px-4 py-2 font-mono text-xs">{s.personas?.hostname}</td>
                <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{s.key_prefix}…</td>
                <td className="px-4 py-2 text-xs">{s.last_seen_at ? formatDistanceToNow(new Date(s.last_seen_at), { addSuffix: true }) : <span className="text-muted-foreground">never</span>}</td>
                <td className="px-4 py-2 text-right"><button onClick={() => remove(s.id)} className="text-muted-foreground hover:text-destructive" aria-label="Revoke sensor"><Trash2 className="h-4 w-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="mt-8 rounded-lg border border-border bg-card p-6">
        <h2 className="font-display font-semibold">Integration</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your sensor accepts the connection, then forwards each event. Relay <code className="font-mono">output</code> back to the attacker verbatim.
        </p>
        <pre className="mt-4 overflow-auto rounded bg-terminal p-4 font-mono text-xs text-terminal-foreground">{`POST ${endpoint}
Authorization: Bearer <sensor key>

# 1. Open a session when an attacker connects
{"type":"session_start","source_ip":"198.51.100.23","protocol":"ssh","username":"root"}
→ {"session_id":"…","hostname":"…","username":"…"}

# 2. Forward every command; send "output" back to the attacker
{"type":"command","session_id":"…","command":"systemctl status sshd | head"}
→ {"output":"● ssh.service - OpenBSD Secure Shell server …","cwd":"/root"}

# 3. Record raw telemetry (file drops, raw socket bytes, login attempts)
{"type":"file_drop","session_id":"…","content":"<base64 or sha256>","metadata":{"path":"/tmp/x.sh","sha256":"…"}}
{"type":"raw_socket","session_id":"…","content":"<hex dump>"}
{"type":"auth_attempt","session_id":"…","content":"root:123456"}`}</pre>
      </section>
    </div>
  );
}

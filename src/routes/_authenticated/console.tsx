import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sendCommand, startConsoleSession, } from "@/lib/honeynet.functions";
import type { TurnAlert, TurnIoc } from "@/lib/deception.server";
import { PageHeader, RiskMeter, SeverityBadge } from "@/components/honeynet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/console")({
  head: () => ({ meta: [{ title: "Attacker console — Mirage" }, { name: "description", content: "Interact with a deception persona." }] }),
  component: ConsolePage,
});

type Line = { kind: "cmd" | "out"; text: string; prompt?: string };

function ConsolePage() {
  const { data: personas = [] } = useQuery({
    queryKey: ["personas"],
    queryFn: async () => (await supabase.from("personas").select("*").order("is_builtin", { ascending: false })).data ?? [],
  });
  const start = useServerFn(startConsoleSession);
  const send = useServerFn(sendCommand);
  const [personaId, setPersonaId] = useState<string>("");
  const [ip, setIp] = useState("203.0.113.47");
  const [session, setSession] = useState<{ id: string; cwd: string } | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [risk, setRisk] = useState(0);
  const [alerts, setAlerts] = useState<TurnAlert[]>([]);
  const [iocs, setIocs] = useState<TurnIoc[]>([]);
  const [hist, setHist] = useState<string[]>([]);
  const [hIdx, setHIdx] = useState(-1);
  const endRef = useRef<HTMLDivElement>(null);
  const persona = personas.find((p) => p.id === personaId);

  useEffect(() => {
    if (!personaId && personas[0]) setPersonaId(personas[0].id);
  }, [personas, personaId]);
  useEffect(() => endRef.current?.scrollIntoView({ block: "end" }), [lines, busy]);

  const prompt = persona && session ? `${persona.username}@${persona.hostname}:${session.cwd.replace(persona.username === "root" ? "/root" : `/home/${persona.username}`, "~")}${persona.username === "root" ? "#" : "$"}` : "";

  async function connect() {
    if (!persona) return;
    try {
      const s = await start({ data: { personaId, sourceIp: ip } });
      setSession(s);
      setRisk(0);
      setAlerts([]);
      setIocs([]);
      setLines([
        {
          kind: "out",
          text: `Welcome to ${persona.os}\n\nLast login: ${new Date(Date.now() - 86400000 * 2).toUTCString()} from 10.20.4.17\n`,
        },
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start session");
    }
  }

  async function run(e: React.FormEvent) {
    e.preventDefault();
    const cmd = input.trim();
    if (!cmd || !session || busy) return;
    setInput("");
    setHist((h) => [cmd, ...h]);
    setHIdx(-1);
    if (cmd === "clear") return setLines([]);
    setLines((l) => [...l, { kind: "cmd", text: cmd, prompt }]);
    setBusy(true);
    try {
      const r = await send({ data: { sessionId: session.id, command: cmd } });
      setLines((l) => [...l, { kind: "out", text: r.output }]);
      setSession({ ...session, cwd: r.cwd });
      setRisk(r.risk);
      if (r.alerts.length) setAlerts((a) => [...r.alerts, ...a]);
      if (r.iocs.length) setIocs((a) => [...r.iocs, ...a]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Command failed");
    } finally {
      setBusy(false);
    }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowUp" && hist.length) {
      e.preventDefault();
      const n = Math.min(hIdx + 1, hist.length - 1);
      setHIdx(n);
      setInput(hist[n]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const n = hIdx - 1;
      setHIdx(n);
      setInput(n >= 0 ? hist[n] : "");
    }
  }

  return (
    <div>
      <PageHeader title="Attacker console" subtitle="Play the attacker. The persona improvises; the analyst engine watches.">
        {session && (
          <Button asChild variant="outline">
            <Link to="/sessions/$id" params={{ id: session.id }}>Open session report</Link>
          </Button>
        )}
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <div className="w-72">
          <p className="mb-1 text-xs text-muted-foreground">Persona</p>
          <Select value={personaId} onValueChange={setPersonaId}>
            <SelectTrigger><SelectValue placeholder="Choose persona" /></SelectTrigger>
            <SelectContent>
              {personas.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name} · {p.hostname}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-48">
          <p className="mb-1 text-xs text-muted-foreground">Simulated source IP</p>
          <Input value={ip} onChange={(e) => setIp(e.target.value)} className="font-mono" />
        </div>
        <Button onClick={connect} disabled={!persona}>{session ? "Reconnect (new session)" : "Connect via SSH"}</Button>
        {session && <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">Session risk <RiskMeter value={risk} /></div>}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div
          className="h-[600px] overflow-auto rounded-lg border border-border bg-terminal p-4 font-mono text-sm lg:col-span-2"
          onClick={() => document.getElementById("term-in")?.focus()}
        >
          {!session ? (
            <p className="text-muted-foreground">Pick a persona and connect to start typing commands.</p>
          ) : (
            <>
              {lines.map((l, i) =>
                l.kind === "cmd" ? (
                  <div key={i} className="text-foreground"><span className="text-primary">{l.prompt}</span> {l.text}</div>
                ) : (
                  <pre key={i} className="whitespace-pre-wrap text-terminal-foreground">{l.text}</pre>
                ),
              )}
              {busy ? (
                <span className="inline-block h-4 w-2 animate-pulse bg-terminal-foreground" />
              ) : (
                <form onSubmit={run} className="flex gap-2">
                  <span className="text-primary">{prompt}</span>
                  <input
                    id="term-in"
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKey}
                    className="flex-1 bg-transparent text-foreground outline-none"
                  />
                </form>
              )}
              <div ref={endRef} />
            </>
          )}
        </div>

        <div className="flex h-[600px] flex-col gap-4">
          <Panel title="Live alerts" count={alerts.length}>
            {alerts.map((a, i) => (
              <div key={i} className="border-b border-border px-4 py-3 last:border-0">
                <div className="flex items-center gap-2"><SeverityBadge severity={a.severity} /><span className="text-sm font-medium">{a.title}</span></div>
                {a.mitre_technique && <p className="mt-1 font-mono text-xs text-primary">{a.mitre_technique}</p>}
                <p className="mt-1 text-xs text-muted-foreground">{a.description}</p>
              </div>
            ))}
          </Panel>
          <Panel title="Indicators" count={iocs.length}>
            {iocs.map((c, i) => (
              <div key={i} className="border-b border-border px-4 py-2 last:border-0">
                <p className="font-mono text-[10px] uppercase text-muted-foreground">{c.ioc_type}</p>
                <p className="break-all font-mono text-xs">{c.value}</p>
              </div>
            ))}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-card">
      <h2 className="flex items-center justify-between border-b border-border px-4 py-2 text-sm font-medium">
        {title} <span className="font-mono text-xs text-muted-foreground">{count}</span>
      </h2>
      <div className="min-h-0 flex-1 overflow-auto">
        {count === 0 ? <p className="p-4 text-xs text-muted-foreground">Nothing yet.</p> : children}
      </div>
    </section>
  );
}

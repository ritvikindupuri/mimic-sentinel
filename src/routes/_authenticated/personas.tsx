import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createPersona } from "@/lib/honeynet.functions";
import { PageHeader } from "@/components/honeynet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/personas")({
  head: () => ({ meta: [{ title: "Personas — Mirage" }, { name: "description", content: "Deception host personas." }] }),
  component: PersonasPage,
});

const empty = { name: "", hostname: "", os: "Ubuntu 22.04.4 LTS", username: "root", description: "", lure_details: "" };

function PersonasPage() {
  const qc = useQueryClient();
  const create = useServerFn(createPersona);
  const [form, setForm] = useState(empty);
  const [open, setOpen] = useState(false);
  const { data: personas = [] } = useQuery({
    queryKey: ["personas"],
    queryFn: async () => (await supabase.from("personas").select("*").order("is_builtin", { ascending: false })).data ?? [],
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create({ data: form });
      toast.success("Persona created");
      setForm(empty);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["personas"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    }
  }
  async function remove(id: string) {
    const { error } = await supabase.from("personas").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["personas"] });
  }
  const f = (k: keyof typeof empty) => ({ value: form[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value }) });

  return (
    <div>
      <PageHeader title="Personas" subtitle="Each persona is a believable host the AI plays for attackers.">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>New persona</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create persona</DialogTitle></DialogHeader>
            <form onSubmit={save} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Name</Label><Input required {...f("name")} placeholder="CI build runner" /></div>
                <div className="space-y-1"><Label>Hostname</Label><Input required {...f("hostname")} placeholder="jenkins-agent-07" className="font-mono" /></div>
                <div className="space-y-1"><Label>Operating system</Label><Input required {...f("os")} /></div>
                <div className="space-y-1"><Label>Login user</Label><Input required {...f("username")} className="font-mono" /></div>
              </div>
              <div className="space-y-1"><Label>Role description</Label><Textarea {...f("description")} placeholder="What this server does in the company" /></div>
              <div className="space-y-1"><Label>Lures & environment details</Label><Textarea rows={4} {...f("lure_details")} placeholder="Files, services, credentials, databases the attacker should find" /></div>
              <Button type="submit" className="w-full">Create</Button>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {personas.map((p) => (
          <div key={p.id} className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display font-semibold">{p.name}</h3>
                <p className="font-mono text-xs text-primary">{p.username}@{p.hostname}</p>
              </div>
              {p.is_builtin ? (
                <span className="rounded bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">Built-in</span>
              ) : (
                <button onClick={() => remove(p.id)} className="text-muted-foreground hover:text-destructive" aria-label="Delete persona"><Trash2 className="h-4 w-4" /></button>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{p.os}</p>
            <p className="mt-3 text-sm">{p.description}</p>
            {p.lure_details && <p className="mt-3 line-clamp-3 font-mono text-xs text-muted-foreground">{p.lure_details}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
